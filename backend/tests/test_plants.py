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


@pytest.mark.parametrize(
    "slug",
    ["", "My Plant", "a/b", "monstera?x=1", "trailing-", "double--hyphen", "x" * 161],
)
def test_malformed_slug_is_rejected(client, admin_headers, slug):
    """A bad slug would be printed into a QR code and could never be fixed."""
    response = client.post(
        "/api/v1/plants", headers=admin_headers, json={"slug": slug, "common_name": "X"}
    )
    assert response.status_code == 422


def test_blank_common_name_is_rejected(client, admin_headers):
    response = client.post(
        "/api/v1/plants", headers=admin_headers, json={"slug": "fern", "common_name": "  "}
    )
    assert response.status_code == 422


def test_required_fields_cannot_be_nulled(client, admin_headers, plant):
    for field in ("common_name", "is_published"):
        response = client.patch(
            "/api/v1/plants/monstera-deliciosa", headers=admin_headers, json={field: None}
        )
        assert response.status_code == 422, field


def test_optional_fields_can_be_cleared(client, admin_headers, plant):
    response = client.patch(
        "/api/v1/plants/monstera-deliciosa",
        headers=admin_headers,
        json={"summary": None, "category_id": None},
    )
    assert response.status_code == 200


def test_over_long_text_is_rejected(client, admin_headers, plant):
    response = client.patch(
        "/api/v1/plants/monstera-deliciosa",
        headers=admin_headers,
        json={"summary": "x" * 501},
    )
    assert response.status_code == 422


def test_unknown_category_is_rejected(client, admin_headers, plant):
    created = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json={"slug": "fern", "common_name": "Fern", "category_id": 999},
    )
    assert created.status_code == 400

    updated = client.patch(
        "/api/v1/plants/monstera-deliciosa", headers=admin_headers, json={"category_id": 999}
    )
    assert updated.status_code == 400
