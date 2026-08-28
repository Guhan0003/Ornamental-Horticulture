import pytest


@pytest.fixture
def plant(client, admin_headers):
    response = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json={
            "slug": "monstera-deliciosa",
            "common_name": "Monstera",
            "is_published": True,
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def draft(client, admin_headers):
    response = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json={"slug": "secret-fern", "common_name": "Secret Fern", "is_published": False},
    )
    assert response.status_code == 201
    return response.json()


def test_anonymous_can_read_a_published_plant(client, plant):
    response = client.get("/api/v1/plants/monstera-deliciosa")
    assert response.status_code == 200
    assert response.json()["common_name"] == "Monstera"


def test_anonymous_cannot_read_a_draft(client, draft):
    assert client.get("/api/v1/plants/secret-fern").status_code == 404


def test_editor_can_preview_a_draft(client, admin_headers, draft):
    response = client.get("/api/v1/plants/secret-fern", headers=admin_headers)
    assert response.status_code == 200


def test_draft_is_hidden_from_the_public_list(client, plant, draft):
    slugs = [p["slug"] for p in client.get("/api/v1/plants").json()]
    assert "monstera-deliciosa" in slugs
    assert "secret-fern" not in slugs


def test_editor_can_list_drafts(client, admin_headers, plant, draft):
    response = client.get(
        "/api/v1/plants", params={"include_drafts": True}, headers=admin_headers
    )
    assert "secret-fern" in [p["slug"] for p in response.json()]


def test_anonymous_cannot_request_drafts_via_the_flag(client, plant, draft):
    """include_drafts must not be a way for the public to read unpublished pages."""
    response = client.get("/api/v1/plants", params={"include_drafts": True})
    assert "secret-fern" not in [p["slug"] for p in response.json()]


def test_creating_a_plant_requires_auth(client):
    response = client.post(
        "/api/v1/plants", json={"slug": "x", "common_name": "X"}
    )
    assert response.status_code == 401


def test_duplicate_slug_is_rejected(client, admin_headers, plant):
    response = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json={"slug": "monstera-deliciosa", "common_name": "Another"},
    )
    assert response.status_code == 409


def test_slug_cannot_be_changed(client, admin_headers, plant):
    """Printed QR labels depend on the slug never moving."""
    client.patch(
        "/api/v1/plants/monstera-deliciosa",
        headers=admin_headers,
        json={"slug": "something-else", "common_name": "Renamed"},
    )
    assert client.get("/api/v1/plants/monstera-deliciosa").status_code == 200
    assert client.get("/api/v1/plants/something-else").status_code == 404


def test_unknown_slug_is_404(client):
    assert client.get("/api/v1/plants/does-not-exist").status_code == 404
