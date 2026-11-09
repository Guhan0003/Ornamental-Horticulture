"""
A plant has a price, and the price is money: whole paise, never a float, and
never something that contradicts itself.
"""

import pytest

from tests.test_plants import plant_data


def add(client, admin_headers, **overrides):
    return client.post("/api/v1/plants", headers=admin_headers, json=plant_data(**overrides))


# ------------------------------------------------------------------ the defaults


def test_a_plant_without_a_price_asks_for_one_to_be_requested(client, admin_headers):
    """Null is "no price shown", not zero — and the plant is still for sale."""
    body = add(client, admin_headers).json()

    assert body["price_minor"] is None
    assert body["original_price_minor"] is None
    assert body["price_note"] == ""
    assert body["availability"] == "in_stock"
    assert body["currency"] == "INR"


def test_a_price_is_saved_in_paise_with_what_it_includes(client, admin_headers):
    response = add(
        client,
        admin_headers,
        price_minor=39900,
        price_note="with white decor pot",
        availability="in_stock",
    )

    assert response.status_code == 201, response.text
    body = client.get("/api/v1/plants/peace-lily").json()
    assert body["price_minor"] == 39900
    assert body["price_note"] == "with white decor pot"


def test_prices_reach_the_home_page_list_and_the_suggestions(client, admin_headers):
    """The home page shows prices from the list, so the list has to carry them."""
    add(client, admin_headers, price_minor=39900, original_price_minor=49900)
    add(client, admin_headers, slug="zz-plant", common_name="ZZ Plant", price_minor=29900)

    listed = {item["slug"]: item for item in client.get("/api/v1/plants").json()}
    assert listed["peace-lily"]["price_minor"] == 39900
    assert listed["peace-lily"]["original_price_minor"] == 49900
    assert listed["zz-plant"]["availability"] == "in_stock"

    related = client.get("/api/v1/plants/peace-lily").json()["related"]
    assert related[0]["price_minor"] == 29900


# ------------------------------------------------------------------ what is refused


@pytest.mark.parametrize(
    "fields",
    [
        {"price_minor": 0},
        {"price_minor": -100},
        {"price_minor": 100_000_001},
        {"price_minor": 399.5},
        {"price_minor": 399, "original_price_minor": 399},
        {"price_minor": 399, "original_price_minor": 100},
        {"original_price_minor": 49900},
        {"availability": "maybe"},
        {"price_note": "x" * 121},
    ],
)
def test_nonsense_prices_are_refused(client, admin_headers, fields):
    assert add(client, admin_headers, **fields).status_code == 422


def test_a_discount_needs_a_price_above_it(client, admin_headers):
    response = add(client, admin_headers, price_minor=39900, original_price_minor=49900)
    assert response.status_code == 201
    assert response.json()["original_price_minor"] == 49900


# ------------------------------------------------------------------ editing


def test_editing_something_else_leaves_the_price_alone(client, admin_headers):
    add(client, admin_headers, price_minor=39900, price_note="with white decor pot")

    client.patch("/api/v1/plants/peace-lily", headers=admin_headers, json={"snap": "New."})

    body = client.get("/api/v1/plants/peace-lily").json()
    assert body["price_minor"] == 39900
    assert body["price_note"] == "with white decor pot"


def test_a_price_can_be_changed_and_taken_away(client, admin_headers):
    add(client, admin_headers, price_minor=39900)

    changed = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"price_minor": 42900}
    )
    assert changed.json()["price_minor"] == 42900

    cleared = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"price_minor": None}
    )
    assert cleared.status_code == 200
    assert cleared.json()["price_minor"] is None


def test_availability_can_be_changed(client, admin_headers):
    add(client, admin_headers, price_minor=39900)

    response = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"availability": "sold_out"}
    )

    assert response.json()["availability"] == "sold_out"
    assert response.json()["price_minor"] == 39900


def test_availability_cannot_be_nulled(client, admin_headers):
    add(client, admin_headers)
    response = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"availability": None}
    )
    assert response.status_code == 422


def test_a_patch_that_would_leave_the_prices_contradicting_each_other_is_refused(
    client, admin_headers
):
    """Either price can be sent alone, so it is judged against what is stored."""
    add(client, admin_headers, price_minor=39900, original_price_minor=49900)

    below = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"price_minor": 59900}
    )
    assert below.status_code == 422
    assert "higher" in below.json()["detail"]

    orphan = client.patch(
        "/api/v1/plants/peace-lily", headers=admin_headers, json={"price_minor": None}
    )
    assert orphan.status_code == 422

    # Refused means unchanged.
    body = client.get("/api/v1/plants/peace-lily").json()
    assert (body["price_minor"], body["original_price_minor"]) == (39900, 49900)


def test_a_discount_is_removed_by_clearing_the_original_price(client, admin_headers):
    add(client, admin_headers, price_minor=39900, original_price_minor=49900)

    response = client.patch(
        "/api/v1/plants/peace-lily",
        headers=admin_headers,
        json={"original_price_minor": None},
    )

    assert response.status_code == 200
    assert response.json()["original_price_minor"] is None
