"""
Admin audit log, demo reset, embedding re-indexing, and activity seed router.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, AuditLog
from ..schemas import AuditLogOut
from ..deps import require_roles
from ..config import settings
from ..seed import seed_database
from ..services.workflow import write_audit_log
from ..services.embedding_service import reindex_all
import sys
import os

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/audit-log", response_model=List[AuditLogOut])
def get_audit_log(
    limit: int = 50,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [AuditLogOut.model_validate(e) for e in entries]

@router.post("/reset-demo")
def reset_demo(
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Demo reset is disabled in production mode.", "details": {}}}
        )

    seed_database(db, force_reset=True)
    from ..seed_demo_submissions import seed_demo_submissions
    seed_demo_submissions(db)
    write_audit_log(db, actor_id=user.id, action="admin.reset", object_type="system", object_id="demo_data")
    return {"status": "ok", "message": "Demo database successfully re-seeded to initial Lumora state"}

@router.post("/reindex-embeddings", status_code=status.HTTP_202_ACCEPTED)
def reindex_embeddings(
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    count = reindex_all(db)
    write_audit_log(db, actor_id=user.id, action="admin.reindex_embeddings", object_type="embeddings", object_id="all", meta={"reindexed": count})
    return {"status": "queued", "queued": count, "message": f"Successfully reindexed {count} knowledge records"}

@router.post("/seed-activity")
def seed_activity(
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Activity seeding is only permitted in DEMO_MODE.", "details": {}}}
        )

    # Import seed_historical_activity cleanly from services
    try:
        from ..services.seed_activity import seed_historical_activity
    except (ImportError, ValueError):
        try:
            from app.services.seed_activity import seed_historical_activity
        except ImportError:
            from scripts.seed_activity import seed_historical_activity

    count = seed_historical_activity(db)
    write_audit_log(db, actor_id=user.id, action="admin.seed_activity", object_type="system", object_id="activity", meta={"created": count})
    return {"status": "ok", "created": count, "message": f"Seeded {count} historical demo submissions with dispute signals"}
