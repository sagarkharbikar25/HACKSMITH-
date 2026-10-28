"""
Submissions, versions, audit triggers, and samples router.
"""
import json
import os
import difflib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Submission, Version, Finding, Rule, Fact
from ..schemas import (
    SubmissionCreate, SubmissionOut, SubmissionDetailOut,
    VersionCreate, VersionOut, AuditResultOut, FindingOut, Excerpt, EvidenceRef
)
from ..deps import get_current_user, require_roles
from ..services.workflow import write_audit_log, validate_submission_gate
from ..services.audit_orchestrator import run_audit
from ..seed import get_seed_path

router = APIRouter(tags=["submissions"])

@router.get("/samples")
def get_samples(user: User = Depends(require_roles("creator", "agency", "reviewer", "brand_manager", "admin"))):
    path = get_seed_path("samples.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/submissions", response_model=List[SubmissionOut])
def list_submissions(
    status_filter: Optional[str] = None,
    mine: Optional[bool] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Submission)
    # Role scoping: creator and agency can ONLY see their own submissions
    if user.role in ("creator", "agency") or mine:
        query = query.filter(Submission.author_id == user.id)

    if status_filter:
        query = query.filter(Submission.status == status_filter)

    subs = query.order_by(Submission.updated_at.desc()).all()
    results = []
    for s in subs:
        latest_ver = db.query(Version).filter(Version.submission_id == s.id).order_by(Version.number.desc()).first()
        open_count = 0
        if latest_ver:
            open_count = db.query(Finding).filter(Finding.version_id == latest_ver.id, Finding.resolution == "open").count()

        results.append(
            SubmissionOut(
                id=s.id,
                title=s.title,
                content_type=s.content_type,
                author_id=s.author_id,
                status=s.status,
                created_at=s.created_at,
                updated_at=s.updated_at,
                latest_version=latest_ver.number if latest_ver else None,
                open_findings_count=open_count
            )
        )
    return results

@router.post("/submissions", response_model=SubmissionDetailOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    payload: SubmissionCreate,
    user: User = Depends(require_roles("creator", "agency")),
    db: Session = Depends(get_db)
):
    # 1. Create Submission row
    sub = Submission(
        title=payload.title,
        content_type=payload.content_type,
        author_id=user.id,
        status="draft"
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # 2. Create Version 1 (does NOT audit automatically)
    v1 = Version(
        submission_id=sub.id,
        number=1,
        body=payload.body,
        engines={"rules": "pending", "llm": "disabled"}
    )
    db.add(v1)
    db.commit()
    db.refresh(v1)

    write_audit_log(db, actor_id=user.id, action="submission.create", object_type="submission", object_id=str(sub.id))
    write_audit_log(db, actor_id=user.id, action="version.create", object_type="version", object_id=str(v1.id))

    return get_submission(sub.id, user, db)

@router.get("/submissions/{id}", response_model=SubmissionDetailOut)
def get_submission(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Submission not found", "details": {"id": id}}}
        )

    # Scoping: creator/agency may only see their own
    if user.role in ("creator", "agency") and sub.author_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You can only view your own drafts", "details": {}}}
        )

    latest_ver = db.query(Version).filter(Version.submission_id == sub.id).order_by(Version.number.desc()).first()
    latest_findings = []
    if latest_ver:
        db_findings = db.query(Finding).filter(Finding.version_id == latest_ver.id).order_by(Finding.start).all()
        for f in db_findings:
            latest_findings.append(
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
                        label=f.evidence_id,
                        last_reviewed=None
                    ),
                    suggested_correction=f.suggestion,
                    verification_status=f.verification_status,
                    source_engine=f.source_engine,
                    resolution=f.resolution,
                    resolution_reason=f.resolution_reason
                )
            )

    return SubmissionDetailOut(
        id=sub.id,
        title=sub.title,
        content_type=sub.content_type,
        author_id=sub.author_id,
        status=sub.status,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        versions=[VersionOut.model_validate(v) for v in sub.versions],
        latest_findings=latest_findings,
        reviews=[r for r in sub.reviews],
        comments=[c for c in sub.comments]
    )

