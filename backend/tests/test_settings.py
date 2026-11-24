"""
The shop's contact details, edited from the dashboard instead of in the code.
"""

import pytest
import sqlalchemy as sa
from alembic import command

from app.models.site_setting import SiteSetting
from tests.test_price_migration import at_revision_0003  # noqa: F401
from tests.test_views import PHONE

SHOP = {
    "phone": "+91 86087 05789",
    "whatsapp": "+91 86087 05789",
    "email": "stomatalworldd@gmail.com",
    "instagram": "stomatalworld",
    "whatsapp_message": "Hi! I saw your plants at StomatalWorld and have a question.",
}


def save(client, admin_headers, **changes):
    return client.put("/api/v1/settings", headers=admin_headers, json={**SHOP, **changes})


def read(client, headers=PHONE, fresh=False):
    return client.get(f"/api/v1/settings{'?fresh=1' if fresh else ''}", headers=headers)


# ------------------------------------------------------------------ nothing saved yet


def test_nothing_is_saved_until_the_owner_saves_something(client):
    """The site then keeps using the details built into it."""
    response = read(client)

    assert response.status_code == 200
    assert response.json() == {}


def test_what_was_saved_is_what_everyone_reads(client, admin_headers):
    assert save(client, admin_headers, phone="+91 98765 43210").status_code == 200

    assert read(client).json() == {**SHOP, "phone": "+91 98765 43210"}


def test_saving_again_replaces_what_was_there(client, admin_headers, db_session):
    save(client, admin_headers, email="old@example.com")
    save(client, admin_headers, email="new@example.com")

    assert read(client).json()["email"] == "new@example.com"
    assert db_session.query(SiteSetting).count() == 5


def test_an_empty_value_means_show_nothing_not_use_the_built_in_one(client, admin_headers):
    """The shop with no Instagram must be able to say so, and be believed."""
    save(client, admin_headers, instagram="")

    assert read(client).json()["instagram"] == ""


# ------------------------------------------------------------------ who may change it


def test_only_the_owner_can_change_it(client):
    assert client.put("/api/v1/settings", json=SHOP).status_code == 401


def test_a_wrong_login_cannot_change_it(client):
    response = client.put(
        "/api/v1/settings", json=SHOP, headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


# ------------------------------------------------------------------ what is accepted


@pytest.mark.parametrize("number", ["8608705789", "86087 05789", "+91", "+91 abc", "++91 86087 05789"])
def test_a_number_needs_its_country_code(client, admin_headers, number):
    """The call and WhatsApp links are built from the digits and break without it."""
    assert save(client, admin_headers, whatsapp=number).status_code == 422
    assert save(client, admin_headers, phone=number).status_code == 422


def test_a_number_is_kept_the_way_it_was_written(client, admin_headers):
    save(client, admin_headers, whatsapp="  +91 (860) 870-5789  ")

    assert read(client).json()["whatsapp"] == "+91 (860) 870-5789"


@pytest.mark.parametrize(
    "typed",
    [
        "stomatalworld",
        "@stomatalworld",
        "https://instagram.com/stomatalworld",
        "https://www.instagram.com/stomatalworld/",
        "instagram.com/stomatalworld?igsh=abc",
    ],
)
def test_instagram_is_kept_as_the_handle_alone(client, admin_headers, typed):
    save(client, admin_headers, instagram=typed)

    assert read(client).json()["instagram"] == "stomatalworld"


@pytest.mark.parametrize("typed", ["has space", "https://example.com/stomatalworld", "a" * 31, "bad/handle"])
def test_something_that_is_not_a_handle_is_refused(client, admin_headers, typed):
    assert save(client, admin_headers, instagram=typed).status_code == 422


@pytest.mark.parametrize("typed", ["nobody", "a@b", "a b@c.com", "@c.com"])
def test_something_that_is_not_an_email_is_refused(client, admin_headers, typed):
    assert save(client, admin_headers, email=typed).status_code == 422


def test_the_greeting_has_a_limit_so_a_link_stays_short_enough(client, admin_headers):
    assert save(client, admin_headers, whatsapp_message="x" * 301).status_code == 422


def test_a_refused_save_changes_nothing(client, admin_headers):
    save(client, admin_headers)
    save(client, admin_headers, phone="+91 11111 11111", email="not an email")

    assert read(client).json() == SHOP


def test_every_field_must_be_sent(client, admin_headers):
    """The page always sends the whole form, so a half-sent one is a mistake."""
    response = client.put("/api/v1/settings", headers=admin_headers, json={"phone": "+91 86087 05789"})
    assert response.status_code == 422


# ------------------------------------------------------------------ the CDN


def test_the_settings_are_kept_at_the_edge_like_the_plant_list(client):
    control = read(client).headers["cache-control"]

    assert "s-maxage=60" in control
    assert "stale-while-revalidate=3600" in control
    assert "origin" in read(client).headers["vary"].lower()


def test_the_dashboard_asks_for_a_fresh_copy(client):
    assert "no-store" in read(client, fresh=True).headers["cache-control"]


def test_saving_is_never_kept_at_the_edge(client, admin_headers):
    assert "s-maxage" not in save(client, admin_headers).headers.get("cache-control", "")


def test_the_code_can_ship_before_its_migration(client, db_session):
    """Nothing saved is an honest answer; the site carries on with what it has built in."""
    SiteSetting.__table__.drop(db_session.get_bind())

    response = read(client)

    assert response.status_code == 200
    assert response.json() == {}


# ------------------------------------------------------------------ a plant cannot take the order page's address


def test_a_plant_cannot_be_given_the_order_pages_address(client, admin_headers):
    from tests.test_plants import plant_data

    response = client.post("/api/v1/plants", headers=admin_headers, json=plant_data(slug="order"))
    assert response.status_code == 422
    assert "used by the site itself" in response.text


# ------------------------------------------------------------------ the migration


def tables(engine):
    return set(sa.inspect(engine).get_table_names())


def test_migration_0007_creates_the_table(at_revision_0003):  # noqa: F811
    config, engine = at_revision_0003
    command.upgrade(config, "0006")
    assert "site_settings" not in tables(engine)

    command.upgrade(config, "head")

    assert "site_settings" in tables(engine)
    columns = {column["name"] for column in sa.inspect(engine).get_columns("site_settings")}
    assert columns == {"key", "value"}


def test_migration_0007_can_be_taken_away_again(at_revision_0003):  # noqa: F811
    config, engine = at_revision_0003
    command.upgrade(config, "head")

    command.downgrade(config, "0006")

    assert "site_settings" not in tables(engine)
    assert "plant_taps" in tables(engine)
