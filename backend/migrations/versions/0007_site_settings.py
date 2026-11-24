"""The shop's contact details, editable from the dashboard

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("value", sa.String(500), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_table("site_settings")
