"""
Helper script to populate realistic demo submissions across varied statuses.
Populates the reviewer queue, assets, documents, and insights metrics with meaningful data for judges.
"""
import os
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from .db import SessionLocal
from .models import User, Submission, Version, Review, CreativeAsset, GuidelineDocument, PendingGuidelineProposal, RuleWordingSuggestion, Rule
from .services.audit_orchestrator import run_audit
from .services.asset_service import process_and_save_asset

DEMO_DRAFTS = [
    {
        "title": "Lumora Bedroom Ambience Campaign",
        "author_email": "creator@lumora.demo",
        "body": "Experience the world's best smart lamp! Now available in India and the UK. Truly an innovative product.",
        "status": "in_review",
        "decision": None
    },
    {
        "title": "Q4 Influencer Holiday Gift Guide",
        "author_email": "agency@lumora.demo",
        "body": "Meet the Lumora Smart Lamp with up to 12 hours of battery and award-winning design. Designed for modern living.",
        "status": "approved",
        "decision": "approve",
        "comment": "Perfect, completely compliant with brand guidelines."
    },
    {
        "title": "Black Friday Social Blast",
        "author_email": "creator@lumora.demo",
        "body": "Get the cheap smart bulb today! Hurry, act now for a limited time only!!!",
        "status": "revision_requested",
        "decision": "request_revision",
        "comment": "Tone is too aggressive and uses banned term 'cheap' instead of 'affordable'."
    },
    {
        "title": "Smart Home Integration Featurette",
        "author_email": "agency@lumora.demo",
        "body": "Lumora integrates seamlessly with Alexa and Google Home, backed by our 1-year limited warranty.",
        "status": "approved",
        "decision": "approve",
        "comment": "Accurate technical specifications. Approved."
    },
    {
        "title": "Battery Life Deep-Dive Blog",
        "author_email": "creator@lumora.demo",
        "body": "Our lamp delivers up to 12 hours of illumination, outperforming traditional desktop lights.",
        "status": "in_review",
        "decision": None
    }
]

