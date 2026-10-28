"""
Insights aggregation service for compliance analytics.
"""
from typing import Dict, Any, List
from collections import defaultdict
from sqlalchemy.orm import Session
from ..models import Submission, Version, Finding, Review, Rule, Fact, AuditLog
from ..schemas import InsightsOut, RuleInsight

def get_insights(db: Session) -> InsightsOut:
    submissions_count = db.query(Submission).count()
    audits_count = db.query(AuditLog).filter(AuditLog.action == "audit.run").count()
    findings = db.query(Finding).all()
    reviews = db.query(Review).all()

    approved_count = sum(1 for r in reviews if r.decision == "approve")
    revision_count = sum(1 for r in reviews if r.decision == "request_revision")
    dismissed_count = sum(1 for f in findings if f.resolution == "dismissed")
    overridden_count = sum(1 for r in reviews if r.override_reason)

    totals = {
        "submissions": submissions_count,
        "audits": max(audits_count, len(db.query(Version).all())),
        "findings": len(findings),
        "total_findings": len(findings),
        "dismissed": dismissed_count,
        "overridden": overridden_count,
        "approved": approved_count,
        "revision_requested": revision_count
    }

    # Aggregate by category
    by_category = defaultdict(int)
    for f in findings:
        by_category[f.category] += 1

    # Ensure standard categories exist so the dashboard renders completely
    default_categories = ["prohibited_terms", "tone_and_voice", "factual_accuracy", "superlatives", "regulatory"]
    for cat in default_categories:
        if cat not in by_category:
            by_category[cat] = 0

    # Aggregate by rule/evidence
    evidence_stats = defaultdict(lambda: {"fired": 0, "dismissed": 0, "overridden": 0})
    for f in findings:
        evidence_stats[f.evidence_id]["fired"] += 1
        if f.resolution == "dismissed":
            evidence_stats[f.evidence_id]["dismissed"] += 1

    # Overridden counts from reviews with override_reason
    for r in reviews:
        if r.override_reason:
            v = db.query(Version).filter(Version.id == r.version_id).first()
            if v:
                for vf in v.findings:
                    if vf.severity in ("critical", "high") and vf.resolution == "open":
                        evidence_stats[vf.evidence_id]["overridden"] += 1

    # Fetch all active rules and facts from database so Brand Manager sees the entire guideline suite
    all_rules = db.query(Rule).all()
    all_facts = db.query(Fact).all()
    rule_map = {r.id: r.message for r in all_rules}
    fact_map = {f.id: f.statement for f in all_facts}

    # Include all configured rules so brand manager tracks 100% of guidelines
    for r in all_rules:
        if r.id not in evidence_stats and r.status != "retired":
            evidence_stats[r.id] = {"fired": 0, "dismissed": 0, "overridden": 0}

    rule_insights: List[RuleInsight] = []
    for ev_id, stats in evidence_stats.items():
        fired = stats["fired"]
        dismissed = stats["dismissed"]
        overridden = stats["overridden"]
        rate = round(dismissed / fired, 2) if fired > 0 else 0.0

        label = rule_map.get(ev_id) or fact_map.get(ev_id) or ev_id
        if len(label) > 60:
            label = label[:57] + "..."

        flag = "frequently_disputed" if (fired >= 5 and rate >= 0.4) else None

        rule_insights.append(
            RuleInsight(
                evidence_id=ev_id,
                label=label,
                fired=fired,
                dismissed=dismissed,
                overridden=overridden,
                dismissal_rate=rate,
                flag=flag
            )
        )

    # Sort so active/frequently-fired rules appear first
    rule_insights.sort(key=lambda x: (x.fired, x.dismissed), reverse=True)

    return InsightsOut(
        totals=totals,
        rules=rule_insights,
        by_category=dict(by_category)
    )
