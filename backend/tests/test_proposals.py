"""
API tests for human governance over pending guideline proposals:
accepting (creates live rule/fact + source citation + embeddings) and rejecting.
"""
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.db_migrate import run_migrations
from app.seed import seed_database
from app.models import Rule, Fact, PendingGuidelineProposal

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

def test_proposal_accept_reject_lifecycle(client: TestClient):
    headers = get_auth_header(client, "brand@lumora.demo")

    # 1. Ingest document to generate real proposals
    pdf_bytes = get_doc_bytes("lumora_brand_book_sample.pdf")
    res_ingest = client.post(
        "/api/knowledge/ingest-document",
        headers=headers,
        data={"title": "Brand Book 2026"},
        files={"file": ("lumora_brand_book_sample.pdf", pdf_bytes, "application/pdf")}
    )
    assert res_ingest.status_code in (200, 202)
    doc_id = res_ingest.json()["id"]

    # 2. List pending proposals
    res_proposals = client.get(f"/api/knowledge/pending-proposals?document_id={doc_id}", headers=headers)
    assert res_proposals.status_code == 200
    proposals = res_proposals.json()
    assert len(proposals) >= 2

    prop_to_accept = proposals[0]
    prop_to_reject = proposals[1]

    # 3. Accept proposal 1 -> Creates live rule or fact
    res_accept = client.post(
        f"/api/knowledge/pending-proposals/{prop_to_accept['id']}/accept",
        headers=headers,
        json={"note": "Approved by Brand Governance Board"}
    )
    assert res_accept.status_code == 200
    accepted = res_accept.json()
    assert accepted["status"] == "accepted"
    assert accepted["published_id"] is not None
    assert "Sarah Chen" in accepted["decided_by"]

    # Verify rule or fact exists in DB with citation attached
    db = SessionLocal()
    if accepted["proposal_type"] == "rule":
        record = db.query(Rule).filter(Rule.id == accepted["published_id"]).first()
    else:
        record = db.query(Fact).filter(Fact.id == accepted["published_id"]).first()
    assert record is not None
    assert record.source_citation is not None
    assert "Brand Book 2026" in record.source_citation
    db.close()

    # 4. Attempting to accept already decided proposal returns 409
    res_repeat = client.post(
        f"/api/knowledge/pending-proposals/{prop_to_accept['id']}/accept",
        headers=headers,
        json={}
    )
    assert res_repeat.status_code == 409
    assert res_repeat.json()["error"]["code"] == "PROPOSAL_ALREADY_DECIDED"

    # 5. Reject proposal 2
    res_reject = client.post(
        f"/api/knowledge/pending-proposals/{prop_to_reject['id']}/reject",
        headers=headers,
        json={"reason": "out_of_scope", "note": "Not applicable to social copy"}
    )
    assert res_reject.status_code == 200
    rejected = res_reject.json()
    assert rejected["status"] == "rejected"
    assert rejected["reject_reason"] == "out_of_scope"
    assert rejected["decision_note"] == "Not applicable to social copy"

    # 6. Attempting to reject already decided proposal returns 409
    res_repeat_rej = client.post(
        f"/api/knowledge/pending-proposals/{prop_to_reject['id']}/reject",
        headers=headers,
        json={"reason": "other"}
    )
    assert res_repeat_rej.status_code == 409
    assert res_repeat_rej.json()["error"]["code"] == "PROPOSAL_ALREADY_DECIDED"
