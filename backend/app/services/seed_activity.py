"""
Seed activity service:
Populates historical submissions, audit findings, reviewer decisions, and dismissal signals
so that rule CLAIM-01 has >= 8 firings with >= 5 dismissals, guaranteeing the guideline-gap
analytics card displays actionable data for demo and evaluation.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import User, Submission, Version, Finding, Review
from .audit_orchestrator import run_audit

ACTIVITY_TEMPLATES = [
    ("Design System Best Practices v1", "We adhere strictly to industry best practices in all smart lamp engineering.", True),
    ("Design System Best Practices v2", "Our design follows leading best practices for ambient illumination.", True),
    ("Engineering Standards Whitepaper", "Engineering adheres to best practices and thermal safety regulations.", True),
    ("Sustainability Best Practices", "Lumora champions manufacturing best practices to reduce electronic waste.", True),
    ("Best-in-Class Hardware Summary", "Built using best-in-class components and precision laser-cut glass.", True),
    ("Best Practices in Clean Code", "Our firmware implements best practices for wireless mesh synchronization.", True),
    ("Global Logistics Protocol", "Distribution follows logistics best practices across North American centers.", True),
    ("Q3 Studio Lighting Guide", "World's best ambient glow for creative studios and remote work desks.", False),
    ("Holiday Flash Sale Pitch", "Never settle for less than the world's best desktop illumination.", False),
    ("Ergonomic Lighting Brief", "Engineered according to ergonomic best practices for eye strain reduction.", True),
    ("Retail Partner Onboarding", "Retail displays must follow merchandising best practices.", True),
    ("Customer Care Handbook", "Support teams apply customer service best practices for warranty inquiries.", True),
    ("Packaging Quality Review", "Eco-friendly packaging adheres to international shipping best practices.", True),
    ("Annual Brand Audit", "Lumora is the world's best smart lamp in modern home decor.", False),
]

def seed_historical_activity(db: Session) -> int:
    creator = db.query(User).filter(User.email == "creator@lumora.demo").first()
    reviewer = db.query(User).filter(User.email == "reviewer@lumora.demo").first()
    if not creator or not reviewer:
        return 0

    count = 0
    for title, body, dismiss_superlative in ACTIVITY_TEMPLATES:
        # Check if already seeded by title
        existing = db.query(Submission).filter(Submission.title == title).first()
        if existing:
            continue

        sub = Submission(
            title=title,
            content_type="social",
            author_id=creator.id,
            status="approved" if dismiss_superlative else "in_review",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

        ver = Version(
            submission_id=sub.id,
            number=1,
            body=body,
            created_at=datetime.utcnow()
        )
        db.add(ver)
        db.commit()
        db.refresh(ver)

        # Run audit to generate findings
        run_audit(db=db, version=ver, actor_id=creator.id)

        # Mark dismissals on CLAIM-01
        if dismiss_superlative:
            findings = db.query(Finding).filter(
                Finding.version_id == ver.id,
                Finding.evidence_id == "CLAIM-01"
            ).all()
            for f in findings:
                f.resolution = "dismissed"
                f.resolution_reason = "Standard methodology language ('best practices'), not an unsubstantiated product claim."
                f.resolved_by = reviewer.id
                f.resolved_at = datetime.utcnow()

            # Record review decision with override or approval
            rev = Review(
                submission_id=sub.id,
                version_id=ver.id,
                reviewer_id=reviewer.id,
                decision="approve",
                comment="Compliant. Acceptable use of technical/methodological terminology.",
                override_reason="Best practices terminology permitted under design governance."
            )
            db.add(rev)
            db.commit()

        count += 1

    return count

