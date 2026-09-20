"""The settings that matter once the API runs on Vercel against Supabase."""

import os
import stat
import subprocess
import sys
from pathlib import Path

import httpx
import pytest
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.session import engine_options
from app.services.storage import StorageError, SupabaseStorage

POOLER_URL = "postgresql+psycopg://user:pw@aws-0-x.pooler.supabase.com:6543/postgres"


def test_postgres_disables_prepared_statements_for_the_transaction_pooler():
    options = engine_options(POOLER_URL, serverless=False)
    assert options["connect_args"] == {"prepare_threshold": None}
    assert options["pool_pre_ping"] is True
    assert "poolclass" not in options


def test_serverless_does_not_hold_connections_open():
    assert engine_options(POOLER_URL, serverless=True)["poolclass"] is NullPool


def test_sqlite_keeps_its_local_options():
    assert engine_options("sqlite:///./x.db", serverless=True) == {
        "connect_args": {"check_same_thread": False}
    }


class _Recorder:
    def __init__(self):
        self.headers = None

    def __call__(self, url, content, headers, timeout):
        self.headers = headers
        return httpx.Response(200, json={"Key": "ok"})


def _upload_with_key(monkeypatch, key):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", key)
    recorder = _Recorder()
    monkeypatch.setattr(httpx, "post", recorder)
    url = SupabaseStorage().save(b"data", ".webp", "image/webp")
    return recorder.headers, url


def test_new_secret_key_is_sent_only_as_apikey(monkeypatch):
    """sb_secret_ keys aren't JWTs; as a Bearer token they fail verification."""
    headers, url = _upload_with_key(monkeypatch, "sb_secret_abc123")
    assert headers["apikey"] == "sb_secret_abc123"
    assert "Authorization" not in headers
    assert url.startswith("https://x.supabase.co/storage/v1/object/public/plant-images/")


def test_publishable_key_is_refused_with_a_useful_message(monkeypatch):
    """It is blocked by row-level security; the raw error is unhelpful."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "sb_publishable_abc123")

    def fail(*args, **kwargs):
        raise AssertionError("should not reach Supabase")

    monkeypatch.setattr(httpx, "post", fail)

    with pytest.raises(StorageError, match="publishable"):
        SupabaseStorage().save(b"data", ".webp", "image/webp")


def test_legacy_service_role_jwt_is_also_sent_as_bearer(monkeypatch):
    headers, _ = _upload_with_key(monkeypatch, "eyJhbGciOiJIUzI1NiJ9.payload.sig")
    assert headers["apikey"].startswith("eyJ")
    assert headers["Authorization"] == "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig"


BACKEND = Path(__file__).resolve().parent.parent

STARTUP_CHECK = """
from fastapi.testclient import TestClient
from app.main import app
assert TestClient(app).get("/health").json() == {"status": "ok"}
print("started")
"""


def test_app_starts_in_a_read_only_directory_like_vercel(tmp_path):
    """With Supabase Storage configured, startup must not try to create a media folder."""
    cwd = tmp_path / "readonly"
    cwd.mkdir()
    cwd.chmod(stat.S_IRUSR | stat.S_IXUSR)
    try:
        env = {
            **os.environ,
            "PYTHONPATH": str(BACKEND),
            "VERCEL": "1",
            "DATABASE_URL": "sqlite://",
            "SUPABASE_URL": "https://x.supabase.co",
            "SUPABASE_SERVICE_KEY": "sb_secret_example",
        }
        result = subprocess.run(
            [sys.executable, "-c", STARTUP_CHECK],
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert result.returncode == 0, result.stderr
        assert "started" in result.stdout
        assert not (cwd / "media").exists()
    finally:
        cwd.chmod(stat.S_IRWXU)
