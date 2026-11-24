"""
Counting scans: which printed labels actually get used.

A scan is counted when a plant's page tells the server it was shown
(POST /plants/{slug}/view), not when its data is fetched. Fetching can be done by
a CDN, a prefetch or a link preview, and the data is kept at the CDN, so counting
there would be counting machines.
"""

from datetime import date, timedelta

from app.models.plant_view import PlantView
from app.services.views import looks_like_a_person, record_view
from tests.test_plants import plant_data

PHONE = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15"}


def add(client, admin_headers, slug="peace-lily"):
    response = client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json=plant_data(slug=slug, common_name=slug.replace("-", " ").title()),
    )
    assert response.status_code == 201, response.text


def scan(client, slug="peace-lily", headers=PHONE):
    """What a plant's page does once it is on someone's screen."""
    return client.post(f"/api/v1/plants/{slug}/view", headers=headers)


def counted(db_session, slug):
    row = db_session.query(PlantView).filter_by(slug=slug, day=date.today()).first()
    return row.views if row else 0


def test_a_page_that_is_shown_counts_a_view(client, admin_headers, db_session):
    add(client, admin_headers)
    response = scan(client)

    assert response.status_code == 204
    assert response.content == b""
    assert counted(db_session, "peace-lily") == 1


def test_views_add_up_over_the_day(client, admin_headers, db_session):
    add(client, admin_headers)
    for _ in range(3):
        scan(client)
    assert counted(db_session, "peace-lily") == 3


def test_a_page_that_does_not_exist_counts_nothing(client, admin_headers, db_session):
    assert scan(client, "no-such-plant").status_code == 404
    assert counted(db_session, "no-such-plant") == 0


def test_the_search_list_is_not_a_view(client, admin_headers, db_session):
    """Only a plant's own page being shown counts."""
    add(client, admin_headers)
    client.get("/api/v1/plants", headers=PHONE)
    assert counted(db_session, "peace-lily") == 0


def test_counting_survives_a_plant_being_deleted(client, admin_headers, db_session):
    """A slug is permanent, so its history outlives the row."""
    add(client, admin_headers)
    scan(client)
    client.delete("/api/v1/plants/peace-lily", headers=admin_headers)
    assert counted(db_session, "peace-lily") == 1


def test_fetching_a_plants_data_is_never_a_view(client, admin_headers, db_session):
    """
    The data is kept at the CDN, fetched ahead of time for the three suggestions
    under a plant, and read by link previews. None of that is somebody looking at
    a plant, and a cached answer would never reach the server to be counted anyway.
    Only the page saying it was shown counts.
    """
    add(client, admin_headers)
    client.get("/api/v1/plants/peace-lily", headers=PHONE)
    client.get("/api/v1/plants/peace-lily", headers={**PHONE, "X-Prefetch": "1"})
    assert counted(db_session, "peace-lily") == 0

    # The same page, actually shown, counts.
    scan(client)
    assert counted(db_session, "peace-lily") == 1


def test_the_signal_is_never_kept_at_the_edge(client, admin_headers):
    """If the CDN answered it, the server would never hear about the scan."""
    add(client, admin_headers)
    control = scan(client).headers.get("cache-control", "")
    assert "s-maxage" not in control


# ------------------------------------------------------------------ bots


def test_crawlers_are_not_people():
    for agent in [
        "Googlebot/2.1 (+http://www.google.com/bot.html)",
        "WhatsApp/2.23",
        "curl/8.4.0",
        "python-httpx/0.28",
        "",
    ]:
        assert not looks_like_a_person(agent)


def test_a_phone_is_a_person():
    assert looks_like_a_person(PHONE["User-Agent"])


def test_a_crawler_does_not_inflate_the_count(client, admin_headers, db_session):
    """A number padded by bots is worse than no number."""
    add(client, admin_headers)
    assert scan(client, headers={"User-Agent": "Googlebot/2.1"}).status_code == 204
    assert counted(db_session, "peace-lily") == 0


def test_a_link_preview_is_not_a_view(client, admin_headers, db_session):
    add(client, admin_headers)
    scan(client, headers={"User-Agent": "WhatsApp/2.23.20.0 A"})
    assert counted(db_session, "peace-lily") == 0


def test_a_signal_with_no_user_agent_is_not_a_view(client, admin_headers, db_session):
    add(client, admin_headers)
    scan(client, headers={"User-Agent": ""})
    assert counted(db_session, "peace-lily") == 0


# ------------------------------------------------------------------ reading them


def test_counts_are_admin_only(client):
    """How often a shelf is scanned is the shop's business."""
    assert client.get("/api/v1/views").status_code == 401
    assert client.get("/api/v1/views/peace-lily").status_code == 401


def test_counts_come_back_most_looked_at_first(client, admin_headers, db_session):
    add(client, admin_headers, "peace-lily")
    add(client, admin_headers, "zz-plant")

    scan(client, "zz-plant")
    scan(client, "zz-plant")
    scan(client, "peace-lily")

    rows = client.get("/api/v1/views", headers=admin_headers).json()
    assert [row["slug"] for row in rows] == ["zz-plant", "peace-lily"]
    assert rows[0] == {
        "slug": "zz-plant",
        "total": 2,
        "recent": 2,
        "today": 2,
        # Nobody has pressed this plant's order button.
        "taps_total": 0,
        "taps_recent": 0,
        "taps_today": 0,
    }


def test_history_fills_in_the_quiet_days(client, admin_headers, db_session):
    """A chart shouldn't have to guess what a missing day meant."""
    add(client, admin_headers)
    db_session.add(PlantView(slug="peace-lily", day=date.today() - timedelta(days=3), views=5))
    db_session.commit()

    history = client.get("/api/v1/views/peace-lily?days=7", headers=admin_headers).json()

    assert len(history["days"]) == 7
    assert history["total"] == 5
    assert history["days"][-1]["day"] == date.today().isoformat()
    assert [d["views"] for d in history["days"]] == [0, 0, 0, 5, 0, 0, 0]


def test_a_second_view_on_the_same_day_adds_to_the_row(db_session, monkeypatch):
    """The first view of a day creates the row; the rest add to it."""
    monkeypatch.setattr("app.services.views.SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)

    record_view("peace-lily", PHONE["User-Agent"])
    record_view("peace-lily", PHONE["User-Agent"])

    assert counted(db_session, "peace-lily") == 2
