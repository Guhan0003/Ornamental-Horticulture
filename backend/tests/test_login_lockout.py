"""
The admin login is one password on a public endpoint, so repeated wrong
guesses from a client have to stop being free.
"""

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.models.login_attempt import LoginAttempt
from tests.conftest import TEST_EMAIL, TEST_PASSWORD

# Starlette's TestClient presents itself as this host.
TEST_CLIENT_HOST = "testclient"


def wrong(client, **kwargs):
    return client.post(
        "/api/v1/auth/login", data={"username": TEST_EMAIL, "password": "wrong"}, **kwargs
    )


def right(client, **kwargs):
    return client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
        **kwargs,
    )


def exhaust(client, **kwargs):
    """Use up the whole allowance, leaving the client locked."""
    for _ in range(settings.LOGIN_MAX_FAILURES):
        assert wrong(client, **kwargs).status_code == 401


def test_the_allowance_is_only_spent_by_failures(client):
    for _ in range(settings.LOGIN_MAX_FAILURES * 2):
        assert right(client).status_code == 200


def test_locks_out_after_the_configured_failures(client):
    exhaust(client)

    response = wrong(client)
    assert response.status_code == 429
    assert "Try again in 15 minutes" in response.json()["detail"]


def test_the_lock_refuses_the_correct_password_too(client):
    """Otherwise the lockout would tell a guesser when they had found it."""
    exhaust(client)
    assert right(client).status_code == 429


def test_the_lock_says_how_long_to_wait(client):
    exhaust(client)

    response = wrong(client)
    retry_after = int(response.headers["retry-after"])
    assert 0 < retry_after <= settings.LOGIN_LOCKOUT_MINUTES * 60


def test_a_correct_password_clears_the_count(client, db_session):
    for _ in range(settings.LOGIN_MAX_FAILURES - 1):
        assert wrong(client).status_code == 401

    assert right(client).status_code == 200
    assert db_session.get(LoginAttempt, TEST_CLIENT_HOST) is None

    # A fresh allowance, so one more wrong guess is just a 401.
    assert wrong(client).status_code == 401


def test_a_wrong_email_counts_as_a_failure(client):
    for _ in range(settings.LOGIN_MAX_FAILURES):
        assert client.post(
            "/api/v1/auth/login",
            data={"username": "someone@example.com", "password": TEST_PASSWORD},
        ).status_code == 401

    assert right(client).status_code == 429


def test_the_lock_lets_go_when_it_runs_out(client, db_session):
    exhaust(client)

    attempt = db_session.get(LoginAttempt, TEST_CLIENT_HOST)
    attempt.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    assert right(client).status_code == 200


def test_a_served_lock_earns_a_fresh_allowance(client, db_session):
    exhaust(client)

    attempt = db_session.get(LoginAttempt, TEST_CLIENT_HOST)
    attempt.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    # Not locked again by the single guess that follows.
    assert wrong(client).status_code == 401
    db_session.expire_all()
    assert db_session.get(LoginAttempt, TEST_CLIENT_HOST).failures == 1


def test_forwarded_headers_are_ignored_without_a_trusted_proxy(client, monkeypatch):
    """A rotating X-Forwarded-For must not buy a fresh allowance each request."""
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", False)

    for n in range(settings.LOGIN_MAX_FAILURES):
        assert wrong(client, headers={"X-Forwarded-For": f"10.0.0.{n}"}).status_code == 401

    assert wrong(client, headers={"X-Forwarded-For": "10.0.0.99"}).status_code == 429


def test_behind_a_proxy_each_client_is_counted_separately(client, monkeypatch):
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)

    exhaust(client, headers={"X-Forwarded-For": "203.0.113.1"})
    assert wrong(client, headers={"X-Forwarded-For": "203.0.113.1"}).status_code == 429

    # A different visitor is unaffected by someone else's lockout.
    assert wrong(client, headers={"X-Forwarded-For": "203.0.113.2"}).status_code == 401


def test_the_left_most_forwarded_address_is_the_client(client, monkeypatch):
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)
    headers = {"X-Forwarded-For": "203.0.113.5, 70.41.3.18, 150.172.238.178"}

    exhaust(client, headers=headers)
    assert wrong(client, headers={"X-Forwarded-For": "203.0.113.5"}).status_code == 429


def test_quiet_clients_are_forgotten(client, db_session, monkeypatch):
    """The table must not grow a permanent row per address on the internet."""
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)

    assert wrong(client, headers={"X-Forwarded-For": "198.51.100.7"}).status_code == 401

    stale = db_session.get(LoginAttempt, "198.51.100.7")
    stale.last_failure_at = datetime.now(timezone.utc) - timedelta(
        minutes=settings.LOGIN_LOCKOUT_MINUTES + 1
    )
    db_session.commit()

    # Any later failure sweeps it up.
    assert wrong(client, headers={"X-Forwarded-For": "198.51.100.8"}).status_code == 401
    assert db_session.get(LoginAttempt, "198.51.100.7") is None


def test_a_long_quiet_spell_resets_the_count(client, db_session):
    for _ in range(settings.LOGIN_MAX_FAILURES - 1):
        assert wrong(client).status_code == 401

    attempt = db_session.get(LoginAttempt, TEST_CLIENT_HOST)
    attempt.last_failure_at = datetime.now(timezone.utc) - timedelta(
        minutes=settings.LOGIN_LOCKOUT_MINUTES + 1
    )
    db_session.commit()

    assert wrong(client).status_code == 401
    db_session.expire_all()
    assert db_session.get(LoginAttempt, TEST_CLIENT_HOST).failures == 1
