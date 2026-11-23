"""Daily counts of WhatsApp order taps per plant

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plant_taps",
        sa.Column("slug", sa.String(160), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("taps", sa.Integer(), nullable=False, server_default="0"),
    )
    # Every read of this table is "the last N days", across plants or for one.
    op.create_index("ix_plant_taps_day", "plant_taps", ["day"])


def downgrade() -> None:
    op.drop_index("ix_plant_taps_day", table_name="plant_taps")
    op.drop_table("plant_taps")
