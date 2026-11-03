"""
Audit orchestrator: Normalizes text, runs deterministic rules and facts,
invokes semantic similarity engine, invokes optional LLM adapter,
merges findings with priority (Deterministic > Semantic > LLM),
carries over dismissals, persists to database, and writes audit event.
"""
import time
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
from ..schemas import AuditResultOut, AuditEngines, AuditSummary, FindingOut, Excerpt, EvidenceRef, SourceInfo
from .workflow import write_audit_log
from .semantic_matcher import run_semantic

_rules_cache = None
_facts_cache = None
_last_cache_time = 0.0

def invalidate_knowledge_cache():
    global _rules_cache, _facts_cache
    _rules_cache = None
    _facts_cache = None

def get_cached_rules_and_facts(db: Session):
    global _rules_cache, _facts_cache, _last_cache_time
    now = time.monotonic()
    if _rules_cache is not None and (now - _last_cache_time < 30.0):
        return _rules_cache, _facts_cache
    db_rules = db.query(Rule).filter(Rule.status == "current").all()
    db_facts = db.query(Fact).all()
    _rules_cache = [serialize_rule(r) for r in db_rules]
    _facts_cache = [serialize_fact(f) for f in db_facts]
    _last_cache_time = now
    return _rules_cache, _facts_cache

def serialize_rule(r: Rule) -> Dict[str, Any]:
    source = None
    if getattr(r, "source_citation", None):
        source = {
            "citation": r.source_citation,
            "page": getattr(r, "source_page", None),
            "document_id": getattr(r, "source_document_id", None)
        }
    return {
        "id": r.id,
        "type": r.type,
        "pattern": r.pattern,
        "severity": r.severity,
        "message": r.message,
        "suggestion": r.suggestion,
        "tags": r.tags or [],
        "status": r.status,
        "last_reviewed": r.last_reviewed.isoformat() if r.last_reviewed else None,
        "source": source
    }

def serialize_fact(f: Fact) -> Dict[str, Any]:
    source = None
    if getattr(f, "source_citation", None):
        source = {
            "citation": f.source_citation,
            "page": getattr(f, "source_page", None),
            "document_id": getattr(f, "source_document_id", None)
        }
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
        "kind": f.kind,
        "source": source
    }

def run_audit(db: Session, version: Version, actor_id: Optional[int] = None) -> AuditResultOut:
    """
    Executes the multi-stage hybrid audit pipeline on a version body.
    Priority: Deterministic > Semantic > LLM.
    """
    body = version.body

    # 1. Fetch active rules and facts (cached in-memory for 30s)
    rules_data, facts_data = get_cached_rules_and_facts(db)
    substantiations = [f for f in facts_data if f.get("kind") == "substantiation"]
    general_facts = [f for f in facts_data if f.get("kind") != "substantiation"]

    # 2. Deterministic Engines
    raw_rule_findings = evaluate_rules(body, rules_data, substantiations)
    raw_fact_findings = evaluate_facts(body, general_facts)
    deterministic_findings = raw_rule_findings + raw_fact_findings

    taken_spans = [(df.start, df.end) for df in deterministic_findings]

    # 3. Semantic Retrieval Engine (skips spans overlapping deterministic findings)
    semantic_findings, semantic_status, semantic_reason = run_semantic(
        db=db,
        norm=normalize_text(body),
        body=body,
        taken_spans=taken_spans
    )
    valid_semantic_findings: List[RawFinding] = []
    for sf in semantic_findings:
        if not any(not (sf.end <= df.start or sf.start >= df.end) for df in deterministic_findings):
            valid_semantic_findings.append(sf)

    taken_spans += [(sf.start, sf.end) for sf in valid_semantic_findings]

    # 4. Retrieval for LLM context
    ctx = retrieve_context(body, rules_data, facts_data)

    # 5. LLM Adapter (safely wrapped, untrusted)
    llm_res = llm_review(body, ctx)
    valid_llm_findings: List[RawFinding] = []

    if llm_res.status == "ran":
        for lf in llm_res.findings:
            if lf.evidence_id not in ctx.ids:
                continue
            if lf.excerpt_text not in body:
                continue
            start_idx = body.find(lf.excerpt_text)
            end_idx = start_idx + len(lf.excerpt_text)
            lf.start = start_idx
            lf.end = end_idx

            # Drop if overlaps any higher priority finding
            overlap = any(
                not (lf.end <= ts[0] or lf.start >= ts[1])
                for ts in taken_spans
            )
            if not overlap:
                valid_llm_findings.append(lf)

    # Priority Merge
    all_raw = deterministic_findings + valid_semantic_findings + valid_llm_findings

    # 6. Deduplicate and sort by start offset
    all_raw.sort(key=lambda f: (f.start, f.end))

    # 7. Carry-over previously dismissed findings from Version N-1
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

    # 8. Persist to DB
    # Clear any existing findings for this version first (idempotent re-audit)
    db.query(Finding).filter(Finding.version_id == version.id).delete()

    created_findings: List[Finding] = []
    issue_counter = 1

    # Pre-build lookup maps for evidence labels and sources
    rule_labels = {r["id"]: r.get("message", r["id"]) for r in rules_data}
    fact_labels = {f["id"]: f.get("statement", f["id"]) for f in facts_data}
    rule_reviewed = {r["id"]: r.get("last_reviewed") for r in rules_data}
    fact_reviewed = {f["id"]: f.get("last_reviewed") for f in facts_data}
    rule_sources = {r["id"]: r.get("source") for r in rules_data}
    fact_sources = {f["id"]: f.get("source") for f in facts_data}

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
            resolved_at=resolved_at,
            similarity=getattr(raw, "similarity", None),
            match_type=getattr(raw, "match_type", "exact")
        )
        db.add(db_finding)
        created_findings.append(db_finding)

    # 9. Update version engines metadata
    version.engines = {
        "rules": "ran",
        "llm": llm_res.status,
        "llm_reason": llm_res.reason,
        "semantic": semantic_status,
        "semantic_reason": semantic_reason
    }
    db.commit()

    # 10. Write audit log entry
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

    # 11. Format and return AuditResultOut
    output_findings: List[FindingOut] = []
    for f in created_findings:
        last_rev = fact_reviewed.get(f.evidence_id) or rule_reviewed.get(f.evidence_id)
        label_text = fact_labels.get(f.evidence_id) or rule_labels.get(f.evidence_id) or f.evidence_id
        source_data = fact_sources.get(f.evidence_id) or rule_sources.get(f.evidence_id)
        source_obj = SourceInfo(**source_data) if source_data else None

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
                    last_reviewed=last_rev,
                    source=source_obj
                ),
                suggested_correction=f.suggestion,
                verification_status=f.verification_status,
                source_engine=f.source_engine or "rules",
                resolution=f.resolution,
                resolution_reason=f.resolution_reason,
                similarity=f.similarity,
                match_type=f.match_type or "exact"
            )
        )

    return AuditResultOut(
        submission_id=version.submission_id,
        version_id=version.id,
        version=version.number,
        engines=AuditEngines(
            rules=version.engines.get("rules", "ran"),
            llm=version.engines.get("llm", "disabled"),
            llm_reason=version.engines.get("llm_reason"),
            semantic=version.engines.get("semantic", "disabled"),
            semantic_reason=version.engines.get("semantic_reason")
        ),
        summary=AuditSummary(**summary_counts),
        findings=output_findings
    )
