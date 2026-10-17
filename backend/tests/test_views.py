"""
Counting scans: which printed labels actually get used.
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


def counted(db_session, slug):
    row = db_session.query(PlantView).filter_by(slug=slug, day=date.today()).first()
    return row.views if row else 0


def test_opening_a_page_counts_a_view(client, admin_headers, db_session):
    add(client, admin_headers)
    client.get("/api/v1/plants/peace-lily", headers=PHONE)
    assert counted(db_session, "peace-lily") == 1


def test_views_add_up_over_the_day(client, admin_headers, db_session):
    add(client, admin_headers)
    for _ in range(3):
        client.get("/api/v1/plants/peace-lily", headers=PHONE)
    assert counted(db_session, "peace-lily") == 3


def test_a_page_that_does_not_exist_counts_nothing(client, admin_headers, db_session):
    client.get("/api/v1/plants/no-such-plant", headers=PHONE)
    assert counted(db_session, "no-such-plant") == 0


def test_the_search_list_is_not_a_view(client, admin_headers, db_session):
    """Only opening a plant's own page counts."""
    add(client, admin_headers)
    client.get("/api/v1/plants", headers=PHONE)
    assert counted(db_session, "peace-lily") == 0


def test_counting_survives_a_plant_being_deleted(client, admin_headers, db_session):
    """A slug is permanent, so its history outlives the row."""
    add(client, admin_headers)
    client.get("/api/v1/plants/peace-lily", headers=PHONE)
    client.delete("/api/v1/plants/peace-lily", headers=admin_headers)
    assert counted(db_session, "peace-lily") == 1


def test_a_prefetched_page_is_not_a_view(client, admin_headers, db_session):
    """
    Opening one plant fetches its three suggestions ahead of time. Counting
    those would mean every page view inflated three others, and the numbers
    would say nothing about which labels people actually scan.
    """
    add(client, admin_headers)
    client.get("/api/v1/plants/peace-lily", headers={**PHONE, "X-Prefetch": "1"})
    assert counted(db_session, "peace-lily") == 0

    # The same page, actually opened, still counts.
    client.get("/api/v1/plants/peace-lily", headers=PHONE)
    assert counted(db_session, "peace-lily") == 1


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
    client.get("/api/v1/plants/peace-lily", headers={"User-Agent": "Googlebot/2.1"})
    assert counted(db_session, "peace-lily") == 0


# ------------------------------------------------------------------ reading them


def test_counts_are_admin_only(client):
    """How often a shelf is scanned is the shop's business."""
    assert client.get("/api/v1/views").status_code == 401
    assert client.get("/api/v1/views/peace-lily").status_code == 401


def test_counts_come_back_most_looked_at_first(client, admin_headers, db_session):
    add(client, admin_headers, "peace-lily")
    add(client, admin_headers, "zz-plant")

    client.get("/api/v1/plants/zz-plant", headers=PHONE)
    client.get("/api/v1/plants/zz-plant", headers=PHONE)
    client.get("/api/v1/plants/peace-lily", headers=PHONE)

    rows = client.get("/api/v1/views", headers=admin_headers).json()
    assert [row["slug"] for row in rows] == ["zz-plant", "peace-lily"]
    assert rows[0] == {"slug": "zz-plant", "total": 2, "recent": 2, "today": 2}


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
