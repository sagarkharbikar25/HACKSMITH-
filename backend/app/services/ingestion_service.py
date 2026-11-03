"""
Background ingestion service: coordinates parsing, chunking, proposal extraction, and persistence.
Includes recovery logic for interrupted ingestion tasks.
"""
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import GuidelineDocument, PendingGuidelineProposal
from ..schemas import DocumentOut, ProposalOut, SourceRef
from .document_parser import detect_mime_and_validate, parse_pdf, parse_docx, IngestError
from .chunker import chunk_pages
from ..llm.extraction import extract_proposals_from_chunk

def serialize_proposal(p: PendingGuidelineProposal) -> ProposalOut:
    return ProposalOut(
        id=p.id,
        document_id=p.document_id,
        proposal_type=p.proposal_type,
        payload=p.payload,
        source=SourceRef(
            document_id=p.document_id,
            document_title=p.document.title if p.document else "Document",
            page=p.source_page,
            section=p.source_section,
            citation=p.citation,
            excerpt=p.source_excerpt
        ),
        extraction_confidence=p.extraction_confidence or "medium",
        duplicate_of=p.duplicate_of,
        conflicts_with=p.conflicts_with,
        status=p.status,
        edited=p.edited,
        decision_note=p.decision_note,
        reject_reason=p.reject_reason,
        published_id=p.published_id,
        decided_by=p.decider.name if (getattr(p, "decider", None) and p.decider) else ("Sarah Chen" if p.decided_by else None),
        decided_at=p.decided_at,
        created_at=p.created_at or datetime.utcnow()
    )

def serialize_document(doc: GuidelineDocument, db: Session) -> DocumentOut:
    proposals = db.query(PendingGuidelineProposal).filter(PendingGuidelineProposal.document_id == doc.id).all()
    counts = {
        "pending": sum(1 for p in proposals if p.status == "pending"),
        "accepted": sum(1 for p in proposals if p.status == "accepted"),
        "rejected": sum(1 for p in proposals if p.status == "rejected"),
    }
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        mime=doc.mime,
        page_count=doc.page_count,
        status=doc.status,
        stage=doc.stage or "ready",
        chunks_total=doc.chunks_total or 0,
        chunks_done=doc.chunks_done or 0,
        error_code=doc.error_code,
        error_message=doc.error_message,
        generator=doc.generator or "heuristic",
        proposal_counts=counts,
        uploaded_by=doc.uploader.name if doc.uploader else "Admin",
        created_at=doc.created_at or datetime.utcnow(),
        finished_at=doc.finished_at
    )

def recover_stale_ingestion_jobs(db: Session) -> int:
    """
    Recovers jobs abandoned if the server crashed/restarted while parsing or extracting.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=15)
    stale_docs = db.query(GuidelineDocument).filter(
        GuidelineDocument.status.in_(["queued", "parsing", "extracting"]),
        GuidelineDocument.created_at < cutoff
    ).all()

    for doc in stale_docs:
        doc.status = "failed"
        doc.error_code = "INGEST_INTERRUPTED"
        doc.error_message = "Ingestion job was interrupted by a server restart or timeout."
        doc.stage = "Interrupted"
        doc.finished_at = datetime.utcnow()

    db.commit()
    return len(stale_docs)

def run_ingestion(document_id: int, file_bytes: bytes) -> None:
    """
    Background worker pipeline for guideline documents.
    """
    db = SessionLocal()
    try:
        doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == document_id).first()
        if not doc:
            return

        doc.status = "parsing"
        doc.stage = "Parsing document structure"
        db.commit()

        # 1. Parse pages
        mime = detect_mime_and_validate(file_bytes)
        if mime == "application/pdf":
            pages = parse_pdf(file_bytes)
        else:
            pages = parse_docx(file_bytes)

        doc.page_count = len(pages)
        db.commit()

        # 2. Chunk pages
        chunks = chunk_pages(pages)
        doc.chunks_total = len(chunks)
        doc.chunks_done = 0
        doc.status = "extracting"
        doc.stage = f"Extracting rules (0/{len(chunks)})"
        db.commit()

        # 3. Extract proposals chunk by chunk
        generator_used = "heuristic"
        total_proposals = 0

        for idx, chunk in enumerate(chunks, start=1):
            candidates, gen = extract_proposals_from_chunk(chunk, doc.title, db)
            generator_used = gen

            for cand in candidates:
                if total_proposals >= 40:
                    break
                proposal = PendingGuidelineProposal(
                    document_id=doc.id,
                    proposal_type=cand.proposal_type,
                    payload=cand.payload,
                    source_page=cand.source_page,
                    source_section=cand.source_section,
                    source_excerpt=cand.source_excerpt,
                    citation=cand.citation,
                    extraction_confidence=cand.extraction_confidence,
                    duplicate_of=cand.duplicate_of,
                    conflicts_with=cand.conflicts_with,
                    status="pending"
                )
                db.add(proposal)
                total_proposals += 1

            doc.chunks_done = idx
            doc.stage = f"Extracting rules ({idx}/{len(chunks)})"
            db.commit()

        doc.generator = generator_used
        doc.status = "ready"
        doc.stage = "Ready for review"
        doc.finished_at = datetime.utcnow()
        db.commit()

    except IngestError as ie:
        db.rollback()
        doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == document_id).first()
        if doc:
            doc.status = "failed"
            doc.error_code = ie.code
            doc.error_message = ie.message
            doc.stage = "Failed"
            doc.finished_at = datetime.utcnow()
            db.commit()
    except Exception as exc:
        db.rollback()
        doc = db.query(GuidelineDocument).filter(GuidelineDocument.id == document_id).first()
        if doc:
            doc.status = "failed"
            doc.error_code = "INGEST_FAILED"
            doc.error_message = str(exc)
            doc.stage = "Failed"
            doc.finished_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()
