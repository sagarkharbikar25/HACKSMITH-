"""
Comprehensive end-to-end scenario test validating the complete Lumora workflow,
gates, role-based security, versioning, reviewer approvals, and audit trail.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.seed import seed_database

@pytest.fixture(scope="module")
def client():
    # Setup clean in-memory / test SQLite DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db, force_reset=True)
    db.close()

    with TestClient(app) as test_client:
        yield test_client

def test_full_lumora_lifecycle(client: TestClient):
    # 1. Login as Creator
    login_res = client.post("/api/auth/login", json={"email": "creator@lumora.demo", "password": "demo1234"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    creator_token = login_res.json()["token"]
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # 2. Get samples
    samples_res = client.get("/api/samples", headers=creator_headers)
    assert samples_res.status_code == 200
    samples = samples_res.json()
    assert len(samples) >= 1
    sample1 = samples[0]

    # 3. Create Draft Submission (Round 1 Lumora Caption)
    sub_res = client.post(
        "/api/submissions",
        headers=creator_headers,
        json={"title": "Lumora Launch Demo", "content_type": "social", "body": sample1["body"]}
    )
    assert sub_res.status_code == 201
    sub_data = sub_res.json()
    sub_id = sub_data["id"]
    assert sub_data["status"] == "draft"
    assert len(sub_data["versions"]) == 1

    # 4. Run Audit on Version 1
    audit_res = client.post(f"/api/submissions/{sub_id}/audit", headers=creator_headers)
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["version"] == 1
    assert audit_data["engines"]["rules"] == "ran"
    assert len(audit_data["findings"]) == 3

    critical_finding = next(f for f in audit_data["findings"] if f["severity"] == "critical")
    high_finding = next(f for f in audit_data["findings"] if f["severity"] == "high")
    assert critical_finding["evidence"]["id"] == "AF-014"
    assert high_finding["evidence"]["id"] == "CLAIM-01"

    # 5. Submit Gate: Attempt to submit with open critical/high findings
    gate_res = client.post(f"/api/submissions/{sub_id}/submit", headers=creator_headers)
    assert gate_res.status_code == 422
    assert gate_res.json()["error"]["code"] == "CANNOT_SUBMIT_OPEN_FINDINGS"

    # 6. Dismiss Gate: Attempt to dismiss critical finding
    dismiss_crit_res = client.patch(
        f"/api/findings/{critical_finding['id']}",
        headers=creator_headers,
        json={"resolution": "dismissed", "reason": "We want to test US demand anyway"}
    )
    assert dismiss_crit_res.status_code == 422
    assert dismiss_crit_res.json()["error"]["code"] == "CANNOT_DISMISS_CRITICAL"

    # 7. Apply corrections and create Version 2
    clean_body = (
        "Experience the leading smart lamp! Now available in India and the UK for an unbelievable price of just $49. "
        "It's truly an innovative product with award-winning design!"
    )
    v2_res = client.post(
        f"/api/submissions/{sub_id}/versions",
        headers=creator_headers,
        json={"body": clean_body}
    )
    assert v2_res.status_code == 200
    v2_audit = v2_res.json()
    assert v2_audit["version"] == 2
    # Verify no open critical or high findings remain
    open_blockers = [f for f in v2_audit["findings"] if f["severity"] in ("critical", "high") and f["resolution"] == "open"]
    assert len(open_blockers) == 0

    # 8. Submit Gate: Now passes!
    submit_res = client.post(f"/api/submissions/{sub_id}/submit", headers=creator_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "in_review"

    # 9. Reviewer Login & Approval
    rev_login = client.post("/api/auth/login", json={"email": "reviewer@lumora.demo", "password": "demo1234"})
    assert rev_login.status_code == 200
    reviewer_token = rev_login.json()["token"]
    reviewer_headers = {"Authorization": f"Bearer {reviewer_token}"}

    decision_res = client.post(
        f"/api/submissions/{sub_id}/decision",
        headers=reviewer_headers,
        json={"decision": "approve", "comment": "All factual errors and superlatives corrected. Approved."}
    )
    assert decision_res.status_code == 200
    assert decision_res.json()["decision"] == "approve"

    # 10. Check Submission status is now Approved
    sub_check = client.get(f"/api/submissions/{sub_id}", headers=creator_headers)
    assert sub_check.status_code == 200
    assert sub_check.json()["status"] == "approved"

    # 11. Lockout Gate: Cannot add versions to approved submission
    locked_res = client.post(
        f"/api/submissions/{sub_id}/versions",
        headers=creator_headers,
        json={"body": "Another edit attempt"}
    )
    assert locked_res.status_code == 409
    assert locked_res.json()["error"]["code"] == "SUBMISSION_LOCKED"

    # 12. Admin & Insights check
    admin_login = client.post("/api/auth/login", json={"email": "admin@lumora.demo", "password": "demo1234"})
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['token']}"}

    insights_res = client.get("/api/insights/recurring", headers=admin_headers)
    assert insights_res.status_code == 200
    insights = insights_res.json()
    assert insights["totals"]["submissions"] >= 1
    assert insights["totals"]["approved"] >= 1

    audit_res = client.get("/api/admin/audit-log", headers=admin_headers)
    assert audit_res.status_code == 200
    log_actions = [entry["action"] for entry in audit_res.json()]
    assert "submission.create" in log_actions
    assert "audit.run" in log_actions
    assert "submission.submit" in log_actions
    assert "review.approve" in log_actions

    # 13. Role matrix verification: Creator cannot access admin audit-log
    forbidden_res = client.get("/api/admin/audit-log", headers=creator_headers)
    assert forbidden_res.status_code == 403
    assert forbidden_res.json()["error"]["code"] == "FORBIDDEN"
