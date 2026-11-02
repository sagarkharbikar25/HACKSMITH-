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
from app.models import Rule, RuleWordingSuggestion
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
    seed_historical_activity(db)
    db.close()
    with TestClient(app) as test_client:
        yield test_client

def get_auth_header(client: TestClient, email: str) -> dict:
    res = client.post("/api/auth/login", json={"email": email, "password": "demo1234"})
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_gap_analysis_generation_and_governance_lifecycle(client: TestClient):
    headers = get_auth_header(client, "brand@lumora.demo")

    # 1. Trigger Gap Suggestions Generation
    res_gen = client.post("/api/insights/guideline-gaps/generate", headers=headers)
    assert res_gen.status_code == 200
    suggestions = res_gen.json()
    assert len(suggestions) >= 1

    claim_sugg = next((s for s in suggestions if s["rule_id"] == "CLAIM-01"), None)
    assert claim_sugg is not None
    assert claim_sugg["stats"]["fired"] >= 8
    assert claim_sugg["stats"]["dismissed"] >= 5
    assert len(claim_sugg["clusters"]) >= 1
    assert "best" in claim_sugg["clusters"][0]["label"].lower() or "practice" in claim_sugg["clusters"][0]["label"].lower()
    assert claim_sugg["status"] == "pending"

    # 2. List Guideline Gaps
    res_list = client.get("/api/insights/guideline-gaps", headers=headers)
    assert res_list.status_code == 200
    assert any(s["id"] == claim_sugg["id"] for s in res_list.json())

    # 3. Adopt the proposed refinement
    res_adopt = client.post(f"/api/insights/guideline-gaps/{claim_sugg['id']}/adopt", headers=headers)
    assert res_adopt.status_code == 200
    adopted = res_adopt.json()
    assert adopted["status"] == "adopted"

    # Verify rule in DB was updated with new message
    db = SessionLocal()
    rule = db.query(Rule).filter(Rule.id == "CLAIM-01").first()
    assert rule is not None
    assert rule.previous_wording is not None
    assert "Does not apply" in rule.message or "best practice" in rule.message.lower()
    db.close()

    # 4. Undo the adopted refinement
    res_undo = client.post(f"/api/insights/guideline-gaps/{claim_sugg['id']}/undo", headers=headers)
    assert res_undo.status_code == 200
    undone = res_undo.json()
    assert undone["status"] == "undone"

    # Verify rule in DB was restored to original wording
    db = SessionLocal()
    rule_restored = db.query(Rule).filter(Rule.id == "CLAIM-01").first()
    assert rule_restored.previous_wording is None
    db.close()

def test_gap_suggestion_stale_detection(client: TestClient):
    headers = get_auth_header(client, "brand@lumora.demo")

    # Generate a suggestion
    res_gen = client.post("/api/insights/guideline-gaps/generate", headers=headers)
    assert res_gen.status_code == 200
    suggestions = res_gen.json()
    sugg = suggestions[0]

    # Simulate Brand Manager manually editing the rule's last_reviewed date out-of-band
    db = SessionLocal()
    rule = db.query(Rule).filter(Rule.id == sugg["rule_id"]).first()
    rule.last_reviewed = date(2027, 1, 1)
    db.commit()
    db.close()

    # Attempting to adopt now must trigger 409 GAP_SUGGESTION_STALE
    res_adopt = client.post(f"/api/insights/guideline-gaps/{sugg['id']}/adopt", headers=headers)
    assert res_adopt.status_code == 409
    assert res_adopt.json()["error"]["code"] == "GAP_SUGGESTION_STALE"

