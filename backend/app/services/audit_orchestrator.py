"""
Audit orchestrator: Normalizes text, runs deterministic rules and facts,
invokes optional LLM adapter, validates/merges findings, carries over dismissals,
persists to database, and writes audit event.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import Version, Finding, Rule, Fact
from ..engine.types import RawFinding
from ..engine.normalize import normalize_text
from ..engine.rules import evaluate_rules
from ..engine.facts import evaluate_facts
from ..engine.retrieval import retrieve_context
from ..llm.adapter import review as llm_review
from ..schemas import AuditResultOut, AuditEngines, AuditSummary, FindingOut, Excerpt, EvidenceRef
from .workflow import write_audit_log

def serialize_rule(r: Rule) -> Dict[str, Any]:
    return {
        "id": r.id,
        "type": r.type,
        "pattern": r.pattern,
        "severity": r.severity,
        "message": r.message,
        "suggestion": r.suggestion,
        "tags": r.tags or [],
        "status": r.status,
        "last_reviewed": r.last_reviewed.isoformat() if r.last_reviewed else None
    }

def serialize_fact(f: Fact) -> Dict[str, Any]:
    return {
        "id": f.id,
        "topic": f.topic,
        "subject": f.subject,
        "aliases": f.aliases or [],
        "statement": f.statement,
        "structured_value": f.structured_value or {},
        "valid_from": f.valid_from.isoformat() if f.valid_from else None,
        "last_reviewed": f.last_reviewed.isoformat() if f.last_reviewed else None,
        "status": f.status,
        "tags": f.tags or [],
        "kind": f.kind
    }

def run_audit(db: Session, version: Version, actor_id: Optional[int] = None) -> AuditResultOut:
    """
    Executes the multi-stage audit pipeline on a version body.
    """
    body = version.body

    # 1. Fetch active rules and facts from DB
    db_rules = db.query(Rule).filter(Rule.status == "current").all()
    db_facts = db.query(Fact).all()

    rules_data = [serialize_rule(r) for r in db_rules]
    facts_data = [serialize_fact(f) for f in db_facts]
    substantiations = [f for f in facts_data if f.get("kind") == "substantiation"]
    general_facts = [f for f in facts_data if f.get("kind") != "substantiation"]

    # 2. Deterministic Engines
    raw_rule_findings = evaluate_rules(body, rules_data, substantiations)
    raw_fact_findings = evaluate_facts(body, general_facts)
    deterministic_findings = raw_rule_findings + raw_fact_findings

    # 3. Retrieval for LLM context
    ctx = retrieve_context(body, rules_data, facts_data)

    # 4. LLM Adapter (safely wrapped, untrusted)
    llm_res = llm_review(body, ctx)
    valid_llm_findings: List[RawFinding] = []

    if llm_res.status == "ran":
        for lf in llm_res.findings:
            # Drop if evidence_id is not in context set
            if lf.evidence_id not in ctx.ids:
                continue
            # Drop if excerpt is not verbatim in body
            if lf.excerpt_text not in body:
                continue
            # Calculate offsets
            start_idx = body.find(lf.excerpt_text)
            end_idx = start_idx + len(lf.excerpt_text)
            lf.start = start_idx
            lf.end = end_idx

            # Drop if overlaps any deterministic finding (deterministic engine wins!)
            overlap = any(
                not (lf.end <= df.start or lf.start >= df.end)
                for df in deterministic_findings
            )
            if not overlap:
                valid_llm_findings.append(lf)

    all_raw = deterministic_findings + valid_llm_findings

    # 5. Deduplicate and sort by start offset
    all_raw.sort(key=lambda f: (f.start, f.end))

    # 6. Carry-over previously dismissed findings from Version N-1
    dismissed_carryover: Dict[tuple, Finding] = {}
    if version.number > 1:
        prev_version = db.query(Version).filter(
            Version.submission_id == version.submission_id,
            Version.number == version.number - 1
        ).first()
        if prev_version:
            for pf in prev_version.findings:
                if pf.resolution == "dismissed":
                    key = (pf.evidence_id, normalize_text(pf.excerpt_text).strip().lower())
                    dismissed_carryover[key] = pf

    # 7. Persist to DB
    # Clear any existing findings for this version first (idempotent re-audit)
    db.query(Finding).filter(Finding.version_id == version.id).delete()

    created_findings: List[Finding] = []
    issue_counter = 1

    # Pre-build lookup maps for evidence labels
    rule_labels = {r["id"]: r.get("message", r["id"]) for r in rules_data}
    fact_labels = {f["id"]: f.get("statement", f["id"]) for f in facts_data}
    rule_reviewed = {r["id"]: r.get("last_reviewed") for r in rules_data}
    fact_reviewed = {f["id"]: f.get("last_reviewed") for f in facts_data}

    for raw in all_raw:
        issue_id = f"F-{issue_counter}"
        issue_counter += 1

        # Check carry-over
        carry_key = (raw.evidence_id, normalize_text(raw.excerpt_text).strip().lower())
        resolution = "open"
        resolution_reason = None
        resolved_by = None
        resolved_at = None

        if carry_key in dismissed_carryover:
            old_pf = dismissed_carryover[carry_key]
            resolution = "dismissed"
            resolution_reason = f"[Carried over from v{version.number-1}] {old_pf.resolution_reason or ''}"
            resolved_by = old_pf.resolved_by
            resolved_at = datetime.utcnow()

        db_finding = Finding(
            version_id=version.id,
            issue_id=issue_id,
            category=raw.category,
            severity=raw.severity,
            start=raw.start,
            end=raw.end,
            excerpt_text=raw.excerpt_text,
            explanation=raw.explanation,
            evidence_id=raw.evidence_id,
            evidence_kind=raw.evidence_kind,
            suggestion=raw.suggestion,
            verification_status=raw.verification_status,
            source_engine=raw.source_engine,
            resolution=resolution,
            resolution_reason=resolution_reason,
            resolved_by=resolved_by,
            resolved_at=resolved_at
        )
        db.add(db_finding)
        created_findings.append(db_finding)

    # 8. Update version engines metadata
    version.engines = {
        "rules": "ran",
        "llm": llm_res.status,
        "llm_reason": llm_res.reason
    }
    db.commit()

    # 9. Write audit log entry
    summary_counts = {
        "critical": sum(1 for f in created_findings if f.severity == "critical" and f.resolution == "open"),
        "high": sum(1 for f in created_findings if f.severity == "high" and f.resolution == "open"),
        "medium": sum(1 for f in created_findings if f.severity == "medium" and f.resolution == "open"),
        "low": sum(1 for f in created_findings if f.severity == "low" and f.resolution == "open"),
        "total": len(created_findings)
    }

    write_audit_log(
        db=db,
        actor_id=actor_id,
        action="audit.run",
        object_type="version",
        object_id=str(version.id),
        meta={
            "submission_id": version.submission_id,
            "version_number": version.number,
            "engines": version.engines,
            "summary": summary_counts
        }
    )

    # 10. Format and return AuditResultOut
    output_findings: List[FindingOut] = []
    for f in created_findings:
        last_rev = fact_reviewed.get(f.evidence_id) or rule_reviewed.get(f.evidence_id)
        label_text = fact_labels.get(f.evidence_id) or rule_labels.get(f.evidence_id) or f.evidence_id
        if len(label_text) > 60:
            label_text = label_text[:57] + "..."

        output_findings.append(
            FindingOut(
                id=f.id,
                issue_id=f.issue_id,
                version_id=f.version_id,
                category=f.category,
                severity=f.severity,
                excerpt=Excerpt(text=f.excerpt_text, start=f.start, end=f.end),
                explanation=f.explanation,
                evidence=EvidenceRef(
                    id=f.evidence_id,
                    kind=f.evidence_kind,
                    label=label_text,
                    last_reviewed=last_rev
                ),
                suggested_correction=f.suggestion,
                verification_status=f.verification_status,
                source_engine=f.source_engine,
                resolution=f.resolution,
                resolution_reason=f.resolution_reason
            )
        )

    return AuditResultOut(
        submission_id=version.submission_id,
        version_id=version.id,
        version=version.number,
        engines=AuditEngines(
            rules=version.engines.get("rules", "ran"),
            llm=version.engines.get("llm", "disabled"),
            llm_reason=version.engines.get("llm_reason")
        ),
        summary=AuditSummary(**summary_counts),
        findings=output_findings
    )
