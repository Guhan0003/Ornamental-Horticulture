"""Daily view counts per plant, so we can tell which labels get scanned

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plant_views",
        sa.Column("slug", sa.String(160), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
    )
    # Every read of this table is "the last N days", across plants or for one.
    op.create_index("ix_plant_views_day", "plant_views", ["day"])


def downgrade() -> None:
    op.drop_index("ix_plant_views_day", table_name="plant_views")
    op.drop_table("plant_views")
