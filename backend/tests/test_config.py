import pytest

from app.core.config import DEV_SECRET_KEY, Settings, load_settings

STRONG_KEY = "x" * 43


def production(**overrides):
    defaults = {
        "ENVIRONMENT": "production",
        "SECRET_KEY": STRONG_KEY,
        "ADMIN_PASSWORD": "a-real-password",
        "DATABASE_URL": "postgresql+psycopg://user:pw@pooler.supabase.com:6543/postgres",
        "SUPABASE_URL": "https://x.supabase.co",
        "SUPABASE_SERVICE_KEY": "sb_secret_example",
    }
    return Settings(**{**defaults, **overrides})


def test_development_allows_the_defaults():
    settings = Settings(ENVIRONMENT="development", SECRET_KEY=DEV_SECRET_KEY)
    assert settings.SECRET_KEY == DEV_SECRET_KEY


def test_production_refuses_the_default_secret_key():
    with pytest.raises(ValueError, match="development default"):
        production(SECRET_KEY=DEV_SECRET_KEY)


def test_production_refuses_a_short_secret_key():
    with pytest.raises(ValueError, match="at least"):
        production(SECRET_KEY="tooshort")


def test_production_refuses_the_default_admin_password():
    with pytest.raises(ValueError, match="ADMIN_PASSWORD"):
        production(ADMIN_PASSWORD="changeme123")


def test_production_accepts_a_password_hash_instead_of_plaintext():
    settings = production(ADMIN_PASSWORD="changeme123", ADMIN_PASSWORD_HASH="$2b$12$fake")
    assert settings.is_production


def test_production_accepts_strong_settings():
    assert production().is_production


def test_supabase_storage_is_off_until_both_values_are_set():
    assert not Settings(SUPABASE_URL="https://x.supabase.co").uses_supabase_storage
    assert Settings(
        SUPABASE_URL="https://x.supabase.co", SUPABASE_SERVICE_KEY="key"
    ).uses_supabase_storage


def test_production_refuses_local_disk_storage():
    """Vercel's disk is read-only and wiped on redeploy, so photos would be lost."""
    with pytest.raises(ValueError, match="SUPABASE"):
        production(SUPABASE_SERVICE_KEY="")


def test_production_refuses_sqlite():
    with pytest.raises(ValueError, match="DATABASE_URL"):
        production(DATABASE_URL="sqlite:///./ornamental.db")


def test_env_file_can_be_chosen_for_one_off_commands(tmp_path, monkeypatch):
    env_file = tmp_path / ".env.production"
    env_file.write_text("ADMIN_EMAIL=owner@example.com\n")
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.setenv("ENV_FILE", str(env_file))

    assert load_settings().ADMIN_EMAIL == "owner@example.com"
