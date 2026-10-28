"""
Knowledge base CRUD and evidence lookup router.
"""
from typing import List, Dict, Any, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import User, Rule, Fact
from ..schemas import RuleOut, FactOut
from ..deps import require_roles, get_current_user
from ..services.workflow import write_audit_log
from ..engine.evidence import resolve_evidence
from ..services.audit_orchestrator import serialize_rule, serialize_fact

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

@router.get("/rules", response_model=List[RuleOut])
def list_rules(
    user: User = Depends(require_roles("creator", "agency", "reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    rules = db.query(Rule).all()
    return [RuleOut.model_validate(r) for r in rules]

@router.get("/facts", response_model=List[FactOut])
def list_facts(
    user: User = Depends(require_roles("creator", "agency", "reviewer", "brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    facts = db.query(Fact).all()
    results = []
    is_agency = (user.role == "agency")
    for f in facts:
        item = FactOut.model_validate(f)
        if is_agency and f.kind != "substantiation":
            item.statement = "[REDACTED: Confidential internal statement]"
        results.append(item)
    return results

@router.get("/facts/{id}", response_model=FactOut)
def get_fact(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    fact = db.query(Fact).filter(Fact.id == id).first()
    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Fact '{id}' not found", "details": {"id": id}}}
        )
    item = FactOut.model_validate(fact)
    if user.role == "agency" and fact.kind != "substantiation":
        item.statement = "[REDACTED: Confidential internal statement]"
    return item

@router.get("/rules/{id}", response_model=RuleOut)
def get_rule(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(Rule).filter(Rule.id == id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Rule '{id}' not found", "details": {"id": id}}}
        )
    return RuleOut.model_validate(rule)

@router.get("/evidence/{id}")
def get_evidence(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rules = {r.id: serialize_rule(r) for r in db.query(Rule).all()}
    facts = {f.id: serialize_fact(f) for f in db.query(Fact).all()}

    evidence = resolve_evidence(id, rules, facts, is_agency=(user.role == "agency"))
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": f"Evidence record '{id}' not found", "details": {"id": id}}}
        )
    return evidence

@router.post("/rules", response_model=RuleOut)
def create_rule(
    payload: Dict[str, Any],
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    rule = Rule(
        id=payload["id"],
        type=payload["type"],
        pattern=payload.get("pattern", {}),
        severity=payload["severity"],
        message=payload["message"],
        suggestion=payload.get("suggestion"),
        tags=payload.get("tags", []),
        status="current",
        last_reviewed=date.today()
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    write_audit_log(db, actor_id=user.id, action="knowledge.create", object_type="rule", object_id=rule.id)
    return RuleOut.model_validate(rule)

@router.put("/rules/{id}", response_model=RuleOut)
def update_rule(
    id: str,
    payload: Dict[str, Any],
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    rule = db.query(Rule).filter(Rule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Rule not found", "details": {}}})

    rule.message = payload.get("message", rule.message)
    rule.suggestion = payload.get("suggestion", rule.suggestion)
    rule.severity = payload.get("severity", rule.severity)
    rule.pattern = payload.get("pattern", rule.pattern)
    rule.tags = payload.get("tags", rule.tags)
    rule.last_reviewed = date.today()  # PUT bumps last_reviewed per spec
    db.commit()
    db.refresh(rule)
    write_audit_log(db, actor_id=user.id, action="knowledge.update", object_type="rule", object_id=rule.id)
    return RuleOut.model_validate(rule)

@router.post("/rules/{id}/retire")
def retire_rule(
    id: str,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    rule = db.query(Rule).filter(Rule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Rule not found", "details": {}}})
    rule.status = "retired"
    db.commit()
    write_audit_log(db, actor_id=user.id, action="knowledge.retire", object_type="rule", object_id=rule.id)
    return {"id": id, "status": "retired"}

@router.post("/facts/{id}/retire")
def retire_fact(
    id: str,
    user: User = Depends(require_roles("brand_manager", "admin")),
    db: Session = Depends(get_db)
):
    fact = db.query(Fact).filter(Fact.id == id).first()
    if not fact:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Fact not found", "details": {}}})
    fact.status = "retired"
    db.commit()
    write_audit_log(db, actor_id=user.id, action="knowledge.retire", object_type="fact", object_id=fact.id)
    return {"id": id, "status": "retired"}
