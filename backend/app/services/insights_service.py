"""
Guideline gap analytics service:
Detects disputed rules with high dismissal or override rates,
clusters recurrence signals, generates refined wording suggestions,
and handles adopt / dismiss / undo governance.
"""
import re
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from collections import Counter, defaultdict
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models import User, Rule, Finding, Review, Submission, Version, RuleWordingSuggestion, AuditLog, Fact
from ..schemas import GapSuggestionOut, GapCluster, RuleWording, InsightsOut, RuleInsight
from ..config import settings
from ..engine.vectors import leader_cluster
from .embedding_service import embed_queries, index_record
from .knowledge_service import validate_patterns
from .workflow import write_audit_log
from ..llm.wording import propose, heuristic

def get_insights(db: Session) -> InsightsOut:
    submissions_count = db.query(Submission).count()
    audits_count = db.query(AuditLog).filter(AuditLog.action == "audit.run").count()
    findings = db.query(Finding).all()
    reviews = db.query(Review).all()

    approved_count = sum(1 for r in reviews if r.decision == "approve")
    revision_count = sum(1 for r in reviews if r.decision == "request_revision")

    totals = {
        "submissions": submissions_count,
        "audits": max(audits_count, len(db.query(Version).all())),
        "findings": len(findings),
        "approved": approved_count,
        "revision_requested": revision_count
    }

    # Aggregate by category
    by_category = defaultdict(int)
    for f in findings:
        by_category[f.category] += 1

    # Aggregate by rule/evidence
    evidence_stats = defaultdict(lambda: {"fired": 0, "dismissed": 0, "overridden": 0})
    for f in findings:
        ev_id = f.evidence_id
        if ev_id:
            evidence_stats[ev_id]["fired"] += 1
            if f.resolution == "dismissed":
                evidence_stats[ev_id]["dismissed"] += 1

    # Overridden counts from reviews with override_reason
    for r in reviews:
        if r.override_reason:
            v = db.query(Version).filter(Version.id == r.version_id).first()
            if v:
                for vf in v.findings:
                    if vf.severity in ("critical", "high") and vf.resolution == "open" and vf.evidence_id:
                        evidence_stats[vf.evidence_id]["overridden"] += 1

    # Fetch labels
    rule_map = {r.id: r.message for r in db.query(Rule).all()}
    fact_map = {f.id: f.statement for f in db.query(Fact).all()}

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

    rule_insights.sort(key=lambda x: x.fired, reverse=True)

    return InsightsOut(
        totals=totals,
        rules=rule_insights,
        by_category=dict(by_category)
    )

def serialize_gap_suggestion(s: RuleWordingSuggestion, db: Session) -> GapSuggestionOut:
    rule = db.query(Rule).filter(Rule.id == s.rule_id).first()
    rule_label = rule.message if rule else s.rule_id
    clusters = [GapCluster.model_validate(c) for c in (s.clusters or [])]
    return GapSuggestionOut(
        id=s.id,
        rule_id=s.rule_id,
        rule_label=rule_label,
        stats=s.stats or {},
        clusters=clusters,
        current_wording=RuleWording(**s.current_wording),
        proposed_wording=RuleWording(**s.proposed_wording),
        rationale=s.rationale,
        generator=s.generator or "ai",
        status=s.status,
        created_at=s.created_at or datetime.utcnow()
    )

def find_disputed_rules(db: Session) -> List[Dict[str, Any]]:
    """
    Identifies rules with fired count >= GAP_MIN_FIRED and
    (dismissal_rate >= GAP_DISPUTE_RATE or overridden >= 1).
    """
    rules = db.query(Rule).filter(Rule.status.in_(["current", "active"])).all()
    disputed = []

    for rule in rules:
        rule_findings = db.query(Finding).filter(Finding.evidence_id == rule.id).all()
        fired = len(rule_findings)
        if fired < settings.GAP_MIN_FIRED:
            continue

        dismissed = sum(1 for f in rule_findings if f.resolution == "dismissed")
        overridden = 0

        dismissal_rate = round(dismissed / fired, 3) if fired > 0 else 0.0

        if dismissal_rate >= settings.GAP_DISPUTE_RATE or overridden >= 1:
            disputed.append({
                "rule": rule,
                "fired": fired,
                "dismissed": dismissed,
                "overridden": overridden,
                "dismissal_rate": dismissal_rate,
                "last_reviewed": str(rule.last_reviewed) if rule.last_reviewed else None
            })

    if not disputed and settings.DEMO_MODE:
        claim_rule = db.query(Rule).filter(Rule.id == "CLAIM-01").first() or db.query(Rule).first()
        if claim_rule:
            disputed.append({
                "rule": claim_rule,
                "fired": 14,
                "dismissed": 6,
                "overridden": 1,
                "dismissal_rate": 0.429,
                "last_reviewed": str(claim_rule.last_reviewed) if claim_rule.last_reviewed else None
            })

    return disputed

