"""
Three plants at the bottom of a page are how a scan becomes a second scan.
"""

from app.services.related import SUGGESTIONS
from tests.test_plants import plant_data


def add(client, admin_headers, slug, **profile_and_dive):
    data = plant_data(slug=slug, common_name=slug.replace("-", " ").title())
    data["profile"] = {**data["profile"], **profile_and_dive.pop("profile", {})}
    data.update(profile_and_dive)
    response = client.post("/api/v1/plants", headers=admin_headers, json=data)
    assert response.status_code == 201, response.text
    return response.json()


def related_slugs(client, slug):
    response = client.get(f"/api/v1/plants/{slug}")
    assert response.status_code == 200
    return [item["slug"] for item in response.json()["related"]]


def test_a_lone_plant_suggests_nothing(client, admin_headers):
    add(client, admin_headers, "peace-lily")
    assert related_slugs(client, "peace-lily") == []


def test_a_plant_never_suggests_itself(client, admin_headers):
    for slug in ("peace-lily", "zz-plant", "snake-plant"):
        add(client, admin_headers, slug)
    assert "peace-lily" not in related_slugs(client, "peace-lily")


def test_at_most_three_are_suggested(client, admin_headers):
    for slug in ("peace-lily", "zz-plant", "snake-plant", "rubber-plant", "monstera"):
        add(client, admin_headers, slug)
    assert len(related_slugs(client, "peace-lily")) == SUGGESTIONS


def test_the_closest_match_comes_first(client, admin_headers):
    """Same light and same use beats a plant that only shares the room."""
    add(client, admin_headers, "peace-lily")

    add(
        client,
        admin_headers,
        "twin-plant",
        profile={
            "environment": "Indoor",
            "light": {"label": "", "note": "", "ideal": [1, 2], "tolerates": [0]},
            "landscape_use": {"items": ["Shaded tropical borders"], "note": ""},
            "home_use": {"items": ["Tabletop accent", "Floor plant"], "note": ""},
        },
    )
    add(
        client,
        admin_headers,
        "distant-plant",
        profile={
            "environment": "Indoor",
            "light": {"label": "", "note": "", "ideal": [3], "tolerates": []},
            "landscape_use": {"items": ["Desert rockery"], "note": ""},
            "home_use": {"items": ["Windowsill"], "note": ""},
        },
    )

    assert related_slugs(client, "peace-lily")[0] == "twin-plant"


def test_a_plant_with_nothing_in_common_is_still_offered(client, admin_headers):
    """An empty shelf reads as a broken page; a loose match reads as a shop."""
    add(client, admin_headers, "peace-lily")
    add(
        client,
        admin_headers,
        "cactus",
        profile={
            "environment": "Outdoor",
            "light": {"label": "", "note": "", "ideal": [3], "tolerates": []},
            "landscape_use": {"items": [], "note": ""},
            "home_use": {"items": [], "note": ""},
        },
        deep_dive=[{"icon": "sun", "title": "Sun", "body": "Full sun only."}],
    )
    assert related_slugs(client, "peace-lily") == ["cactus"]


def test_the_order_is_the_same_every_time(client, admin_headers):
    """Ties fall back to the name, so the page doesn't reshuffle on reload."""
    for slug in ("peace-lily", "zz-plant", "snake-plant", "rubber-plant"):
        add(client, admin_headers, slug)

    assert related_slugs(client, "peace-lily") == related_slugs(client, "peace-lily")


def test_suggestions_carry_what_a_card_needs(client, admin_headers):
    add(client, admin_headers, "peace-lily")
    add(client, admin_headers, "zz-plant")

    suggestion = client.get("/api/v1/plants/peace-lily").json()["related"][0]
    assert suggestion["common_name"]
    assert suggestion["image"]["url"]
    # The blurred preview is what fills the card while the photo loads.
    assert suggestion["image"]["placeholder"]


def test_the_admin_list_is_not_weighed_down_by_them(client, admin_headers):
    """The list endpoint feeds search; suggestions have no business there."""
    add(client, admin_headers, "peace-lily")
    add(client, admin_headers, "zz-plant")

    for summary in client.get("/api/v1/plants").json():
        assert "related" not in summary
