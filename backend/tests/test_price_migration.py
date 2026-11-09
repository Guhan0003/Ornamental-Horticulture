"""
Migration 0004 moves the prices the shop typed into the Deep Dive
("Price-399/- with white decor pot") into real columns, and loses nothing.
"""

import importlib.util
import json
import logging
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from app.core.config import settings

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def migration():
    """Migrations aren't a package, so load the file by path."""
    spec = importlib.util.spec_from_file_location(
        "price_migration", BACKEND / "migrations" / "versions" / "0004_plant_prices.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def point(title, body=".", icon="sparkle"):
    return {"icon": icon, "title": title, "body": body}


# ------------------------------------------------------------------ reading a price


@pytest.mark.parametrize(
    "title, expected",
    [
        # Every spelling that is actually in the shop's data.
        ("Price -399/- with white decor pot", (39900, "with white decor pot")),
        ("Price-399/- with white decor pot", (39900, "with white decor pot")),
        ("Price- 449 with white decor pot", (44900, "with white decor pot")),
        ("Price-329/-  with white decor pot", (32900, "with white decor pot")),
        ("Price-999/-", (99900, "")),
        ("Price -999/- with decor pots", (99900, "with decor pots")),
        (
            "Price-499/- with two opened flowers and with white decor pot",
            (49900, "with two opened flowers and with white decor pot"),
        ),
        # Spellings it has not met yet.
        ("Price - 1,299/-", (129900, "")),
        ("price: ₹250", (25000, "")),
        ("Price Rs. 75.50", (7550, "")),
    ],
)
def test_a_price_title_is_read_into_paise_and_a_note(migration, title, expected):
    assert migration.read_price(point(title)) == expected


@pytest.mark.parametrize(
    "title",
    ["Pet Safety", "Key Care Rule", "Price on request", "Price guide 2024", "Prices", "Price-0/-"],
)
def test_other_points_are_not_mistaken_for_prices(migration, title):
    assert migration.read_price(point(title)) is None


def test_what_the_body_says_is_kept_in_the_note(migration):
    """Two of the shop's points said something besides the price; that survives."""
    assert migration.read_price(point("Price-899/-", "A good plant with good variegations")) == (
        89900,
        "A good plant with good variegations",
    )
    assert migration.read_price(
        point("Price-399/- with white decor pot", "6 varieties available in stock")
    ) == (39900, "with white decor pot · 6 varieties available in stock")


def test_a_note_never_overflows_its_column(migration):
    _, note = migration.read_price(point("Price-399/- " + "pot " * 60))
    assert len(note) <= 120


# ------------------------------------------------------------------ taking it out


def test_only_the_price_point_is_removed_and_the_rest_stay_in_order(migration):
    dive = [point("Origin", "x", "origin"), point("Care", "y", "water"), point("Price-399/-")]

    paise, note, remaining = migration.split_price(dive)

    assert (paise, note) == (39900, "")
    assert [p["title"] for p in remaining] == ["Origin", "Care"]


def test_a_plant_with_no_price_point_is_left_alone(migration):
    assert migration.split_price([point("Origin", "x", "origin")]) is None


def test_a_page_is_never_emptied_to_move_a_price(migration):
    """A plant must keep one Deep Dive point."""
    assert migration.split_price([point("Price-399/-")]) is None


# ------------------------------------------------------------------ the real thing


@pytest.fixture
def at_revision_0003(tmp_path, monkeypatch):
    """An empty database that has had every migration up to the one before this."""
    url = f"sqlite:///{tmp_path / 'shop.db'}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    monkeypatch.chdir(BACKEND)

    # alembic's env.py reconfigures logging; don't let that leak into other tests.
    loggers = {name: getattr(l, "disabled", False) for name, l in logging.root.manager.loggerDict.items()}
    config = Config(str(BACKEND / "alembic.ini"))
    command.upgrade(config, "0003")
    yield config, sa.create_engine(url)
    for name, disabled in loggers.items():
        logging.getLogger(name).disabled = disabled


def insert_plant(engine, slug, deep_dive):
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO plants (slug, common_name, scientific_name, image, profile, snap,"
                " deep_dive, created_at, updated_at) VALUES (:slug, :name, '', :image, :profile,"
                " 'A plant.', :dive, '2026-09-13 00:00:00', '2026-09-13 00:00:00')"
            ),
            {
                "slug": slug,
                "name": slug.title(),
                "image": json.dumps({"url": "/media/a.webp"}),
                "profile": json.dumps({}),
                "dive": json.dumps(deep_dive),
            },
        )


def read_plants(engine):
    with engine.connect() as connection:
        rows = connection.execute(
            sa.text(
                "SELECT slug, price_minor, original_price_minor, currency, price_note,"
                " availability, deep_dive, updated_at FROM plants ORDER BY slug"
            )
        ).all()
    return {row[0]: row for row in rows}


def test_upgrading_moves_each_price_out_of_the_deep_dive(at_revision_0003):
    config, engine = at_revision_0003
    insert_plant(
        engine,
        "peace-lily",
        [point("Origin", "Tropical.", "origin"), point("Price -399/- with white decor pot")],
    )
    insert_plant(engine, "no-price", [point("Origin", "Tropical.", "origin")])
    insert_plant(engine, "snake-plant", [point("Care", "Dry.", "water"), point("Price-399/-", "6 varieties")])

    command.upgrade(config, "head")

    plants = read_plants(engine)
    lily = plants["peace-lily"]
    assert lily.price_minor == 39900
    assert lily.price_note == "with white decor pot"
    assert lily.original_price_minor is None
    assert (lily.currency, lily.availability) == ("INR", "in_stock")
    assert [p["title"] for p in json.loads(lily.deep_dive)] == ["Origin"]

    assert plants["snake-plant"].price_note == "6 varieties"

    # No price anywhere means no price shown, not a made-up one.
    assert plants["no-price"].price_minor is None
    assert len(json.loads(plants["no-price"].deep_dive)) == 1

    # Moving a price is not editing the plant.
    assert str(lily.updated_at).startswith("2026-09-13")


def test_downgrading_puts_the_prices_back_where_they_were_typed(at_revision_0003):
    config, engine = at_revision_0003
    insert_plant(
        engine,
        "peace-lily",
        [point("Origin", "Tropical.", "origin"), point("Price -399/- with white decor pot")],
    )
    command.upgrade(config, "head")

    command.downgrade(config, "0003")

    with engine.connect() as connection:
        dive = json.loads(connection.execute(sa.text("SELECT deep_dive FROM plants")).scalar())
    assert [p["title"] for p in dive] == ["Origin", "Price - 399/- with white decor pot"]