def seed_demo_submissions(db: Session):
    reviewer = db.query(User).filter(User.email == "reviewer@lumora.demo").first()
    users_by_email = {u.email: u for u in db.query(User).all()}

    for draft_info in DEMO_DRAFTS:
        author = users_by_email.get(draft_info["author_email"])
        if not author:
            continue

        existing = db.query(Submission).filter(Submission.title == draft_info["title"]).first()
        if existing:
            continue

        sub = Submission(
            title=draft_info["title"],
            content_type="social",
            author_id=author.id,
            status=draft_info["status"]
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

        v = Version(
            submission_id=sub.id,
            number=1,
            body=draft_info["body"],
            engines={"rules": "pending", "llm": "disabled"}
        )
        db.add(v)
        db.commit()
        db.refresh(v)

        # Run audit on this version
        run_audit(db, v, actor_id=author.id)

        # If decision is approved/revision_requested, record review
        if draft_info["decision"] and reviewer:
            rev = Review(
                submission_id=sub.id,
                version_id=v.id,
                reviewer_id=reviewer.id,
                decision=draft_info["decision"],
                comment=draft_info["comment"],
                created_at=datetime.utcnow()
            )
            db.add(rev)
            db.commit()

    # 1. Seed baseline CreativeAsset on the first submission if none exists
    first_sub = db.query(Submission).order_by(Submission.id.asc()).first()
    if first_sub and not db.query(CreativeAsset).first():
        creator_user = first_sub.author or users_by_email.get("creator@lumora.demo")
        candidate_asset_paths = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "seed", "assets", "lumora_bad_palette.png")),
            os.path.abspath(os.path.join("data", "seed", "assets", "lumora_bad_palette.png")),
            os.path.abspath(os.path.join("..", "data", "seed", "assets", "lumora_bad_palette.png")),
        ]
        asset_bytes = None
        for p in candidate_asset_paths:
            if os.path.exists(p):
                with open(p, "rb") as f:
                    asset_bytes = f.read()
                break

        if asset_bytes and creator_user:
            try:
                process_and_save_asset(
                    db=db,
                    submission_id=first_sub.id,
                    filename="lumora_bad_palette.png",
                    raw_bytes=asset_bytes,
                    user=creator_user
                )
            except Exception as exc:
                print(f"Warning: Failed to seed demo asset: {exc}")

    # 2. Seed baseline GuidelineDocument and PendingGuidelineProposals if none exist
    if not db.query(GuidelineDocument).first():
        brand_mgr = users_by_email.get("brand_manager@lumora.demo") or db.query(User).filter(User.role == "brand_manager").first()
        if brand_mgr:
            doc_sha256 = "b7a42b10a1200192837418290123891029381029381203912830192381203912"
            doc = GuidelineDocument(
                title="Lumora Brand Guidelines 2026",
                filename="lumora_brand_book_sample.pdf",
                mime="application/pdf",
                sha256=doc_sha256,
                page_count=4,
                status="ready",
                stage="completed",
                generator="ai",
                chunks_total=1,
                chunks_done=1,
                uploaded_by=brand_mgr.id,
                created_at=datetime.utcnow(),
                finished_at=datetime.utcnow()
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            p1 = PendingGuidelineProposal(
                document_id=doc.id,
                proposal_type="fact",
                payload={
                    "topic": "specifications",
                    "subject": "battery_life",
                    "statement": "Lumora Smart Lamp provides up to 18 hours of continuous battery life on single charge.",
                    "structured_value": {"max_hours": 18},
                    "tags": ["specifications", "hardware"]
                },
                source_page=2,
                source_section="Technical Specifications",
                source_excerpt="Battery life extends up to 18 hours of continuous operation on a single charge.",
                citation="Page 2, Section: Technical Specifications",
                extraction_confidence="high",
                status="pending",
                created_at=datetime.utcnow()
            )
            p2 = PendingGuidelineProposal(
                document_id=doc.id,
                proposal_type="rule",
                payload={
                    "id": "WARRANTY-01",
                    "type": "phrase",
                    "pattern": {"phrases": ["warranty", "hardware coverage"]},
                    "name": "Warranty Reference Standards",
                    "severity": "medium",
                    "message": "Always state the 1-year limited warranty when referencing hardware coverage.",
                    "suggestion": "Include '1-year limited hardware warranty' in product warranty copy.",
                    "tags": ["legal", "warranty"]
                },
                source_page=3,
                source_section="Warranty & Terms",
                source_excerpt="Warranty coverage is strictly 1-year limited across all territories.",
                citation="Page 3, Section: Warranty & Terms",
                extraction_confidence="high",
                status="pending",
                created_at=datetime.utcnow()
            )
            db.add_all([p1, p2])
            db.commit()

    # 3. Seed baseline RuleWordingSuggestion (ID 1) if none exists
    if not db.query(RuleWordingSuggestion).first():
        claim_rule = db.query(Rule).filter(Rule.id == "CLAIM-01").first() or db.query(Rule).first()
        if claim_rule:
            sugg1 = RuleWordingSuggestion(
                rule_id=claim_rule.id,
                input_hash="demo_seed_gap_hash_claim_01",
                stats={
                    "fired": 14,
                    "dismissed": 6,
                    "overridden": 1,
                    "dismissal_rate": 0.429,
                    "last_reviewed": str(claim_rule.last_reviewed) if claim_rule.last_reviewed else None
                },
                clusters=[
                    {
                        "label": "Superlative claims in consumer social copy",
                        "count": 5,
                        "examples": ["world's best lamp", "finest lighting in the market"],
                        "reasons": ["Contextually approved by legal for seasonal promotions"]
                    }
                ],
                current_wording={
                    "message": claim_rule.message,
                    "suggestion": claim_rule.suggestion,
                    "patterns": claim_rule.pattern or {},
                    "added_exceptions": []
                },
                proposed_wording={
                    "message": "Superlative claims require legal substantiation documentation before publication.",
                    "suggestion": "Replace superlative statements with verified product metrics unless legal clearance is attached.",
                    "patterns": {
                        "phrases": ["world's best", "finest", "number one"],
                        "exceptions": ["award-winning", "industry standard"]
                    },
                    "rationale": "Clarifies exceptions for verified awards while preserving core consumer protection standard."
                },
                rationale="Refined to eliminate recurring false-positive dismissals around verified industry awards.",
                generator="heuristic",
                status="pending",
                created_at=datetime.utcnow()
            )
            db.add(sugg1)
            db.commit()

    print("Demo submissions, assets, guideline documents, and gap suggestions successfully populated!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo_submissions(db)
    finally:
        db.close()
