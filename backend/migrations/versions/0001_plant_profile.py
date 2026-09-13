"""Plant profile schema: one table shaped like the plant page

Replaces the earlier block-based page builder (plants, content_blocks,
categories, media_assets). The old `plants` table has the same name but a
different shape, so any existing old tables are renamed to legacy_* rather than
dropped: nothing is lost, and they can be deleted by hand once no longer wanted.

Revision ID: 0001
Revises:
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

OLD_TABLES = ("content_blocks", "media_assets", "plants", "categories")
# Index names from the old schema that the new one reuses or would collide with.
OLD_INDEXES = ("ix_plants_slug", "ix_categories_slug", "ix_content_blocks_plant_id")


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())

    for table in OLD_TABLES:
        if table in existing:
            op.rename_table(table, f"legacy_{table}")
    for index in OLD_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {index}")

    op.create_table(
        "plants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(160), nullable=False),
        sa.Column("common_name", sa.String(200), nullable=False),
        sa.Column("scientific_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("image", sa.JSON(), nullable=False),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("snap", sa.Text(), nullable=False),
        sa.Column("deep_dive", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_plants_slug", "plants", ["slug"], unique=True)

    op.create_table(
        "retired_slugs",
        sa.Column("slug", sa.String(160), primary_key=True),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("retired_slugs")
    op.drop_index("ix_plants_slug", table_name="plants")
    op.drop_table("plants")

    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for table in OLD_TABLES:
        if f"legacy_{table}" in existing:
            op.rename_table(f"legacy_{table}", table)
