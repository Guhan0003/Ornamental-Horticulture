"""
What the API gives away, and what it cleans up after itself.
"""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import SECURITY_HEADERS, create_app


def test_security_headers_are_on_every_response(client):
    response = client.get("/health")
    for header, value in SECURITY_HEADERS.items():
        assert response.headers[header] == value


def test_the_docs_are_open_in_development():
    """They're how you work on the API locally."""
    assert create_app().docs_url == "/docs"


def test_production_hides_the_docs(monkeypatch):
    """The schema is a map of the admin API; a visitor has no use for it."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    app = create_app()

    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None

    with TestClient(app) as production_client:
        assert production_client.get("/docs").status_code == 404
        assert production_client.get("/openapi.json").status_code == 404


def test_a_preview_deployment_is_allowed_to_call_the_api(client):
    """Preview hostnames change every push, so they're matched by pattern."""
    response = client.get(
        "/api/v1/plants",
        headers={"Origin": "https://ornamental-git-feature-stomatalworld.vercel.app"},
    )
    assert response.headers["access-control-allow-origin"].endswith(".vercel.app")


def test_an_unrelated_site_is_not_allowed_to_call_the_api(client):
    response = client.get("/api/v1/plants", headers={"Origin": "https://not-ours.example"})
    assert "access-control-allow-origin" not in response.headers
