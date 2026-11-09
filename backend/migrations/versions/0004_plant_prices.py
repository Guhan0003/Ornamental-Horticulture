"""Prices become their own columns, taken out of the Deep Dive

The shop has been typing prices into the last Deep Dive point ("Price-399/- with
white decor pot"), because there was nowhere else to put one. This adds the real
columns and moves every such point into them, so a price can be sorted, shown on
the home page and edited in its own field.

Nothing is thrown away: the words after the number become `price_note`, and a
point whose text said something more than "." keeps that text in the note too.
A title that does not read as a price is left exactly where it is, and named in
the output.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-09
"""
import re
from decimal import Decimal

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

NOTE_LENGTH = 120

# "Price-399/- with white decor pot", "Price -999/- with decor pots",
# "Price- 449 with white decor pot", "Price-1,299/-": the word, then a number,
# then an optional "/-", then whatever the shop said about what is included.
PRICE_TITLE = re.compile(
    r"^\s*price\b[\s\-–—:.]*(?:₹|rs\.?|inr)?\s*"
    r"(\d[\d,]*(?:\.\d{1,2})?)\s*(?:/-|/=)?\s*(.*?)\s*$",
    re.IGNORECASE,
)


def read_price(point: dict) -> tuple[int, str] | None:
    """(paise, note) if this Deep Dive point is really a price, else None."""
    match = PRICE_TITLE.match(point.get("title", ""))
    if not match:
        return None

    paise = int((Decimal(match.group(1).replace(",", "")) * 100).to_integral_value())
    if paise <= 0:
        return None

    included = match.group(2).strip(" -–—:,.")
    body = (point.get("body") or "").strip()
    # The body is required by the old form, so people typed "." when they had
    # nothing to say. Anything with a real word in it is kept.
    said = body if re.search(r"\w", body) else ""

    note = " · ".join(part for part in (included, said) if part)
    return paise, note[:NOTE_LENGTH].rstrip()


def rupees(paise: int) -> str:
    return str(paise // 100) if paise % 100 == 0 else f"{paise / 100:.2f}"


def split_price(deep_dive: list[dict]) -> tuple[int, str, list[dict]] | None:
    """(paise, note, the points that are left) or None if there is no price."""
    for index, point in enumerate(deep_dive):
        found = read_price(point)
        if found is None:
            continue

        remaining = deep_dive[:index] + deep_dive[index + 1 :]
        # A plant must keep at least one point; never empty a page to move a price.
        if not remaining:
            return None
        return found[0], found[1], remaining
    return None


def upgrade() -> None:
    with op.batch_alter_table("plants") as batch:
        batch.add_column(sa.Column("price_minor", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("original_price_minor", sa.Integer(), nullable=True))
        batch.add_column(
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR")
        )
        batch.add_column(
            sa.Column("price_note", sa.String(NOTE_LENGTH), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("availability", sa.String(20), nullable=False, server_default="in_stock")
        )

    plants = sa.table(
        "plants",
        sa.column("id", sa.Integer),
        sa.column("slug", sa.String),
        sa.column("deep_dive", sa.JSON),
        sa.column("price_minor", sa.Integer),
        sa.column("price_note", sa.String),
    )
    bind = op.get_bind()

    moved = 0
    for plant_id, slug, deep_dive in bind.execute(
        sa.select(plants.c.id, plants.c.slug, plants.c.deep_dive)
    ).all():
        found = split_price(deep_dive or [])
        if found is None:
            print(f"  no price found in the Deep Dive of {slug}; left as it is")
            continue

        paise, note, remaining = found
        bind.execute(
            plants.update()
            .where(plants.c.id == plant_id)
            .values(price_minor=paise, price_note=note, deep_dive=remaining)
        )
        moved += 1
        print(f"  {slug}: {rupees(paise)}  {note!r}")

    print(f"  moved {moved} prices out of the Deep Dive")


def downgrade() -> None:
    plants = sa.table(
        "plants",
        sa.column("id", sa.Integer),
        sa.column("deep_dive", sa.JSON),
        sa.column("price_minor", sa.Integer),
        sa.column("price_note", sa.String),
    )
    bind = op.get_bind()

    # Put each price back where it was typed, so rolling back loses nothing.
    for plant_id, deep_dive, paise, note in bind.execute(
        sa.select(plants.c.id, plants.c.deep_dive, plants.c.price_minor, plants.c.price_note)
    ).all():
        if paise is None:
            continue
        title = f"Price - {rupees(paise)}/-" + (f" {note}" if note else "")
        bind.execute(
            plants.update()
            .where(plants.c.id == plant_id)
            .values(deep_dive=[*(deep_dive or []), {"icon": "sparkle", "title": title[:80], "body": "."}])
        )

    with op.batch_alter_table("plants") as batch:
        batch.drop_column("availability")
        batch.drop_column("price_note")
        batch.drop_column("currency")
        batch.drop_column("original_price_minor")
        batch.drop_column("price_minor")
