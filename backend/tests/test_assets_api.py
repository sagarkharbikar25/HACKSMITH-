"""
API tests for creative asset uploads, findings generation, workflow gate enforcement, and asset lifecycle.
"""
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, SessionLocal
from app.db_migrate import run_migrations
from app.seed import seed_database

def get_asset_bytes(filename: str) -> bytes:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "seed", "assets", filename),
        os.path.join(os.getcwd(), "data", "seed", "assets", filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            with open(p, "rb") as f:
                return f.read()
    raise FileNotFoundError(f"Fixture not found: {filename}")

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

def create_draft_submission(client: TestClient, headers: dict) -> int:
    res = client.post(
        "/api/submissions",
        headers=headers,
        json={"title": "Asset Draft", "content_type": "social", "body": "Test submission body"}
    )
    assert res.status_code == 201
    return res.json()["id"]

def test_asset_upload_good_image(client: TestClient):
    headers = get_auth_header(client, "creator@lumora.demo")
    sub_id = create_draft_submission(client, headers)
    good_bytes = get_asset_bytes("lumora_good.png")

    files = {"file": ("lumora_good.png", good_bytes, "image/png")}
    res = client.post(f"/api/submissions/{sub_id}/assets", headers=headers, files=files)
    assert res.status_code == 201
    data = res.json()
    assert data["submission_id"] == sub_id
    assert data["active"] is True
    assert data["summary"]["total"] == 0

def test_asset_upload_bad_palette_blocks_workflow_gate(client: TestClient):
    headers = get_auth_header(client, "creator@lumora.demo")
    sub_id = create_draft_submission(client, headers)
    bad_bytes = get_asset_bytes("lumora_bad_palette.png")

    # 1. Upload off-palette image to draft submission
    files = {"file": ("lumora_bad_palette.png", bad_bytes, "image/png")}
    res = client.post(f"/api/submissions/{sub_id}/assets", headers=headers, files=files)
    assert res.status_code == 201
    asset_data = res.json()
    assert asset_data["summary"]["high"] >= 1
    palette_finding = next(f for f in asset_data["findings"] if f["check_type"] == "palette")
    assert palette_finding["severity"] == "high"

    # 2. Creator attempts to submit draft -> Gated by open asset finding!
    res_sub = client.post(f"/api/submissions/{sub_id}/submit", headers=headers)
    assert res_sub.status_code == 422
    err = res_sub.json()["error"]
    assert err["code"] == "CANNOT_SUBMIT_OPEN_FINDINGS"
    assert "open_asset_findings" in err["details"]

    # 3. Dismiss the asset finding with rationale
    res_patch = client.patch(
        f"/api/asset-findings/{palette_finding['id']}",
        headers=headers,
        json={"resolution": "dismissed", "reason": "Brand manager approved festive red variant for Q4 promo"}
    )
    assert res_patch.status_code == 200

    # 4. Delete the asset
    res_del = client.delete(f"/api/assets/{asset_data['id']}", headers=headers)
    assert res_del.status_code == 204

def test_asset_upload_invalid_type_rejected(client: TestClient):
    headers = get_auth_header(client, "creator@lumora.demo")
    sub_id = create_draft_submission(client, headers)
    corrupt_bytes = b"NOT_A_VALID_IMAGE_HEADER_AT_ALL"
    files = {"file": ("corrupt.png", corrupt_bytes, "image/png")}

    res = client.post(f"/api/submissions/{sub_id}/assets", headers=headers, files=files)
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
