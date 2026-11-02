"""
Role security matrix and permission boundary tests.
Validates HTTP 403 FORBIDDEN and data redactions across all personas.
"""
import sys
import os

# Ensure backend root is on sys.path for app imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    import pytest
except ImportError:
    # Graceful fallback when pytest is not installed in the active environment
    class _DummyPytest:
        @staticmethod
        def fixture(*args, **kwargs):
            def decorator(func):
                return func
            return decorator
    pytest = _DummyPytest()

from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.db_migrate import run_migrations
from app.seed import seed_database

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

def test_creator_cannot_access_admin_or_review_endpoints(client: TestClient):
    """Creator role must be forbidden (403) from admin audit-log and reviewer queue."""
    creator_headers = get_auth_header(client, "creator@lumora.demo")

    # Admin audit log
    res_admin = client.get("/api/admin/audit-log", headers=creator_headers)
    assert res_admin.status_code == 403
    assert res_admin.json()["error"]["code"] == "FORBIDDEN"

    # Reviewer queue
    res_queue = client.get("/api/review/queue", headers=creator_headers)
    assert res_queue.status_code == 403
    assert res_queue.json()["error"]["code"] == "FORBIDDEN"

def test_reviewer_cannot_create_submissions(client: TestClient):
    """Reviewer role is read/decision only; creating drafts must be forbidden (403)."""
    reviewer_headers = get_auth_header(client, "reviewer@lumora.demo")

    res_post = client.post(
        "/api/submissions",
        headers=reviewer_headers,
        json={"title": "Unauthorized Reviewer Campaign", "body": "Content"}
    )
    assert res_post.status_code == 403
    assert res_post.json()["error"]["code"] == "FORBIDDEN"

def test_cross_tenant_creator_isolation(client: TestClient):
    """Creator cannot view or edit drafts created by another user."""
    # creator@lumora.demo is author of seed submissions (id=1, 2)
    creator_headers = get_auth_header(client, "creator@lumora.demo")
    # agency@lumora.demo has a different user ID
    agency_headers = get_auth_header(client, "agency@lumora.demo")

    # 1. Agency creating a draft
    res_create = client.post(
        "/api/submissions",
        headers=agency_headers,
        json={"title": "Confidential Agency Campaign", "body": "Exclusive launch text"}
    )
    assert res_create.status_code in (200, 201)
    agency_sub_id = res_create.json()["id"]

    # 2. Creator attempting to access Agency's draft -> 403 FORBIDDEN
    res_peek = client.get(f"/api/submissions/{agency_sub_id}", headers=creator_headers)
    assert res_peek.status_code == 403
    assert res_peek.json()["error"]["code"] == "FORBIDDEN"
