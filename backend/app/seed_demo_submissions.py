"""
Helper script to populate realistic demo submissions across varied statuses.
Populates the reviewer queue and insights metrics with meaningful data for judges.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from .db import SessionLocal
from .models import User, Submission, Version, Review
from .services.audit_orchestrator import run_audit

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

    print("Demo submissions successfully populated!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo_submissions(db)
    finally:
        db.close()
