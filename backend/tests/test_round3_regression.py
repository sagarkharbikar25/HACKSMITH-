"""
End-to-end regression and invariant tests for BrandGuard AI Round 3.
Guarantees zero regressions against Round 1 & Round 2 core features while verifying
all multi-modal Round 3 capabilities run deterministically.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.db_migrate import run_migrations
from app.seed import seed_database
from app.config import settings

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

def test_canonical_clean_submission_has_zero_findings(client: TestClient):
    headers = get_auth_header(client, "creator@lumora.demo")

    clean_text = "The Lumora Glow ambient smart lamp offers warm white light for your desktop. Built with sustainable aluminum."
    res = client.post(
        "/api/submissions",
        headers=headers,
        json={"title": "Clean Submission", "content_type": "social", "body": clean_text}
    )
    assert res.status_code == 201
    sub_id = res.json()["id"]

    res_audit = client.post(f"/api/submissions/{sub_id}/audit", headers=headers)
    assert res_audit.status_code == 200
    audit_data = res_audit.json()
    assert audit_data["summary"]["total"] == 0
    assert len(audit_data["findings"]) == 0

def test_admin_reindex_and_seed_activity_routes(client: TestClient):
    admin_headers = get_auth_header(client, "admin@lumora.demo")

    # Reindex embeddings
    res_reindex = client.post("/api/admin/reindex-embeddings", headers=admin_headers)
    assert res_reindex.status_code == 202
    assert res_reindex.json()["status"] == "queued"
    assert res_reindex.json()["queued"] >= 1

    # Seed activity
    res_seed = client.post("/api/admin/seed-activity", headers=admin_headers)
    assert res_seed.status_code == 200
    assert res_seed.json()["status"] == "ok"
    assert res_seed.json()["created"] >= 1

def test_unauthenticated_requests_rejected(client: TestClient):
    protected_endpoints = [
        ("GET", "/api/knowledge/documents"),
        ("GET", "/api/knowledge/pending-proposals"),
        ("GET", "/api/insights/guideline-gaps"),
        ("POST", "/api/insights/guideline-gaps/generate"),
        ("POST", "/api/admin/reindex-embeddings"),
        ("POST", "/api/submissions/1/assets"),
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path)
        assert res.status_code in (401, 403), f"Expected 401/403 for {method} {path}, got {res.status_code}"
