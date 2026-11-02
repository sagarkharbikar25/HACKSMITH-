"""
API tests for document ingestion, background parsing, chunking, and proposal creation.
"""
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.db_migrate import run_migrations
from app.seed import seed_database
from app.models import GuidelineDocument, PendingGuidelineProposal

def get_doc_bytes(filename: str) -> bytes:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "seed", "documents", filename),
        os.path.join(os.getcwd(), "data", "seed", "documents", filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            with open(p, "rb") as f:
                return f.read()
    raise FileNotFoundError(f"Document fixture not found: {filename}")

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

def test_ingest_pdf_lifecycle(client: TestClient):
    headers = get_auth_header(client, "brand@lumora.demo")
    pdf_bytes = get_doc_bytes("lumora_brand_book_sample.pdf")

    files = {"file": ("lumora_brand_book_sample.pdf", pdf_bytes, "application/pdf")}
    data = {"title": "Lumora Brand Book 2026"}

    # 1. Ingest PDF -> Returns 202 Accepted
    res = client.post("/api/knowledge/ingest-document", headers=headers, data=data, files=files)
    assert res.status_code == 202
    doc_data = res.json()
    doc_id = doc_data["id"]
    assert doc_data["title"] == "Lumora Brand Book 2026"
    assert doc_data["mime"] == "application/pdf"

    # In TestClient, BackgroundTasks executes before request completes
    # 2. Verify document status is ready and proposals are generated
    res_get = client.get(f"/api/knowledge/documents/{doc_id}", headers=headers)
    assert res_get.status_code == 200
    doc_status = res_get.json()
    if doc_status["status"] != "ready":
        print(f"DEBUG DOC ERROR: {doc_status.get('error_code')} - {doc_status.get('error_message')}")
    assert doc_status["status"] == "ready"
    assert doc_status["page_count"] == 4
    assert doc_status["chunks_total"] >= 1
    assert doc_status["proposal_counts"]["pending"] >= 1

    # 3. Test deduplication: Ingesting identical file returns 200 with X-Duplicate-Document: true
    res_dup = client.post("/api/knowledge/ingest-document", headers=headers, data=data, files=files)
    assert res_dup.status_code == 200
    assert res_dup.headers.get("x-duplicate-document") == "true"
    assert res_dup.json()["id"] == doc_id

def test_ingest_docx_lifecycle(client: TestClient):
    headers = get_auth_header(client, "brand@lumora.demo")
    docx_bytes = get_doc_bytes("lumora_guidelines.docx")

    files = {"file": ("lumora_guidelines.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"title": "Lumora Voice Guidelines"}

    res = client.post("/api/knowledge/ingest-document", headers=headers, data=data, files=files)
    assert res.status_code == 202
    doc_id = res.json()["id"]

    res_get = client.get(f"/api/knowledge/documents/{doc_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["status"] == "ready"
    assert res_get.json()["proposal_counts"]["pending"] >= 1

def test_ingest_unsupported_file_type(client: TestClient):
    headers = get_auth_header(client, "brand@lumora.demo")
    files = {"file": ("notes.txt", b"plain text with no PDF magic", "text/plain")}
    data = {"title": "Notes"}

    res = client.post("/api/knowledge/ingest-document", headers=headers, data=data, files=files)
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
