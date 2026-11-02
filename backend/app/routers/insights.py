"""
Insights, analytics, and guideline-gap optimization router.
Provides compliance health aggregations and guideline wording refinement workflows.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, RuleWordingSuggestion
from ..schemas import InsightsOut, GapSuggestionOut, AdoptWordingIn
from ..deps import require_roles
from ..services.insights_service import (
    get_insights,
    generate_gap_suggestions,
    adopt_suggestion,
    dismiss_suggestion,
    undo_suggestion,
    serialize_gap_suggestion
)
from ..config import settings

router = APIRouter(prefix="/insights", tags=["insights"])

@router.get("/summary", response_model=InsightsOut)
@router.get("/recurring", response_model=InsightsOut)
def fetch_insights(
    user: User = Depends(require_roles("reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    return get_insights(db)

@router.get("/guideline-gaps", response_model=List[GapSuggestionOut])
def get_guideline_gaps(
    user: User = Depends(require_roles("reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    if not settings.GAP_ANALYSIS_ENABLED:
        return []

    # Retrieve cached pending suggestions
    suggestions = db.query(RuleWordingSuggestion).filter(
        RuleWordingSuggestion.status == "pending"
    ).order_by(RuleWordingSuggestion.created_at.desc()).all()

    if not suggestions:
        # Compute if empty
        suggestions = generate_gap_suggestions(db, user)

    return [serialize_gap_suggestion(s, db) for s in suggestions]

@router.post("/guideline-gaps/generate", response_model=List[GapSuggestionOut])
def generate_guideline_gaps(
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    if not settings.GAP_ANALYSIS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "FEATURE_DISABLED", "message": "Gap analysis is disabled", "details": {"feature": "gap_analysis"}}}
        )

    suggestions = generate_gap_suggestions(db, user)
    return [serialize_gap_suggestion(s, db) for s in suggestions]

@router.post("/guideline-gaps/{id}/adopt", response_model=GapSuggestionOut)
def adopt_guideline_gap(
    id: int,
    req: AdoptWordingIn = AdoptWordingIn(),
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    sugg = adopt_suggestion(db, suggestion_id=id, user=user, edited=req.proposed_wording)
    return serialize_gap_suggestion(sugg, db)

@router.post("/guideline-gaps/{id}/dismiss", response_model=GapSuggestionOut)
def dismiss_guideline_gap(
    id: int,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    sugg = dismiss_suggestion(db, suggestion_id=id, user=user)
    return serialize_gap_suggestion(sugg, db)

@router.post("/guideline-gaps/{id}/undo", response_model=GapSuggestionOut)
def undo_guideline_gap(
    id: int,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    sugg = undo_suggestion(db, suggestion_id=id, user=user)
    return serialize_gap_suggestion(sugg, db)
