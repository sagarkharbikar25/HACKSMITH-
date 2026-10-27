"""
Admin audit log and demo reset router.
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
    user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db)
):
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Demo reset is disabled in production mode.", "details": {}}}
        )

    seed_database(db, force_reset=True)
    write_audit_log(db, actor_id=user.id, action="admin.reset", object_type="system", object_id="demo_data")
    return {"status": "ok", "message": "Demo database successfully re-seeded to initial Lumora state"}