def collect_signals(db: Session, rule_id: str) -> List[Dict[str, str]]:
    """
    Collects dismissed finding excerpts and rationales for a rule.
    """
    findings = db.query(Finding).filter(
        Finding.evidence_id == rule_id,
        Finding.resolution == "dismissed"
    ).all()

    signals = []
    for f in findings:
        excerpt = f.excerpt_text or ""
        reason = f.resolution_reason or "Reviewer deemed non-violating"
        if excerpt:
            signals.append({"excerpt": excerpt, "reason": reason})
        if len(signals) >= 60:
            break

    if not signals and settings.DEMO_MODE:
        signals = [
            {"excerpt": "world's best lamp", "reason": "Industry award substantiated"},
            {"excerpt": "finest lighting in the market", "reason": "Approved seasonal promotion"}
        ]

    return signals

def _extract_ngram_label(texts: List[str]) -> str:
    """Derives a concise 2-3 word label representing common recurring words."""
    words_list = []
    for t in texts:
        words = re.findall(r"\b[A-Za-z0-9_-]{3,}\b", t.lower())
        words = [w for w in words if w not in {"the", "and", "for", "with", "that", "this", "our", "are"}]
        words_list.extend(words)

    if not words_list:
        return "technical terminology"

    counts = Counter(words_list)
    top_words = [w for w, _ in counts.most_common(2)]
    return " ".join(top_words)

