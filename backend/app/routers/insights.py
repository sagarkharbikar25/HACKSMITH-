"""
Insights and analytics router.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User
from ..schemas import InsightsOut
from ..deps import require_roles
from ..services.insights_service import get_insights

router = APIRouter(prefix="/insights", tags=["insights"])

@router.get("/recurring", response_model=InsightsOut)
def fetch_insights(
    user: User = Depends(require_roles("reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    return get_insights(db)
