import pytest

from app.core.config import DEV_SECRET_KEY, Settings


def test_development_allows_the_default_key():
    settings = Settings(ENVIRONMENT="development", SECRET_KEY=DEV_SECRET_KEY)
    assert settings.SECRET_KEY == DEV_SECRET_KEY


def test_production_refuses_the_default_key():
    with pytest.raises(ValueError, match="development default"):
        Settings(ENVIRONMENT="production", SECRET_KEY=DEV_SECRET_KEY)


def test_production_refuses_a_short_key():
    with pytest.raises(ValueError, match="at least"):
        Settings(ENVIRONMENT="production", SECRET_KEY="tooshort")


def test_production_accepts_a_strong_key():
    settings = Settings(ENVIRONMENT="production", SECRET_KEY="x" * 43)
    assert settings.is_production