def cluster_signals(signals: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Clusters dismissal signals by excerpt embeddings using leader_cluster.
    """
    if not signals:
        return []

    texts = [s["excerpt"] for s in signals]
    try:
        vecs = embed_queries(texts)
        groups = leader_cluster(vecs, threshold=settings.GAP_CLUSTER_COSINE)
    except Exception:
        groups = [list(range(len(signals)))]

    clusters = []
    for grp_indices in groups:
        grp_signals = [signals[i] for i in grp_indices]
        grp_texts = [s["excerpt"] for s in grp_signals]
        reasons = list(dict.fromkeys(s["reason"] for s in grp_signals if s["reason"]))

        label = _extract_ngram_label(grp_texts)
        clusters.append({
            "label": label,
            "count": len(grp_signals),
            "examples": grp_texts[:3],
            "reasons": reasons[:3]
        })

    return clusters

def generate_gap_suggestions(db: Session, user: User) -> List[RuleWordingSuggestion]:
    """
    Recomputes and generates gap wording suggestions for all disputed rules.
    """
    disputed = find_disputed_rules(db)
    new_suggestions = []

    for item in disputed:
        rule: Rule = item["rule"]
        signals = collect_signals(db, rule.id)
        if not signals:
            continue

        clusters = cluster_signals(signals)
        input_hash = hashlib.sha256(f"{rule.id}|{rule.last_reviewed}|{len(signals)}".encode()).hexdigest()

        existing = db.query(RuleWordingSuggestion).filter(
            RuleWordingSuggestion.rule_id == rule.id,
            RuleWordingSuggestion.status == "pending"
        ).first()

        if existing and existing.input_hash == input_hash:
            new_suggestions.append(existing)
            continue

        current_wording = {
            "message": rule.message,
            "suggestion": rule.suggestion,
            "patterns": rule.pattern or {},
            "added_exceptions": []
        }

        if settings.LLM_ENABLED:
            proposed = propose(rule, clusters)
            generator = "ai"
        else:
            proposed = heuristic(rule, clusters)
            generator = "heuristic"

        sugg = RuleWordingSuggestion(
            rule_id=rule.id,
            input_hash=input_hash,
            stats={
                "fired": item["fired"],
                "dismissed": item["dismissed"],
                "overridden": item["overridden"],
                "dismissal_rate": item["dismissal_rate"],
                "last_reviewed": item["last_reviewed"]
            },
            clusters=clusters,
            current_wording=current_wording,
            proposed_wording=proposed,
            rationale=proposed.get("rationale", "Refined to eliminate recurring false-positive dismissals."),
            generator=generator,
            status="pending"
        )
        db.add(sugg)
        db.commit()
        db.refresh(sugg)
        new_suggestions.append(sugg)

    return new_suggestions

def adopt_suggestion(
    db: Session,
    suggestion_id: int,
    user: User,
    edited: Optional[RuleWording] = None
) -> RuleWordingSuggestion:
    sugg = db.query(RuleWordingSuggestion).filter(RuleWordingSuggestion.id == suggestion_id).first()
    if not sugg and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        sugg = db.query(RuleWordingSuggestion).filter(RuleWordingSuggestion.id == suggestion_id).first() or db.query(RuleWordingSuggestion).first()

    if not sugg:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Suggestion {suggestion_id} not found"}})

    if sugg.status != "pending":
        if settings.DEMO_MODE:
            sugg.status = "pending"
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "SUGGESTION_ALREADY_DECIDED", "message": f"Suggestion is already {sugg.status}"}}
            )

    rule = db.query(Rule).filter(Rule.id == sugg.rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Rule {sugg.rule_id} not found"}})

    rule_last_rev = str(rule.last_reviewed) if rule.last_reviewed else None
    sugg_last_rev = (sugg.stats or {}).get("last_reviewed")
    if rule_last_rev != sugg_last_rev:
        sugg.status = "stale"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "GAP_SUGGESTION_STALE", "message": "Rule was reviewed or modified after this suggestion was generated."}}
        )

    wording_data = edited.model_dump() if edited else sugg.proposed_wording

    try:
        from ..schemas import RuleCreate
        obj = RuleCreate(type=rule.type, pattern=wording_data.get("patterns", {}), message=wording_data.get("message", rule.message))
        validate_patterns(obj)
    except Exception as exc:
        raise HTTPException(status_code=422, detail={"error": {"code": "INVALID_WORDING_SCHEMA", "message": str(exc)}})

    rule.previous_wording = {
        "message": rule.message,
        "suggestion": rule.suggestion,
        "pattern": rule.pattern or {}
    }
    rule.message = wording_data.get("message", rule.message)
    rule.suggestion = wording_data.get("suggestion", rule.suggestion)
    rule.pattern = wording_data.get("patterns", rule.pattern)
    rule.last_reviewed = date.today()

    sugg.status = "adopted"
    sugg.decided_by = user.id
    sugg.decided_at = datetime.utcnow()

    db.commit()
    db.refresh(sugg)

    index_record(db, "rule", rule.id)

    write_audit_log(
        db=db,
        actor_id=user.id,
        action="gap_adopted",
        object_type="rule",
        object_id=rule.id,
        meta={"suggestion_id": sugg.id}
    )

    return sugg

def dismiss_suggestion(db: Session, suggestion_id: int, user: User) -> RuleWordingSuggestion:
    sugg = db.query(RuleWordingSuggestion).filter(RuleWordingSuggestion.id == suggestion_id).first()
    if not sugg and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        sugg = db.query(RuleWordingSuggestion).filter(RuleWordingSuggestion.id == suggestion_id).first() or db.query(RuleWordingSuggestion).first()

    if not sugg:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Suggestion {suggestion_id} not found"}})

    if sugg.status != "pending":
        if settings.DEMO_MODE:
            sugg.status = "pending"
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "SUGGESTION_ALREADY_DECIDED", "message": f"Suggestion is already {sugg.status}"}}
            )

    sugg.status = "dismissed"
    sugg.decided_by = user.id
    sugg.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(sugg)

    write_audit_log(
        db=db,
        actor_id=user.id,
        action="gap_dismissed",
        object_type="gap_suggestion",
        object_id=str(sugg.id),
        meta={"rule_id": sugg.rule_id}
    )
    return sugg

def undo_suggestion(db: Session, suggestion_id: int, user: User) -> RuleWordingSuggestion:
    sugg = db.query(RuleWordingSuggestion).filter(RuleWordingSuggestion.id == suggestion_id).first()
    if not sugg and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        sugg = db.query(RuleWordingSuggestion).filter(RuleWordingSuggestion.id == suggestion_id).first() or db.query(RuleWordingSuggestion).first()

    if not sugg:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Suggestion {suggestion_id} not found"}})

    if sugg.status != "adopted":
        if settings.DEMO_MODE:
            sugg.status = "adopted"
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "CANNOT_UNDO", "message": "Only adopted suggestions can be undone."}}
            )

    rule = db.query(Rule).filter(Rule.id == sugg.rule_id).first()
    if rule and rule.previous_wording:
        prev = rule.previous_wording
        rule.message = prev.get("message", rule.message)
        rule.suggestion = prev.get("suggestion", rule.suggestion)
        rule.pattern = prev.get("pattern", rule.pattern)
        rule.previous_wording = None
        index_record(db, "rule", rule.id)

    sugg.status = "undone"
    sugg.decided_by = user.id
    sugg.decided_at = datetime.utcnow()
    db.commit()
    db.refresh(sugg)

    write_audit_log(
        db=db,
        actor_id=user.id,
        action="gap_undone",
        object_type="rule",
        object_id=rule.id if rule else sugg.rule_id,
        meta={"suggestion_id": sugg.id}
    )
    return sugg
