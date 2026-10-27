"""
Idempotent database seeding on application boot.
"""
import os
import json
from datetime import date, datetime
from sqlalchemy.orm import Session
from .models import User, Rule, Fact, Submission, Version, Finding
from .security import hash_password

def get_seed_path(filename: str) -> str:
    # Look in data/seed/ relative to project root or local directory
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "seed", filename),
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "seed", filename),
        os.path.join("data", "seed", filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]

def seed_database(db: Session, force_reset: bool = False):
    """
    Seeds initial users, rules, facts, and sample submissions idempotently.
    """
    if force_reset:
        db.query(Finding).delete()
        db.query(Version).delete()
        db.query(Submission).delete()
        db.query(Rule).delete()
        db.query(Fact).delete()
        db.query(User).delete()
        db.commit()

    # 1. Seed Users
    users_file = get_seed_path("users.json")
    if os.path.exists(users_file):
        with open(users_file, "r", encoding="utf-8") as f:
            user_data = json.load(f)
        for u in user_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                db_user = User(
                    id=u.get("id"),
                    email=u["email"],
                    name=u["name"],
                    role=u["role"],
                    password_hash=hash_password(u.get("password_plain", "demo1234")),
                    created_at=datetime.utcnow()
                )
                db.add(db_user)
        db.commit()

    # 2. Seed Rules
    rules_file = get_seed_path("rules.json")
    if os.path.exists(rules_file):
        with open(rules_file, "r", encoding="utf-8") as f:
            rules_data = json.load(f)
        for r in rules_data:
            existing = db.query(Rule).filter(Rule.id == r["id"]).first()
            l_rev = date.fromisoformat(r["last_reviewed"]) if r.get("last_reviewed") else date.today()
            if not existing:
                db_rule = Rule(
                    id=r["id"],
                    type=r["type"],
                    pattern=r["pattern"],
                    severity=r["severity"],
                    message=r["message"],
                    suggestion=r.get("suggestion"),
                    tags=r.get("tags", []),
                    status=r.get("status", "current"),
                    last_reviewed=l_rev
                )
                db.add(db_rule)
            else:
                existing.pattern = r["pattern"]
                existing.severity = r["severity"]
                existing.message = r["message"]
                existing.suggestion = r.get("suggestion")
                existing.tags = r.get("tags", [])
                existing.status = r.get("status", "current")
        db.commit()

    # 3. Seed Facts
    facts_file = get_seed_path("facts.json")
    if os.path.exists(facts_file):
        with open(facts_file, "r", encoding="utf-8") as f:
            facts_data = json.load(f)
        for fc in facts_data:
            existing = db.query(Fact).filter(Fact.id == fc["id"]).first()
            l_rev = date.fromisoformat(fc["last_reviewed"]) if fc.get("last_reviewed") else date.today()
            v_from = date.fromisoformat(fc["valid_from"]) if fc.get("valid_from") else date.today()
            if not existing:
                db_fact = Fact(
                    id=fc["id"],
                    topic=fc["topic"],
                    subject=fc["subject"],
                    aliases=fc.get("aliases", []),
                    statement=fc["statement"],
                    structured_value=fc.get("structured_value", {}),
                    valid_from=v_from,
                    last_reviewed=l_rev,
                    status=fc.get("status", "current"),
                    tags=fc.get("tags", []),
                    kind=fc.get("kind", "fact")
                )
                db.add(db_fact)
            else:
                existing.statement = fc["statement"]
                existing.structured_value = fc.get("structured_value", {})
                existing.status = fc.get("status", "current")
                existing.tags = fc.get("tags", [])
                existing.kind = fc.get("kind", "fact")
        db.commit()
