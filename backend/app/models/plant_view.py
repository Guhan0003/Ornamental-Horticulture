from datetime import date

from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlantView(Base):
    """
    How many times a plant's page was opened, one row per plant per day.

    Keyed by slug rather than by the plant's id on purpose: a slug is
    permanent and is never reused, so a deleted plant's history stays
    readable instead of disappearing with the row — which matters when the
    question is "did the labels we printed last spring ever get scanned?".

    A day at a time is as fine-grained as this needs to be. Counting per
    visit would mean a row per scan, and nobody will ever ask a question that
    needs it.
    """

    __tablename__ = "plant_views"

    slug: Mapped[str] = mapped_column(String(160), primary_key=True)
    # Indexed because every read of this table is "the last N days".
    day: Mapped[date] = mapped_column(Date, primary_key=True, index=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
