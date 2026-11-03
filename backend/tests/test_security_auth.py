"""
Automated tests for security hardening, file upload defenses, and forgot/reset password flows.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import User, PasswordResetToken

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_forgot_and_reset_password_flow(client: TestClient):
    # 1. Request password reset token
    res = client.post("/api/auth/forgot-password", json={"email": "creator@lumora.demo"})
    assert res.status_code == 200
    data = res.json()
    assert "reset_token" in data
    token = data["reset_token"]
    assert token is not None

    # 2. Reset password with valid token
    res2 = client.post("/api/auth/reset-password", json={"token": token, "new_password": "NewSecretPass123!"})
    assert res2.status_code == 200
    assert "successfully" in res2.json()["message"]

    # 3. Log in with new password
    res3 = client.post("/api/auth/login", json={"email": "creator@lumora.demo", "password": "NewSecretPass123!"})
    assert res3.status_code == 200
    assert "token" in res3.json()

    # 4. Token cannot be reused (single-use token defense)
    res_reuse = client.post("/api/auth/reset-password", json={"token": token, "new_password": "AnotherPassword123!"})
    assert res_reuse.status_code == 400

    # 5. Restore default demo password
    res4 = client.post("/api/auth/forgot-password", json={"email": "creator@lumora.demo"})
    token2 = res4.json()["reset_token"]
    res5 = client.post("/api/auth/reset-password", json={"token": token2, "new_password": "demo1234"})
    assert res5.status_code == 200

def test_malicious_script_upload_defense(client: TestClient):
    # Log in as creator
    login_res = client.post("/api/auth/login", json={"email": "creator@lumora.demo", "password": "demo1234"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create submission
    sub = client.post("/api/submissions", json={"title": "Sec Draft", "type": "social", "body": "Clean draft"}, headers=headers)
    sub_id = sub.json()["id"]

    # Disguised PHP script
    fake_files = {"file": ("exploit.php.png", b"<?php phpinfo(); ?>", "image/png")}
    res = client.post(f"/api/submissions/{sub_id}/assets", files=fake_files, headers=headers)
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"

def test_oversized_upload_defense(client: TestClient):
    login_res = client.post("/api/auth/login", json={"email": "creator@lumora.demo", "password": "demo1234"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    sub = client.post("/api/submissions", json={"title": "Sec Draft 2", "type": "social", "body": "Clean draft"}, headers=headers)
    sub_id = sub.json()["id"]

    # 6MB file (> 5MB limit)
    huge_bytes = b"\x89PNG\r\n\x1a\n" + b"0" * (6 * 1024 * 1024)
    huge_files = {"file": ("too_big.png", huge_bytes, "image/png")}
    res = client.post(f"/api/submissions/{sub_id}/assets", files=huge_files, headers=headers)
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "FILE_TOO_LARGE"

