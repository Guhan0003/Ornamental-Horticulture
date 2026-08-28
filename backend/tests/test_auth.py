from app.core.config import settings
from app.core.security import hash_password
from tests.conftest import TEST_EMAIL, TEST_PASSWORD


def test_login_returns_token(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_login_is_case_insensitive_on_email(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL.upper(), "password": TEST_PASSWORD},
    )
    assert response.status_code == 200


def test_login_rejects_wrong_password(client):
    response = client.post(
        "/api/v1/auth/login", data={"username": TEST_EMAIL, "password": "wrong"}
    )
    assert response.status_code == 401


def test_login_rejects_unknown_email(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "someone@example.com", "password": TEST_PASSWORD},
    )
    assert response.status_code == 401


def test_login_works_against_a_password_hash(client, monkeypatch):
    """ADMIN_PASSWORD_HASH takes precedence, so no plaintext need be deployed."""
    monkeypatch.setattr(settings, "ADMIN_PASSWORD_HASH", hash_password("hashedpass123"))
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "ignored-when-hash-is-set")

    assert client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": "hashedpass123"},
    ).status_code == 200

    assert client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": "ignored-when-hash-is-set"},
    ).status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_returns_the_signed_in_admin(client, admin_headers):
    response = client.get("/api/v1/auth/me", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["email"] == TEST_EMAIL


def test_garbage_token_is_rejected(client):
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert response.status_code == 401


def test_changing_the_admin_email_invalidates_old_tokens(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "someone-else@example.com")
    assert client.get("/api/v1/auth/me", headers=admin_headers).status_code == 401
