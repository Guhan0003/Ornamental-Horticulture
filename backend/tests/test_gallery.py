"""
A plant can show more than one photo. The cover (`image`) is what the shop and
the search show; the gallery is what a visitor swipes through after it.
"""

import pytest

from app.schemas.plant import MAX_PHOTOS
from tests.test_plants import plant_data

BUCKET = "https://example.supabase.co/storage/v1/object/public/plant-images/"


def photo(name, **overrides):
    return {
        "url": f"{BUCKET}{name}.webp",
        "alt": f"Photo {name}",
        "placeholder": "data:image/webp;base64,UklGRsQAAABXRUJQ",
        "background": "#c3c4c9",
        **overrides,
    }


def add(client, admin_headers, **overrides):
    return client.post("/api/v1/plants", headers=admin_headers, json=plant_data(**overrides))


# ------------------------------------------------------------------ the defaults


def test_a_plant_with_one_photo_has_an_empty_gallery(client, admin_headers):
    body = add(client, admin_headers).json()
    assert body["gallery"] == []
    assert body["image"]["url"]


def test_the_gallery_keeps_its_order(client, admin_headers):
    gallery = [photo("one"), photo("two"), photo("three")]

    add(client, admin_headers, gallery=gallery)

    body = client.get("/api/v1/plants/peace-lily").json()
    assert [p["url"] for p in body["gallery"]] == [p["url"] for p in gallery]
    # The cover is not part of it.
    assert body["image"]["url"] == plant_data()["image"]["url"]
    assert body["gallery"][1]["alt"] == "Photo two"


def test_the_cover_and_eleven_more_fit_and_a_twelfth_does_not(client, admin_headers):
    """The cap keeps a page and its JSON light on a shop's Wi-Fi."""
    fits = [photo(f"p{n}") for n in range(MAX_PHOTOS - 1)]
    assert add(client, admin_headers, gallery=fits).status_code == 201

    too_many = [photo(f"q{n}") for n in range(MAX_PHOTOS)]
    response = add(client, admin_headers, slug="fern", gallery=too_many)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "bad",
    [
        {"url": "javascript:alert(1)"},
        {"url": "data:image/png;base64,AAAA"},
        {"background": "red; position: fixed"},
        {"placeholder": 'x") ; background: url("evil'},
    ],
)
def test_a_gallery_photo_is_checked_like_the_cover(client, admin_headers, bad):
    """These reach the page too, so they get the same checks."""
    response = add(client, admin_headers, gallery=[photo("one", **bad)])
    assert response.status_code == 422


# ------------------------------------------------------------------ who sees it


def test_the_list_and_the_suggestions_carry_only_the_cover(client, admin_headers):
    """Cards need one photo; a gallery would weigh down the home page."""
    add(client, admin_headers, gallery=[photo("one"), photo("two")])
    add(client, admin_headers, slug="zz-plant", common_name="ZZ Plant")

    for summary in client.get("/api/v1/plants").json():
        assert "gallery" not in summary

    related = client.get("/api/v1/plants/peace-lily").json()["related"]
    assert all("gallery" not in item for item in related)


# ------------------------------------------------------------------ editing


def test_a_gallery_can_be_replaced_and_cleared(client, admin_headers):
    add(client, admin_headers, gallery=[photo("one"), photo("two")])

    replaced = client.patch(
        "/api/v1/plants/peace-lily",
        headers=admin_headers,
        json={"gallery": [photo("two"), photo("three"), photo("one")]},
    )
    assert [p["alt"] for p in replaced.json()["gallery"]] == ["Photo two", "Photo three", "Photo one"]

    cleared = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"gallery": []}
    )
    assert cleared.status_code == 200
    assert cleared.json()["gallery"] == []


def test_editing_something_else_keeps_the_gallery(client, admin_headers):
    add(client, admin_headers, gallery=[photo("one"), photo("two")])

    client.patch("/api/v1/plants/peace-lily", headers=admin_headers, json={"snap": "New."})

    assert len(client.get("/api/v1/plants/peace-lily").json()["gallery"]) == 2


def test_a_gallery_cannot_be_nulled(client, admin_headers):
    add(client, admin_headers, gallery=[photo("one")])
    response = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"gallery": None}
    )
    assert response.status_code == 422


def test_a_gallery_photo_can_become_the_cover(client, admin_headers):
    """Choosing a different thumbnail is a swap: the old cover joins the gallery."""
    cover = plant_data()["image"]
    add(client, admin_headers, gallery=[photo("one"), photo("two")])

    response = client.patch(
        "/api/v1/plants/peace-lily",
        headers=admin_headers,
        json={"image": photo("two"), "gallery": [cover, photo("one")]},
    )

    body = response.json()
    assert body["image"]["url"] == photo("two")["url"]
    assert [p["url"] for p in body["gallery"]] == [cover["url"], photo("one")["url"]]

    # And it is what the shop now shows.
    listed = client.get("/api/v1/plants").json()[0]
    assert listed["image"]["url"] == photo("two")["url"]
