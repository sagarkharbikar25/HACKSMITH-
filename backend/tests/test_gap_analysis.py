"""
API and workflow tests for guideline gap analytics, cluster identification,
wording proposal generation, and adopt / dismiss / undo governance.
"""
from datetime import date
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.db_migrate import run_migrations
from app.seed import seed_database
from app.models import Rule, Finding, RuleWordingSuggestion
try:
    from app.services.seed_activity import seed_historical_activity
except ImportError:
    try:
        from scripts.seed_activity import seed_historical_activity
    except ImportError:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from scripts.seed_activity import seed_historical_activity

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()
    seed_database(db, force_reset=True)
    db.close()
    with TestClient(app) as test_client:
        yield test_client

def get_auth_header(client: TestClient, email: str) -> dict:
    res = client.post("/api/auth/login", json={"email": email, "password": "demo1234"})
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_guideline_gaps_unauthenticated_forbidden(client: TestClient):
    res = client.get("/api/insights/guideline-gaps")
    assert res.status_code == 401

def test_guideline_gaps_creator_forbidden(client: TestClient):
    headers = get_auth_header(client, "creator@lumora.demo")
    res = client.get("/api/insights/guideline-gaps", headers=headers)
    assert res.status_code == 403

def test_guideline_gaps_threshold_insufficient_returns_empty(client: TestClient):
    # Clear suggestions and findings so there is insufficient dispute activity
    db = SessionLocal()
    db.query(RuleWordingSuggestion).delete()
    db.query(Finding).delete()
    db.commit()
    db.close()

    headers = get_auth_header(client, "admin@lumora.demo")
    res = client.get("/api/insights/guideline-gaps", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 0

def test_guideline_gaps_seeded_activity_identifies_claim01(client: TestClient):
    # Seed historical dispute activity
    db = SessionLocal()
    seed_historical_activity(db)
    db.close()

    headers = get_auth_header(client, "admin@lumora.demo")
    res = client.get("/api/insights/guideline-gaps", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1

    gap = next((g for g in data if g["rule_id"] == "CLAIM-01"), None)
    assert gap is not None
    stats = gap.get("stats", {})
    dispute_rate = gap.get("dispute_rate", stats.get("dismissal_rate", 0))
    total_fired = gap.get("total_fired", stats.get("fired", 0))
    assert dispute_rate >= 0.40
    assert total_fired >= 5
    assert gap.get("proposed_wording") is not None

def test_adopt_and_undo_proposal_workflow(client: TestClient):
    headers = get_auth_header(client, "admin@lumora.demo")
    res_gaps = client.get("/api/insights/guideline-gaps", headers=headers)
    data = res_gaps.json()
    gap = next(g for g in data if g["rule_id"] == "CLAIM-01")
    proposal_id = gap.get("proposal_id", gap["id"])

    # 1. Adopt proposal
    res_adopt = client.post(f"/api/insights/guideline-gaps/{proposal_id}/adopt", headers=headers)
    assert res_adopt.status_code == 200
    adopt_data = res_adopt.json()
    assert adopt_data["status"] == "adopted"
    assert adopt_data["rule_id"] == "CLAIM-01"

    # Verify rule was updated in database
    db = SessionLocal()
    r = db.query(Rule).filter(Rule.id == "CLAIM-01").first()
    assert r.previous_wording is not None or "best" in (r.message or "").lower()
    db.close()

    # 2. Undo proposal
    res_undo = client.post(f"/api/insights/guideline-gaps/{proposal_id}/undo", headers=headers)
    assert res_undo.status_code == 200
    undo_data = res_undo.json()
    assert undo_data["status"] in ("pending", "undone")

    # Verify rule reverted
    db = SessionLocal()
    r_rev = db.query(Rule).filter(Rule.id == "CLAIM-01").first()
    assert r_rev.previous_wording is None
    db.close()
