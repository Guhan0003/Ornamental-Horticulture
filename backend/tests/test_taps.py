"""
Counting presses of the WhatsApp order button: which plants people ask about.
"""

from datetime import date

import sqlalchemy as sa
from alembic import command

from app.models.plant_tap import PlantTap
from tests.test_price_migration import at_revision_0003, point  # noqa: F401
from tests.test_views import PHONE, add

CRAWLER = {"User-Agent": "WhatsApp/2.23.20.0 A"}


def tap(client, slug="peace-lily", headers=PHONE):
    return client.post(f"/api/v1/plants/{slug}/tap", headers=headers)


def counted(db_session, slug):
    row = db_session.query(PlantTap).filter_by(slug=slug, day=date.today()).first()
    return row.taps if row else 0


def counts(client, admin_headers):
    response = client.get("/api/v1/views", headers=admin_headers)
    assert response.status_code == 200, response.text
    return {row["slug"]: row for row in response.json()}


def test_pressing_the_order_button_counts_a_tap(client, admin_headers, db_session):
    add(client, admin_headers)
    response = tap(client)
    assert response.status_code == 204
    assert response.content == b""
    assert counted(db_session, "peace-lily") == 1


def test_taps_add_up_over_the_day(client, admin_headers, db_session):
    add(client, admin_headers)
    for _ in range(3):
        tap(client)
    assert counted(db_session, "peace-lily") == 3


def test_a_plant_that_does_not_exist_counts_nothing(client, admin_headers, db_session):
    """Guessing addresses cannot fill the table with rows for plants that are not there."""
    assert tap(client, "no-such-plant").status_code == 404
    assert counted(db_session, "no-such-plant") == 0


def test_a_link_preview_is_not_a_tap(client, admin_headers, db_session):
    add(client, admin_headers)
    assert tap(client, headers=CRAWLER).status_code == 204
    assert counted(db_session, "peace-lily") == 0


def test_a_request_with_no_user_agent_is_not_a_tap(client, admin_headers, db_session):
    add(client, admin_headers)
    tap(client, headers={"User-Agent": ""})
    assert counted(db_session, "peace-lily") == 0


def test_a_tap_is_not_a_view(client, admin_headers, db_session):
    add(client, admin_headers)
    tap(client)
    assert counts(client, admin_headers)["peace-lily"]["total"] == 0


def test_the_dashboard_counts_carry_views_and_taps_together(client, admin_headers):
    add(client, admin_headers)
    for _ in range(2):
        client.get("/api/v1/plants/peace-lily", headers=PHONE)
    tap(client)

    row = counts(client, admin_headers)["peace-lily"]
    assert (row["total"], row["recent"], row["today"]) == (2, 2, 2)
    assert (row["taps_total"], row["taps_recent"], row["taps_today"]) == (1, 1, 1)


def test_a_plant_that_was_looked_at_but_never_tapped_shows_zero_taps(client, admin_headers):
    add(client, admin_headers)
    client.get("/api/v1/plants/peace-lily", headers=PHONE)

    row = counts(client, admin_headers)["peace-lily"]
    assert row["total"] == 1
    assert (row["taps_total"], row["taps_recent"], row["taps_today"]) == (0, 0, 0)


def test_a_tap_on_a_plant_nobody_counted_a_view_for_still_appears(client, admin_headers):
    """Views come from a bot-filtered page load; a tap can arrive without one."""
    add(client, admin_headers)
    tap(client)

    row = counts(client, admin_headers)["peace-lily"]
    assert row["total"] == 0
    assert row["taps_total"] == 1


def test_the_counts_are_for_the_admin_only(client, admin_headers):
    add(client, admin_headers)
    tap(client)
    assert client.get("/api/v1/views").status_code == 401


def test_the_code_can_ship_before_its_migration(client, admin_headers, db_session):
    """
    The deploy guide runs migrations first, but a customer pressing the order
    button must not meet an error on the day someone forgets, and the dashboard
    must still list its plants.
    """
    add(client, admin_headers)
    client.get("/api/v1/plants/peace-lily", headers=PHONE)
    PlantTap.__table__.drop(db_session.get_bind())

    assert tap(client).status_code == 204

    row = counts(client, admin_headers)["peace-lily"]
    assert row["total"] == 1
    assert (row["taps_total"], row["taps_recent"], row["taps_today"]) == (0, 0, 0)


def tables(engine):
    return set(sa.inspect(engine).get_table_names())


def test_migration_0006_creates_the_table(at_revision_0003):  # noqa: F811
    config, engine = at_revision_0003
    command.upgrade(config, "0005")
    assert "plant_taps" not in tables(engine)

    command.upgrade(config, "head")

    assert "plant_taps" in tables(engine)
    columns = {column["name"] for column in sa.inspect(engine).get_columns("plant_taps")}
    assert columns == {"slug", "day", "taps"}


def test_migration_0006_can_be_taken_away_again(at_revision_0003):  # noqa: F811
    config, engine = at_revision_0003
    command.upgrade(config, "head")

    command.downgrade(config, "0005")

    assert "plant_taps" not in tables(engine)
    assert "plant_views" in tables(engine)
