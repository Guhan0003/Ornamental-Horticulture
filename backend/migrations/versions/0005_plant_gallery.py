"""More than one photo per plant

`plants.image` stays the cover: the thumbnail the shop, the search and the
suggestions show. `gallery` holds the photos after it, in the order a visitor
swipes through them. Every existing plant gets an empty gallery, so nothing on
the site changes until someone adds a second photo.

Purely additive, so the old code keeps working against the new column; run it
before deploying the code that reads it.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("plants") as batch:
        batch.add_column(
            sa.Column("gallery", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )


def downgrade() -> None:
    # The photos stay in storage; only the list of which plant shows them goes.
    with op.batch_alter_table("plants") as batch:
        batch.drop_column("gallery")
