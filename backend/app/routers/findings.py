"""
Findings resolution router.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Finding, Version, Submission
from ..schemas import FindingPatchRequest, FindingOut, Excerpt, EvidenceRef
from ..deps import get_current_user
from ..services.workflow import write_audit_log, validate_dismissal_gate

router = APIRouter(prefix="/findings", tags=["findings"])

@router.patch("/{id}", response_model=FindingOut)
def patch_finding(
    id: int,
    payload: FindingPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    finding = db.query(Finding).filter(Finding.id == id).first()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Finding not found", "details": {"id": id}}}
        )

    # Permission check: Creator must own the submission, or role must be brand_manager/admin
    version = db.query(Version).filter(Version.id == finding.version_id).first()
    submission = db.query(Submission).filter(Submission.id == version.submission_id).first() if version else None

    if user.role in ("creator", "agency") and submission and submission.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You can only modify findings on your own submissions", "details": {}}}
        )

    if payload.resolution == "dismissed":
        validate_dismissal_gate(finding, payload.reason)

    finding.resolution = payload.resolution
    finding.resolution_reason = payload.reason
    finding.resolved_by = user.id
    finding.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(finding)

    write_audit_log(
        db,
        actor_id=user.id,
        action="finding.resolve",
        object_type="finding",
        object_id=str(finding.id),
        meta={"resolution": payload.resolution, "reason": payload.reason}
    )

    return FindingOut(
        id=finding.id,
        issue_id=finding.issue_id,
        version_id=finding.version_id,
        category=finding.category,
        severity=finding.severity,
        excerpt=Excerpt(text=finding.excerpt_text, start=finding.start, end=finding.end),
        explanation=finding.explanation,
        evidence=EvidenceRef(id=finding.evidence_id, kind=finding.evidence_kind, label=finding.evidence_id),
        suggested_correction=finding.suggestion,
        verification_status=finding.verification_status,
        source_engine=finding.source_engine,
        resolution=finding.resolution,
        resolution_reason=finding.resolution_reason
    )
