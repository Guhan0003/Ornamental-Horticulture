import pytest

from app.core.config import DEV_SECRET_KEY, Settings

STRONG_KEY = "x" * 43


def production(**overrides):
    defaults = {
        "ENVIRONMENT": "production",
        "SECRET_KEY": STRONG_KEY,
        "ADMIN_PASSWORD": "a-real-password",
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
