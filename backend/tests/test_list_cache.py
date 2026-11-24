"""
The shop's plant list and each plant's data are kept at the CDN so they load
quickly in India. Nothing that counts, writes or belongs to the admin is. These
are the promises that make that safe.
"""

from tests.test_views import PHONE, add, scan

SHOP = "https://stomatalworld.vercel.app"
ELSEWHERE = "http://localhost:5173"


def cache_control(response):
    return response.headers.get("cache-control", "")


def test_the_list_is_kept_at_the_edge_for_a_minute_then_served_stale_while_it_refreshes(client):
    control = cache_control(client.get("/api/v1/plants", headers=PHONE))

    assert "public" in control
    assert "s-maxage=60" in control
    assert "stale-while-revalidate=3600" in control


def test_a_sleeping_server_never_makes_a_visitor_wait_for_an_hour(client):
    """
    The server goes to sleep after a few quiet minutes and takes seconds to wake.
    The old copy is kept for an hour so that a visitor is handed it at once while
    the server wakes in the background. Shorten this and the first visitor after
    every quiet spell waits again.
    """
    control = cache_control(client.get("/api/v1/plants", headers=PHONE))
    stale_for = int(control.split("stale-while-revalidate=")[1].split(",")[0])

    assert stale_for >= 3600


def test_the_browser_itself_always_asks_again(client):
    """Only the CDN keeps it; a phone checks with the CDN each time, which is fast."""
    assert "max-age=0" in cache_control(client.get("/api/v1/plants", headers=PHONE))


def test_every_answer_varies_on_origin_even_with_no_origin_sent(client, admin_headers):
    """
    A crawler or a server asking sends no origin. If that answer were cached
    without this, the next browser would be given a copy with no permission in it
    and could not read the shop.
    """
    add(client, admin_headers)
    for path in ("/api/v1/plants", "/api/v1/plants/peace-lily"):
        for headers in (PHONE, {**PHONE, "Origin": SHOP}, {**PHONE, "Origin": ELSEWHERE}):
            response = client.get(path, headers=headers)
            assert "origin" in response.headers.get("vary", "").lower(), (path, headers)


def test_each_website_is_told_it_may_read_the_list_and_only_itself(client):
    shop = client.get("/api/v1/plants", headers={**PHONE, "Origin": SHOP})
    other = client.get("/api/v1/plants", headers={**PHONE, "Origin": ELSEWHERE})

    assert shop.headers["access-control-allow-origin"] == SHOP
    assert other.headers["access-control-allow-origin"] == ELSEWHERE


def test_a_website_that_is_not_allowed_is_not_told_it_may(client):
    stranger = client.get("/api/v1/plants", headers={**PHONE, "Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in stranger.headers


def test_the_dashboard_can_ask_for_a_fresh_copy(client):
    control = cache_control(client.get("/api/v1/plants?fresh=1", headers=PHONE))

    assert "no-store" in control
    assert "s-maxage" not in control


def test_a_fresh_copy_is_the_same_list(client, admin_headers):
    add(client, admin_headers, "peace-lily")
    add(client, admin_headers, "zz-plant")

    cached = client.get("/api/v1/plants", headers=PHONE).json()
    fresh = client.get("/api/v1/plants?fresh=1", headers=PHONE).json()

    assert cached == fresh
    assert [plant["slug"] for plant in fresh] == ["peace-lily", "zz-plant"]


# ------------------------------------------------------------------ a plant's data


def test_a_plants_data_is_kept_at_the_edge_the_same_way(client, admin_headers):
    """
    The page a QR label opens used to wait on the server for this every time. It is
    only safe to keep because scans are counted by the page, not by this request.
    """
    add(client, admin_headers)
    control = cache_control(client.get("/api/v1/plants/peace-lily", headers=PHONE))

    assert "public" in control
    assert "s-maxage=60" in control
    assert "stale-while-revalidate=3600" in control
    assert "max-age=0" in control


def test_the_dashboards_editor_can_ask_for_a_fresh_plant(client, admin_headers):
    add(client, admin_headers)
    control = cache_control(client.get("/api/v1/plants/peace-lily?fresh=1", headers=PHONE))

    assert "no-store" in control
    assert "s-maxage" not in control


def test_a_fresh_plant_shows_an_edit_straight_away(client, admin_headers):
    add(client, admin_headers)
    client.patch(
        "/api/v1/plants/peace-lily",
        headers=admin_headers,
        json={"price_minor": 55500, "price_note": "after the edit"},
    )

    fresh = client.get("/api/v1/plants/peace-lily?fresh=1", headers=PHONE).json()
    assert fresh["price_minor"] == 55500
    assert fresh["price_note"] == "after the edit"


def test_a_plant_that_is_not_there_is_never_kept(client):
    """A wrong address must not be remembered as a page that exists, or the reverse."""
    response = client.get("/api/v1/plants/no-such-plant", headers=PHONE)

    assert response.status_code == 404
    assert "s-maxage" not in cache_control(response)


# ------------------------------------------------------------------ what is never kept


def test_the_signal_that_counts_a_scan_is_never_kept_at_the_edge(client, admin_headers):
    """If the CDN answered it, the server would never hear about the scan."""
    add(client, admin_headers)
    assert "s-maxage" not in cache_control(scan(client))


def test_nothing_in_the_admin_is_kept_at_the_edge(client, admin_headers):
    add(client, admin_headers)

    for path in ("/api/v1/views", "/api/v1/views/peace-lily"):
        response = client.get(path, headers=admin_headers)
        assert response.status_code == 200, path
        assert "s-maxage" not in cache_control(response), path


def test_pressing_the_order_button_is_never_kept_at_the_edge(client, admin_headers):
    add(client, admin_headers)
    response = client.post("/api/v1/plants/peace-lily/tap", headers=PHONE)

    assert "s-maxage" not in cache_control(response)
