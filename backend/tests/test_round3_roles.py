"""
Round 3 RBAC role matrix and permission boundary tests.
Validates HTTP 403 FORBIDDEN and authorized access across all persona roles on new endpoints.
"""
import pytest
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
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_health_round3_block(client: TestClient):
    """Health check must include Round 3 status dict."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert "round3" in data
    assert "ingestion" in data["round3"]
    assert "vision" in data["round3"]
    assert "semantic" in data["round3"]

@pytest.mark.parametrize("role_email,expected_status", [
    ("creator@lumora.demo", 403),
    ("agency@lumora.demo", 403),
    ("reviewer@lumora.demo", 403),
    ("brand@lumora.demo", 202),
    ("admin@lumora.demo", 202),
])
def test_ingest_document_role_matrix(client: TestClient, role_email: str, expected_status: int):
    headers = get_auth_header(client, role_email)
    files = {"file": ("brand_book.pdf", b"%PDF-1.4 sample content", "application/pdf")}
    res = client.post(
        "/api/knowledge/ingest-document",
        headers=headers,
        data={"title": "Brand Book 2026"},
        files=files
    )
    assert res.status_code == expected_status, f"Expected {expected_status} for {role_email}, got {res.status_code}: {res.text}"

@pytest.mark.parametrize("role_email,expected_status", [
    ("creator@lumora.demo", 403),
    ("agency@lumora.demo", 403),
    ("reviewer@lumora.demo", 403),
    ("brand@lumora.demo", 200),
    ("admin@lumora.demo", 200),
])
def test_pending_proposals_role_matrix(client: TestClient, role_email: str, expected_status: int):
    headers = get_auth_header(client, role_email)
    res = client.get("/api/knowledge/pending-proposals", headers=headers)
    assert res.status_code == expected_status, f"Expected {expected_status} for {role_email}, got {res.status_code}: {res.text}"

@pytest.mark.parametrize("role_email,expected_status", [
    ("creator@lumora.demo", 403),
    ("agency@lumora.demo", 403),
    ("reviewer@lumora.demo", 200),
    ("brand@lumora.demo", 200),
    ("admin@lumora.demo", 200),
])
def test_guideline_gaps_read_matrix(client: TestClient, role_email: str, expected_status: int):
    headers = get_auth_header(client, role_email)
    res = client.get("/api/insights/guideline-gaps", headers=headers)
    assert res.status_code == expected_status, f"Expected {expected_status} for {role_email}, got {res.status_code}: {res.text}"

def test_reviewer_cannot_generate_or_adopt_gaps(client: TestClient):
    """Reviewer has read access to gaps, but cannot generate or adopt."""
    headers = get_auth_header(client, "reviewer@lumora.demo")
    res_gen = client.post("/api/insights/guideline-gaps/generate", headers=headers)
    assert res_gen.status_code == 403
    res_adopt = client.post("/api/insights/guideline-gaps/1/adopt", headers=headers, json={})
    assert res_adopt.status_code == 403

def test_reviewer_cannot_upload_or_delete_assets(client: TestClient):
    """Reviewer cannot upload or delete creative assets."""
    headers = get_auth_header(client, "reviewer@lumora.demo")
    files = {"file": ("banner.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    res_upload = client.post("/api/submissions/1/assets", headers=headers, files=files)
    assert res_upload.status_code == 403
    res_delete = client.delete("/api/assets/1", headers=headers)
    assert res_delete.status_code == 403

def test_reviewer_can_read_submission_assets(client: TestClient):
    """Reviewer can read assets associated with a submission."""
    headers = get_auth_header(client, "reviewer@lumora.demo")
    res = client.get("/api/submissions/1/assets", headers=headers)
    assert res.status_code == 200
