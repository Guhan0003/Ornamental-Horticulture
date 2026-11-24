"""
The shop's plant list is kept at the CDN so it loads quickly in India; nothing
else is. These are the promises that makes safe.
"""

from tests.test_views import PHONE, add

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


def test_every_answer_varies_on_origin_even_with_no_origin_sent(client):
    """
    A crawler or a server asking for the list sends no origin. If that answer were
    cached without this, the next browser would be given a copy with no permission
    in it and could not read the shop.
    """
    for headers in (PHONE, {**PHONE, "Origin": SHOP}, {**PHONE, "Origin": ELSEWHERE}):
        response = client.get("/api/v1/plants", headers=headers)
        assert "origin" in response.headers.get("vary", "").lower(), headers


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


def test_a_plants_own_page_is_never_kept_at_the_edge(client, admin_headers):
    """
    Counting a scan happens when the request reaches the server. A cached page
    would never reach it, and the dashboard's scan numbers would quietly stop.
    """
    add(client, admin_headers)
    control = cache_control(client.get("/api/v1/plants/peace-lily", headers=PHONE))

    assert "s-maxage" not in control
    assert "public" not in control


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