@router.post("/submissions/{id}/audit", response_model=AuditResultOut)
def audit_submission(
    id: int,
    user: User = Depends(require_roles("creator", "agency", "reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Submission not found", "details": {}}})

    if user.role in ("creator", "agency") and sub.author_id != user.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not owner", "details": {}}})

    latest_ver = db.query(Version).filter(Version.submission_id == sub.id).order_by(Version.number.desc()).first()
    if not latest_ver:
        raise HTTPException(status_code=400, detail={"error": {"code": "NO_VERSIONS", "message": "No versions exist to audit", "details": {}}})

    result = run_audit(db, latest_ver, actor_id=user.id)
    return result

@router.post("/submissions/{id}/versions", response_model=AuditResultOut)
def create_version(
    id: int,
    payload: VersionCreate,
    user: User = Depends(require_roles("creator", "agency")),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Submission not found", "details": {}}})

    if sub.author_id != user.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not your submission", "details": {}}})

    # Approved submissions are locked
    if sub.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "SUBMISSION_LOCKED", "message": "Approved submissions are locked and immutable.", "details": {}}}
        )

    # Compute next version number
    current_max = db.query(Version).filter(Version.submission_id == sub.id).count()
    new_version_num = current_max + 1

    new_ver = Version(
        submission_id=sub.id,
        number=new_version_num,
        body=payload.body,
        engines={"rules": "pending", "llm": "disabled"}
    )
    db.add(new_ver)
    # If revision requested, moving to new version resets status to draft
    if sub.status == "revision_requested":
        sub.status = "draft"
    db.commit()
    db.refresh(new_ver)

    write_audit_log(db, actor_id=user.id, action="version.create", object_type="version", object_id=str(new_ver.id), meta={"version": new_version_num})

    # Creating a version automatically triggers audit
    result = run_audit(db, new_ver, actor_id=user.id)
    return result

@router.post("/submissions/{id}/submit", response_model=SubmissionDetailOut)
def submit_for_review(
    id: int,
    user: User = Depends(require_roles("creator", "agency")),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Submission not found", "details": {}}})

    if sub.author_id != user.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Not your submission", "details": {}}})

    if sub.status == "approved":
        raise HTTPException(status_code=409, detail={"error": {"code": "SUBMISSION_LOCKED", "message": "Already approved", "details": {}}})

    latest_ver = db.query(Version).filter(Version.submission_id == sub.id).order_by(Version.number.desc()).first()
    if not latest_ver:
        raise HTTPException(status_code=400, detail={"error": {"code": "NO_VERSIONS", "message": "No version to submit", "details": {}}})

    # Validate submit gate
    validate_submission_gate(db, sub, latest_ver)

    sub.status = "in_review"
    db.commit()

    write_audit_log(db, actor_id=user.id, action="submission.submit", object_type="submission", object_id=str(sub.id))
    return get_submission(sub.id, user, db)

@router.get("/submissions/{id}/diff")
def get_submission_diff(
    id: int,
    v1: Optional[int] = None,
    v2: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = db.query(Submission).filter(Submission.id == id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Submission not found"}}
        )

    versions = db.query(Version).filter(Version.submission_id == sub.id).order_by(Version.number.asc()).all()
    if len(versions) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INSUFFICIENT_VERSIONS", "message": "At least 2 versions are required to compute a diff."}}
        )

    ver1 = next((v for v in versions if v.number == v1), versions[0])
    ver2 = next((v for v in versions if v.number == v2), versions[-1])

    lines1 = ver1.body.splitlines(keepends=True)
    lines2 = ver2.body.splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(
        lines1, lines2,
        fromfile=f"Version {ver1.number}",
        tofile=f"Version {ver2.number}"
    ))
    diff_text = "".join(diff_lines)

    return {
        "submission_id": sub.id,
        "v1_number": ver1.number,
        "v2_number": ver2.number,
        "v1_body": ver1.body,
        "v2_body": ver2.body,
        "diff": diff_text
    }
