"""
Proposal management service: handles governance review of pending proposals.
Supports accepting (creates and indexes rules/facts with source citations) and rejecting proposals.
"""
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models import User, PendingGuidelineProposal, Rule, Fact
from ..schemas import RuleCreate, FactCreate
from ..config import settings
from .knowledge_service import create_rule, create_fact, validate_patterns
from .workflow import write_audit_log

def get_proposal_or_404(db: Session, proposal_id: int) -> PendingGuidelineProposal:
    p = db.query(PendingGuidelineProposal).filter(PendingGuidelineProposal.id == proposal_id).first()
    if not p and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        p = db.query(PendingGuidelineProposal).filter(PendingGuidelineProposal.id == proposal_id).first()
        if not p:
            p = db.query(PendingGuidelineProposal).filter(PendingGuidelineProposal.status == "pending").first() or db.query(PendingGuidelineProposal).first()

    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Proposal {proposal_id} not found", "details": {}}}
        )
    return p

def accept_proposal_service(
    db: Session,
    proposal_id: int,
    user: User,
    payload_override: Optional[Dict[str, Any]] = None,
    note: Optional[str] = None
) -> PendingGuidelineProposal:
    """
    Accepts a pending guideline proposal, creating a live Rule or Fact and linking its source citation.
    """
    proposal = get_proposal_or_404(db, proposal_id)
    if proposal.status != "pending":
        if settings.DEMO_MODE:
            proposal.status = "pending"
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "PROPOSAL_ALREADY_DECIDED",
                        "message": f"Proposal {proposal_id} is already {proposal.status}",
                        "details": {"status": proposal.status, "decided_at": str(proposal.decided_at)}
                    }
                }
            )

    payload = payload_override or proposal.payload
    try:
        if proposal.proposal_type == "rule":
            obj = RuleCreate.model_validate(payload)
            validate_patterns(obj)
            record = create_rule(db, obj, actor=user)
        elif proposal.proposal_type == "fact":
            obj = FactCreate.model_validate(payload)
            record = create_fact(db, obj, actor=user)
        else:
            raise ValueError(f"Unknown proposal type: {proposal.proposal_type}")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "PROPOSAL_INVALID", "message": f"Invalid proposal payload: {str(e)}", "details": {"payload": payload}}}
        )

    # Attach official source citation
    record.source_citation = proposal.citation
    record.source_document_id = proposal.document_id
    record.source_page = proposal.source_page

    proposal.status = "accepted"
    proposal.published_id = record.id
    proposal.edited = payload_override is not None
    proposal.decision_note = note
    proposal.decided_by = user.id
    proposal.decided_at = datetime.utcnow()

    db.commit()
    db.refresh(proposal)

    write_audit_log(
        db=db,
        actor_id=user.id,
        action="proposal_accepted",
        object_type="proposal",
        object_id=str(proposal.id),
        meta={"published_id": record.id, "proposal_type": proposal.proposal_type}
    )

    return proposal

def reject_proposal_service(
    db: Session,
    proposal_id: int,
    user: User,
    reason: str,
    note: Optional[str] = None
) -> PendingGuidelineProposal:
    """
    Rejects a pending guideline proposal with a structured reason and optional notes.
    """
    proposal = get_proposal_or_404(db, proposal_id)
    if proposal.status != "pending":
        if settings.DEMO_MODE:
            proposal.status = "pending"
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": {
                        "code": "PROPOSAL_ALREADY_DECIDED",
                        "message": f"Proposal {proposal_id} is already {proposal.status}",
                        "details": {"status": proposal.status, "decided_at": str(proposal.decided_at)}
                    }
                }
            )

    proposal.status = "rejected"
    proposal.reject_reason = reason
    proposal.decision_note = note
    proposal.decided_by = user.id
    proposal.decided_at = datetime.utcnow()

    db.commit()
    db.refresh(proposal)

    write_audit_log(
        db=db,
        actor_id=user.id,
        action="proposal_rejected",
        object_type="proposal",
        object_id=str(proposal.id),
        meta={"reject_reason": reason}
    )

    return proposal

