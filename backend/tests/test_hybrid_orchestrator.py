"""
Tests for hybrid audit orchestrator priority merge, regression contract, and exception resilience.
"""
import pytest
from app.services.audit_orchestrator import run_audit
from app.services.embedding_service import index_record
from app.db import Base, engine, SessionLocal
from app.seed import seed_database
from app.models import Submission, Version, User
from app.config import settings

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db, force_reset=True)
    index_record(db, "rule", "CLAIM-01")
    index_record(db, "rule", "TERM-03")
    index_record(db, "fact", "AF-014")
    yield db
    db.close()

def test_round1_sample_unchanged_with_all_flags_on(db_session):
    """
    Rule R0 Regression Test:
    Round 1 sample MUST yield exactly 3 findings (CLAIM-01, AF-014, TERM-03)
    regardless of whether semantic engine is enabled.
    """
    orig_semantic = settings.SEMANTIC_ENABLED
    settings.SEMANTIC_ENABLED = True
    try:
        user = db_session.query(User).filter(User.role == "creator").first()
        sub = Submission(title="Regression Test", content_type="social", author_id=user.id)
        db_session.add(sub)
        db_session.commit()

        # Canonical Round 1 sample text from samples.json (sample 1)
        r1_body = (
            "Experience the world's best smart lamp! Now available across the US for an unbelievable price of just $49. "
            "It's truly a revolutionary product with award-winning design!"
        )
        ver = Version(submission_id=sub.id, number=1, body=r1_body)
        db_session.add(ver)
        db_session.commit()

        res = run_audit(db_session, ver, actor_id=user.id)
        assert res.summary.total == 3, f"Expected exactly 3 findings on Round 1 sample, got {res.summary.total}"
        finding_ids = {f.evidence.id for f in res.findings}
        assert finding_ids == {"CLAIM-01", "AF-014", "TERM-03"}

        # Deterministic engine priority check: all 3 must be exact rule matches
        for f in res.findings:
            assert f.source_engine == "rules"
            assert f.match_type == "exact"
    finally:
        settings.SEMANTIC_ENABLED = orig_semantic

def test_semantic_finds_paraphrase_when_no_exact_match(db_session):
    """When no exact match exists, semantic engine flags valid paraphrases."""
    orig_semantic = settings.SEMANTIC_ENABLED
    settings.SEMANTIC_ENABLED = True
    try:
        user = db_session.query(User).filter(User.role == "creator").first()
        sub = Submission(title="Paraphrase Test", content_type="social", author_id=user.id)
        db_session.add(sub)
        db_session.commit()

        # Uses pure paraphrase without exact keyword "world's best" or "revolutionary"
        para_body = "Nothing on earth compares to this adaptive illumination gadget for your workstation."
        ver = Version(submission_id=sub.id, number=1, body=para_body)
        db_session.add(ver)
        db_session.commit()

        res = run_audit(db_session, ver, actor_id=user.id)
        assert res.summary.total == 1
        f = res.findings[0]
        assert f.evidence.id == "CLAIM-01"
        assert f.source_engine == "semantic"
        assert f.match_type == "semantic"
        assert f.similarity is not None
        assert f.similarity >= 0.80
    finally:
        settings.SEMANTIC_ENABLED = orig_semantic
