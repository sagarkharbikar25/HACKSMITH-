"""
Workflow state machine, gate validations, and audit trail writer.
"""
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models import Submission, Version, Finding, AuditLog, User

def write_audit_log(
    db: Session,
    actor_id: Optional[int],
    action: str,
    object_type: str,
    object_id: Optional[str],
    meta: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Writes an immutable event to the audit log.
    Strict privacy rule: never logs draft body content.
    """
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        object_type=object_type,
        object_id=str(object_id) if object_id else None,
        meta=meta or {}
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def validate_submission_gate(db: Session, submission: Submission, latest_version: Version):
    """
    Enforces the submit gate: No open findings with critical or high severity.
    """
    open_blockers = db.query(Finding).filter(
        Finding.version_id == latest_version.id,
        Finding.resolution == "open",
        Finding.severity.in_(["critical", "high"])
    ).all()

    if open_blockers:
        blocker_ids = [f.issue_id for f in open_blockers]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "CANNOT_SUBMIT_OPEN_FINDINGS",
                    "message": f"Cannot submit for review: {len(open_blockers)} critical/high finding(s) remain open.",
                    "details": {"blocking_finding_ids": blocker_ids}
                }
            }
        )

def validate_dismissal_gate(finding: Finding, reason: Optional[str]):
    """
    Enforces the dismissal gate: Critical findings cannot be dismissed.
    High/medium/low require a reason (>= 3 chars).
    """
    if finding.severity == "critical":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "CANNOT_DISMISS_CRITICAL",
                    "message": "Critical compliance contradictions cannot be dismissed by creators. They must be resolved or overridden by a reviewer.",
                    "details": {"finding_id": finding.id, "severity": "critical"}
                }
            }
        )

    if not reason or len(reason.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "DISMISSAL_REASON_REQUIRED",
                    "message": "A valid explanation (minimum 3 characters) is required to dismiss a compliance finding.",
                    "details": {}
                }
            }
        )

def validate_decision_gate(latest_version: Version, decision: str, override_reason: Optional[str]):
    """
    Enforces the decision gate: Approving with open critical findings requires override_reason.
    """
    if decision == "approve":
        has_critical = any(
            f.severity == "critical" and f.resolution == "open"
            for f in latest_version.findings
        )
        if has_critical and (not override_reason or len(override_reason.strip()) < 3):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "OVERRIDE_REASON_REQUIRED",
                        "message": "An explicit override reason is mandatory to approve content with open critical contradictions.",
                        "details": {}
                    }
                }
            )
