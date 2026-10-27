"""
Role security matrix and permission boundary tests.
Validates HTTP 403 FORBIDDEN and data redactions across all personas.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.seed import seed_database

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
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

def test_agency_fact_statement_redaction(client: TestClient):
    """Agency role must see redacted internal statements on facts and evidence."""
    agency_headers = get_auth_header(client, "agency@lumora.demo")
    creator_headers = get_auth_header(client, "creator@lumora.demo")

    # 1. Evidence endpoint redaction for internal facts
    res_agency = client.get("/api/knowledge/evidence/AF-014", headers=agency_headers)
    assert res_agency.status_code == 200
    data_agency = res_agency.json()
    assert "[REDACTED" in data_agency["statement"]

    # 2. Creator or Brand Manager sees unredacted text
    res_creator = client.get("/api/knowledge/evidence/AF-014", headers=creator_headers)
    assert res_creator.status_code == 200
    data_creator = res_creator.json()
    assert "[REDACTED" not in data_creator["statement"]
    assert "India and the United Kingdom" in data_creator["statement"]

def test_creator_cannot_access_admin_or_review_endpoints(client: TestClient):
    """Creators cannot access admin audit logs, reset demo, or record reviewer decisions."""
    creator_headers = get_auth_header(client, "creator@lumora.demo")

    # Cannot read audit log
    res1 = client.get("/api/admin/audit-log", headers=creator_headers)
    assert res1.status_code == 403
    assert res1.json()["error"]["code"] == "FORBIDDEN"

    # Cannot reset demo
    res2 = client.post("/api/admin/reset-demo", headers=creator_headers)
    assert res2.status_code == 403
    assert res2.json()["error"]["code"] == "FORBIDDEN"

    # Cannot create/edit rules
    res3 = client.post("/api/knowledge/rules", headers=creator_headers, json={"id": "HACK-01", "type": "phrase"})
    assert res3.status_code == 403
    assert res3.json()["error"]["code"] == "FORBIDDEN"

def test_reviewer_cannot_create_submissions(client: TestClient):
    """Reviewers review content; only creators and agencies create drafts."""
    reviewer_headers = get_auth_header(client, "reviewer@lumora.demo")

    res = client.post(
        "/api/submissions",
        headers=reviewer_headers,
        json={"title": "Unauthorized Draft", "body": "Some text"}
    )
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"

def test_cross_tenant_creator_isolation(client: TestClient):
    """Creator B cannot see or modify Creator A's private draft."""
    creator1_headers = get_auth_header(client, "creator@lumora.demo")
    agency_headers = get_auth_header(client, "agency@lumora.demo")

    # Creator 1 creates a draft
    res1 = client.post(
        "/api/submissions",
        headers=creator1_headers,
        json={"title": "Elena's Private Draft", "body": "Top secret copy"}
    )
    assert res1.status_code == 201
    draft_id = res1.json()["id"]

    # Agency tries to view Elena's draft -> 403 FORBIDDEN
    res_get = client.get(f"/api/submissions/{draft_id}", headers=agency_headers)
    assert res_get.status_code == 403
    assert res_get.json()["error"]["code"] == "FORBIDDEN"
