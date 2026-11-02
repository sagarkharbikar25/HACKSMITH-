"""
Knowledge base service managing Rules and Facts creation, validation, and embedding indexing.
"""
from typing import Dict, Any, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from ..models import User, Rule, Fact
from ..schemas import RuleCreate, FactCreate
from .embedding_service import index_record

def validate_patterns(obj: RuleCreate) -> None:
    """Validate rule patterns to prevent ReDoS or invalid schemas."""
    pattern = obj.pattern or {}
    phrases = pattern.get("phrases", [])
    for p in phrases:
        if len(p) > 200:
            raise ValueError(f"Pattern phrase too long: {p[:30]}...")

    if obj.type == "palette":
        colors = pattern.get("colors", [])
        if not colors:
            raise ValueError("Palette rule must specify colors list")
    elif obj.type == "contrast":
        min_ratio = pattern.get("min_ratio", 4.5)
        if min_ratio <= 1.0 or min_ratio > 21.0:
            raise ValueError(f"Invalid WCAG contrast ratio: {min_ratio}")

def create_rule(db: Session, obj: RuleCreate, actor: Optional[User] = None) -> Rule:
    """Creates a new rule, persists it, and triggers vector embedding indexing."""
    rule_id = obj.id
    if not rule_id:
        existing_count = db.query(Rule).count()
        prefix = "RULE"
        if obj.type == "claim":
            prefix = "CLAIM"
        elif obj.type == "term":
            prefix = "TERM"
        elif obj.type == "phrase":
            prefix = "PHRASE"
        elif obj.type == "tone":
            prefix = "TONE"
        elif obj.type == "palette":
            prefix = "VIS"
        elif obj.type == "contrast":
            prefix = "ACC"
        rule_id = f"{prefix}-{existing_count + 1:02d}"

    rule = Rule(
        id=rule_id,
        type=obj.type,
        pattern=obj.pattern,
        severity=obj.severity,
        message=obj.message,
        suggestion=obj.suggestion,
        tags=obj.tags,
        status="current",
        last_reviewed=date.today(),
        created_at=datetime.utcnow()
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    # Index embedding
    index_record(db, "rule", rule.id)
    return rule

def create_fact(db: Session, obj: FactCreate, actor: Optional[User] = None) -> Fact:
    """Creates a new product fact, persists it, and triggers vector embedding indexing."""
    fact_id = obj.id
    if not fact_id:
        existing_count = db.query(Fact).count()
        fact_id = f"AF-{existing_count + 1:03d}"

    fact = Fact(
        id=fact_id,
        topic=obj.topic,
        subject=obj.subject,
        aliases=obj.aliases,
        statement=obj.statement,
        structured_value=obj.structured_value,
        valid_from=obj.valid_from or date.today(),
        last_reviewed=date.today(),
        status=obj.status,
        tags=obj.tags,
        kind=obj.kind
    )
    db.add(fact)
    db.commit()
    db.refresh(fact)

    # Index embedding
    index_record(db, "fact", fact.id)
    return fact

