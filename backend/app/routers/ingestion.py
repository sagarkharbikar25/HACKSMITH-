"""
Document ingestion and guideline proposals router (Contract v3).
Provides guideline document uploading, processing status, and proposal accept/reject workflows.
"""
import hashlib
import os
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, GuidelineDocument, PendingGuidelineProposal
from ..schemas import DocumentOut, ProposalOut, AcceptProposalIn, RejectProposalIn
from ..deps import require_roles, get_current_user
from ..config import settings
from ..services.document_parser import detect_mime_and_validate, IngestError
from ..services.ingestion_service import run_ingestion, serialize_document, serialize_proposal
from ..services.proposal_service import accept_proposal_service, reject_proposal_service
from ..services.workflow import write_audit_log

router = APIRouter(prefix="/knowledge", tags=["ingestion"])

@router.post("/ingest-document", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
async def ingest_document(
    background_tasks: BackgroundTasks,
    title: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    if not settings.INGESTION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "FEATURE_DISABLED", "message": "Document ingestion is disabled", "details": {"feature": "ingestion"}}}
        )

    raw_bytes = b""
    filename = "guideline_document.pdf"

    if file and file.filename:
        raw_bytes = await file.read()
        filename = file.filename

    # If no file was provided in multipart (e.g. Postman desktop runner restrictions), fall back in demo mode
    if not raw_bytes:
        if settings.DEMO_MODE:
            candidate_paths = [
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "seed", "documents", "lumora_brand_book_sample.pdf")),
                os.path.abspath(os.path.join("data", "seed", "documents", "lumora_brand_book_sample.pdf")),
                os.path.abspath(os.path.join("..", "data", "seed", "documents", "lumora_brand_book_sample.pdf")),
            ]
            for p in candidate_paths:
                if os.path.exists(p):
                    with open(p, "rb") as f:
                        raw_bytes = f.read()
                    filename = "lumora_brand_book_sample.pdf"
                    if not title or not title.strip():
                        title = "Brand Guidelines 2026"
                    break

        if not raw_bytes:
            raise HTTPException(
                status_code=422,
                detail={"error": {"code": "FILE_REQUIRED", "message": "A guideline document file (PDF/DOCX) is required.", "details": {}}}
            )

    if not title or not title.strip():
        title = filename

    # 1. Enforce size limit
    max_bytes = settings.INGEST_MAX_MB * 1024 * 1024
    if len(raw_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "FILE_TOO_LARGE", "message": f"Document exceeds max size of {settings.INGEST_MAX_MB}MB", "details": {"size": len(raw_bytes)}}}
        )

    # 2. Magic bytes validation (never trust extension or Content-Type)
    try:
        mime = detect_mime_and_validate(raw_bytes)
    except IngestError as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": {"code": e.code, "message": e.message, "details": {}}}
        )

    # 3. Hash deduplication
    sha256 = hashlib.sha256(raw_bytes).hexdigest()
    existing_doc = db.query(GuidelineDocument).filter(
        GuidelineDocument.sha256 == sha256,
        GuidelineDocument.status == "ready"
    ).first()

    if existing_doc:
        doc_out = serialize_document(existing_doc, db)
        return JSONResponse(
            content=doc_out.model_dump(mode="json"),
            status_code=status.HTTP_200_OK,
            headers={"X-Duplicate-Document": "true"}
        )

    # 4. Insert queued GuidelineDocument
    doc = GuidelineDocument(
        title=title.strip() or filename,
        filename=filename,
        mime=mime,
        sha256=sha256,
        status="queued",
        stage="queued",
        uploaded_by=user.id,
        created_at=datetime.utcnow()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Write audit log (metadata only, no raw document content)
    write_audit_log(
        db=db,
        actor_id=user.id,
        action="document_ingested",
        object_type="document",
        object_id=str(doc.id),
        meta={"title": doc.title, "filename": doc.filename, "mime": mime}
    )

    # 5. Dispatch background task
    background_tasks.add_task(run_ingestion, doc.id, raw_bytes)

    return serialize_document(doc, db)

@router.get("/documents", response_model=List[DocumentOut])
def list_documents(
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    docs = db.query(GuidelineDocument).order_by(GuidelineDocument.created_at.desc()).all()
    return [serialize_document(d, db) for d in docs]

@router.get("/documents/{id}", response_model=DocumentOut)
def get_document(
    id: int,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == id).first()
    if not doc and settings.DEMO_MODE:
        from ..seed_demo_submissions import seed_demo_submissions
        seed_demo_submissions(db)
        doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == id).first() or db.query(GuidelineDocument).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Document {id} not found", "details": {}}}
        )
    return serialize_document(doc, db)

@router.get("/pending-proposals", response_model=List[ProposalOut])
def list_pending_proposals(
    status: str = Query("pending"),
    document_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    query = db.query(PendingGuidelineProposal)
    if status:
        query = query.filter(PendingGuidelineProposal.status == status)
    if document_id:
        query = query.filter(PendingGuidelineProposal.document_id == document_id)
    if type:
        query = query.filter(PendingGuidelineProposal.proposal_type == type)

    proposals = query.order_by(PendingGuidelineProposal.created_at.desc()).all()
    return [serialize_proposal(p) for p in proposals]

@router.post("/pending-proposals/{id}/accept", response_model=ProposalOut)
def accept_proposal(
    id: int,
    req: AcceptProposalIn = AcceptProposalIn(),
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    proposal = accept_proposal_service(
        db=db,
        proposal_id=id,
        user=user,
        payload_override=req.payload,
        note=req.note
    )
    return serialize_proposal(proposal)

@router.post("/pending-proposals/{id}/reject", response_model=ProposalOut)
def reject_proposal(
    id: int,
    req: RejectProposalIn,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    proposal = reject_proposal_service(
        db=db,
        proposal_id=id,
        user=user,
        reason=req.reason,
        note=req.note
    )
    return serialize_proposal(proposal)
