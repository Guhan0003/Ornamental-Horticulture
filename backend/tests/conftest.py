import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

TEST_EMAIL = "admin@example.com"
TEST_PASSWORD = "adminpass123"


@pytest.fixture(autouse=True)
def admin_credentials(monkeypatch):
    """Pin the single login so tests don't depend on the developer's .env."""
    monkeypatch.setattr(settings, "ADMIN_EMAIL", TEST_EMAIL)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", TEST_PASSWORD)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD_HASH", "")


@pytest.fixture
def db_session():
    """A fresh in-memory database per test, so tests cannot leak into each other."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
