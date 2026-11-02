"""
Database seeder for users, rules, facts, visual rules, and initial demo data.
"""
import os
import json
from datetime import datetime, date
from sqlalchemy.orm import Session

from .models import (
    User, Rule, Fact, Asset, Submission, Version, Finding,
    Review, Comment, AuditLog,
    Embedding, CreativeAsset, AssetFinding, GuidelineDocument,
    PendingGuidelineProposal, RuleWordingSuggestion
)
from .security import hash_password

def get_seed_path(filename: str) -> str:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "seed", filename),
        os.path.join(os.getcwd(), "data", "seed", filename),
        os.path.join(os.getcwd(), "backend", "data", "seed", filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]

def seed_database(db: Session, force_reset: bool = False):
    """
    Seeds initial users, rules, facts, and sample submissions idempotently.
    Cleans up dependent tables in strict leaf-to-root foreign key order on force_reset.
    """
    if force_reset:
        # Child visual findings and creative assets
        db.query(AssetFinding).delete()
        db.query(CreativeAsset).delete()
        # Knowledge ingestion & proposals
        db.query(PendingGuidelineProposal).delete()
        db.query(GuidelineDocument).delete()
        db.query(RuleWordingSuggestion).delete()
        db.query(Embedding).delete()
        # Reviews and comments MUST be deleted before versions and submissions
        db.query(Review).delete()
        db.query(Comment).delete()
        db.query(Finding).delete()
        db.query(Version).delete()
        db.query(Submission).delete()
        db.query(AuditLog).delete()
        # Rules, facts, assets
        db.query(Rule).delete()
        db.query(Fact).delete()
        db.query(Asset).delete()
        db.commit()

    # 1. Seed Users
    users_file = get_seed_path("users.json")
    if os.path.exists(users_file):
        with open(users_file, "r", encoding="utf-8") as f:
            user_data = json.load(f)
        for u in user_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                kwargs = {
                    "email": u["email"],
                    "name": u["name"],
                    "role": u["role"],
                    "password_hash": hash_password(u.get("password_plain", "demo1234")),
                    "created_at": datetime.utcnow()
                }
                if "id" in u and not db.query(User).filter(User.id == u["id"]).first():
                    kwargs["id"] = u["id"]
                db_user = User(**kwargs)
                db.add(db_user)
        db.commit()

    # 2. Seed Rules
    rules_file = get_seed_path("rules.json")
    if os.path.exists(rules_file):
        with open(rules_file, "r", encoding="utf-8") as f:
            rules_data = json.load(f)
        for r in rules_data:
            existing = db.query(Rule).filter(Rule.id == r["id"]).first()
            if not existing:
                l_rev = date.fromisoformat(r["last_reviewed"]) if "last_reviewed" in r and r["last_reviewed"] else date.today()
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
        db.commit()

    # 2b. Seed Visual Rules (Round 3)
    vis_file = get_seed_path("visual_rules.json")
    if os.path.exists(vis_file):
        with open(vis_file, "r", encoding="utf-8") as f:
            vis_data = json.load(f)
        for r in vis_data:
            existing = db.query(Rule).filter(Rule.id == r["id"]).first()
            if not existing:
                db_rule = Rule(
                    id=r["id"],
                    type=r["type"],
                    pattern=r["pattern"],
                    severity=r["severity"],
                    message=r["message"],
                    suggestion=r.get("suggestion"),
                    tags=r.get("tags", []),
                    status="current",
                    last_reviewed=date.today()
                )
                db.add(db_rule)
        db.commit()

    # 3. Seed Facts
    facts_file = get_seed_path("facts.json")
    if os.path.exists(facts_file):
        with open(facts_file, "r", encoding="utf-8") as f:
            facts_data = json.load(f)
        for fa in facts_data:
            existing = db.query(Fact).filter(Fact.id == fa["id"]).first()
            if not existing:
                v_from = date.fromisoformat(fa["valid_from"]) if "valid_from" in fa and fa["valid_from"] else date.today()
                l_rev = date.fromisoformat(fa["last_reviewed"]) if "last_reviewed" in fa and fa["last_reviewed"] else date.today()
                db_fact = Fact(
                    id=fa["id"],
                    topic=fa["topic"],
                    subject=fa["subject"],
                    aliases=fa.get("aliases", []),
                    statement=fa["statement"],
                    structured_value=fa.get("structured_value", {}),
                    valid_from=v_from,
                    last_reviewed=l_rev,
                    status=fa.get("status", "current"),
                    tags=fa.get("tags", []),
                    kind=fa.get("kind", "fact")
                )
                db.add(db_fact)
        db.commit()
