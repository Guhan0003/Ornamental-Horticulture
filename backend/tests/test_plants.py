import copy

import pytest

PEACE_LILY = {
    "slug": "peace-lily",
    "common_name": "Peace Lily",
    "scientific_name": "Spathiphyllum wallisii",
    "image": {
        "url": "https://example.supabase.co/storage/v1/object/public/plant-images/a.webp",
        "alt": "A peace lily in a white pot",
        "placeholder": "data:image/webp;base64,UklGRsQAAABXRUJQ",
        "background": "#c3c4c9",
    },
    "profile": {
        "environment": "Indoor",
        "light": {
            "label": "Medium to bright indirect light",
            "note": "Tolerates low light",
            "ideal": [1, 2],
            "tolerates": [0],
        },
        "landscape_use": {"items": ["Shaded tropical borders"], "note": "Frost-free zones"},
        "home_use": {"items": ["Tabletop accent", "Floor plant"]},
    },
    "snap": "An elegant indoor staple with glossy dark leaves.",
    "deep_dive": [
        {"icon": "origin", "title": "Origin & Habit", "body": "Tropical Americas."},
        {"icon": "paw", "title": "Pet Safety", "body": "Toxic to cats and dogs."},
    ],
}


def plant_data(**overrides):
    data = copy.deepcopy(PEACE_LILY)
    data.update(overrides)
    return data


@pytest.fixture
def plant(client, admin_headers):
    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data())
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------- public reads


def test_anyone_can_read_a_plant_page(client, plant):
    response = client.get("/api/v1/plants/peace-lily")
    assert response.status_code == 200
    body = response.json()
    assert body["common_name"] == "Peace Lily"
    assert body["profile"]["light"]["ideal"] == [1, 2]
    assert [p["title"] for p in body["deep_dive"]] == ["Origin & Habit", "Pet Safety"]


def test_list_is_public_sorted_and_compact(client, admin_headers, plant):
    client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json=plant_data(slug="aloe-vera", common_name="Aloe Vera"),
    )

    items = client.get("/api/v1/plants").json()
    assert [p["common_name"] for p in items] == ["Aloe Vera", "Peace Lily"]
    # Just enough for a search result or admin card, not the whole page.
    assert set(items[0]) == {"slug", "common_name", "scientific_name", "image", "updated_at"}


def test_unknown_plant_is_404(client):
    assert client.get("/api/v1/plants/does-not-exist").status_code == 404


# ---------------------------------------------------------------- auth


def test_writes_require_the_admin_login(client, plant):
    assert client.post("/api/v1/plants", json=plant_data(slug="x")).status_code == 401
    assert client.patch("/api/v1/plants/peace-lily", json={"snap": "x"}).status_code == 401
    assert client.delete("/api/v1/plants/peace-lily").status_code == 401


# ---------------------------------------------------------------- create


def test_optional_sections_can_be_left_out(client, admin_headers):
    minimal = {
        "slug": "fern",
        "common_name": "Fern",
        "image": {"url": "/media/fern.webp"},
        "snap": "A fern.",
        "deep_dive": [{"title": "Care", "body": "Keep it humid."}],
    }
    response = client.post("/api/v1/plants", headers=admin_headers, json=minimal)
    assert response.status_code == 201, response.text
    assert response.json()["profile"]["home_use"]["items"] == []


@pytest.mark.parametrize(
    "field, value",
    [
        ("common_name", "   "),
        ("snap", ""),
        ("deep_dive", []),
        ("deep_dive", [{"icon": "origin", "title": "", "body": "x"}]),
        ("deep_dive", [{"icon": "rocket", "title": "x", "body": "x"}]),
    ],
)
def test_required_content_is_enforced(client, admin_headers, field, value):
    response = client.post(
        "/api/v1/plants", headers=admin_headers, json=plant_data(**{field: value})
    )
    assert response.status_code == 422


def test_image_is_required(client, admin_headers):
    data = plant_data()
    del data["image"]
    assert client.post("/api/v1/plants", headers=admin_headers, json=data).status_code == 422


@pytest.mark.parametrize(
    "image",
    [
        {"url": "javascript:alert(1)"},
        {"url": "data:image/png;base64,AAAA"},
        {"url": "/media/a.webp", "background": "red; position: fixed"},
        {"url": "/media/a.webp", "placeholder": 'x") ; background: url("evil'},
    ],
)
def test_image_fields_that_reach_the_page_are_checked(client, admin_headers, image):
    response = client.post(
        "/api/v1/plants", headers=admin_headers, json=plant_data(image=image)
    )
    assert response.status_code == 422


def test_light_levels_are_on_the_scale_and_tidied(client, admin_headers):
    bad = plant_data()
    bad["profile"]["light"]["ideal"] = [4]
    assert client.post("/api/v1/plants", headers=admin_headers, json=bad).status_code == 422

    messy = plant_data()
    messy["profile"]["light"].update(ideal=[2, 1, 2], tolerates=[1, 0])
    response = client.post("/api/v1/plants", headers=admin_headers, json=messy)
    light = response.json()["profile"]["light"]
    # Duplicates removed, and a level can't be both ideal and merely tolerated.
    assert light["ideal"] == [1, 2]
    assert light["tolerates"] == [0]


@pytest.mark.parametrize(
    "slug", ["", "Peace Lily", "a/b", "lily?x=1", "trailing-", "double--hyphen", "x" * 161]
)
def test_malformed_slug_is_rejected(client, admin_headers, slug):
    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data(slug=slug))
    assert response.status_code == 422


@pytest.mark.parametrize("slug", ["admin", "api", "assets"])
def test_slug_cannot_shadow_a_site_route(client, admin_headers, slug):
    """Plant pages live at /<slug>, so /admin must stay the admin."""
    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data(slug=slug))
    assert response.status_code == 422


def test_duplicate_slug_is_a_conflict(client, admin_headers, plant):
    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data())
    assert response.status_code == 409


# ---------------------------------------------------------------- update


def test_editing_changes_only_what_is_sent(client, admin_headers, plant):
    response = client.patch(
        "/api/v1/plants/peace-lily",
        headers=admin_headers,
        json={"snap": "Rewritten.", "scientific_name": ""},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["snap"] == "Rewritten."
    assert body["scientific_name"] == ""
    assert body["common_name"] == "Peace Lily"
    assert len(body["deep_dive"]) == 2


def test_slug_cannot_be_changed(client, admin_headers, plant):
    """Printed QR labels depend on the address never moving."""
    client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"slug": "something-else"}
    )
    assert client.get("/api/v1/plants/peace-lily").status_code == 200
    assert client.get("/api/v1/plants/something-else").status_code == 404


@pytest.mark.parametrize("field", ["common_name", "image", "snap", "deep_dive", "profile"])
def test_sections_cannot_be_nulled(client, admin_headers, plant, field):
    response = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={field: None}
    )
    assert response.status_code == 422


def test_update_of_unknown_plant_is_404(client, admin_headers):
    response = client.patch("/api/v1/plants/nope", headers=admin_headers, json={"snap": "x"})
    assert response.status_code == 404


# ---------------------------------------------------------------- delete


def test_deleted_plant_is_gone(client, admin_headers, plant):
    assert client.delete("/api/v1/plants/peace-lily", headers=admin_headers).status_code == 204
    assert client.get("/api/v1/plants/peace-lily").status_code == 404


def test_deleted_address_is_never_reused(client, admin_headers, plant):
    """An old QR label may still point at it."""
    client.delete("/api/v1/plants/peace-lily", headers=admin_headers)

    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data())
    assert response.status_code == 409
    assert "deleted" in response.json()["detail"]
