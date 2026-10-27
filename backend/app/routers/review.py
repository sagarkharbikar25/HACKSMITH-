"""
Reviewer decision and comments router.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Submission, Version, Review, Comment
from ..schemas import DecisionRequest, ReviewOut, CommentCreate, CommentOut
from ..deps import require_roles, get_current_user
from ..services.workflow import write_audit_log, validate_decision_gate

router = APIRouter(tags=["review"])

@router.post("/submissions/{id}/decision", response_model=ReviewOut)
def record_decision(
    id: int,
    payload: DecisionRequest,
    user: User = Depends(require_roles("reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Submission not found", "details": {}}})

    latest_ver = db.query(Version).filter(Version.submission_id == sub.id).order_by(Version.number.desc()).first()
    if not latest_ver:
        raise HTTPException(status_code=400, detail={"error": {"code": "NO_VERSIONS", "message": "No versions exist to review", "details": {}}})

    # Validate decision gate
    validate_decision_gate(latest_ver, payload.decision, payload.override_reason)

    if payload.decision == "approve":
        sub.status = "approved"
        action_name = "review.approve"
    else:
        sub.status = "revision_requested"
        action_name = "review.request_revision"

    review = Review(
        submission_id=sub.id,
        version_id=latest_ver.id,
        reviewer_id=user.id,
        decision=payload.decision,
        comment=payload.comment,
        override_reason=payload.override_reason
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    write_audit_log(
        db,
        actor_id=user.id,
        action=action_name,
        object_type="submission",
        object_id=str(sub.id),
        meta={"decision": payload.decision, "comment": payload.comment, "override": bool(payload.override_reason)}
    )

    return ReviewOut.model_validate(review)

@router.post("/submissions/{id}/comments", response_model=CommentOut)
def post_comment(
    id: int,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Submission not found", "details": {}}})

    comment = Comment(
        submission_id=sub.id,
        author_id=user.id,
        body=payload.body
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentOut.model_validate(comment)
