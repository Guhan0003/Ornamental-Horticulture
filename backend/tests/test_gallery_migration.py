"""
Migration 0005 gives every plant that already exists an empty gallery, so the
site looks exactly as it did until someone adds a second photo.
"""

import json

import sqlalchemy as sa
from alembic import command

from tests.test_price_migration import at_revision_0003, insert_plant, point  # noqa: F401


def columns(engine):
    return {column["name"] for column in sa.inspect(engine).get_columns("plants")}


def test_existing_plants_get_an_empty_gallery(at_revision_0003):  # noqa: F811
    config, engine = at_revision_0003
    command.upgrade(config, "0004")
    insert_plant(engine, "peace-lily", [point("Origin", "Tropical.", "origin")])
    assert "gallery" not in columns(engine)

    command.upgrade(config, "head")

    with engine.connect() as connection:
        gallery = connection.execute(sa.text("SELECT gallery FROM plants")).scalar()
    assert json.loads(gallery) == []


def test_the_column_can_be_taken_away_again(at_revision_0003):  # noqa: F811
    config, engine = at_revision_0003
    command.upgrade(config, "head")
    assert "gallery" in columns(engine)

    command.downgrade(config, "0004")

    assert "gallery" not in columns(engine)
    assert "price_minor" in columns(engine)
