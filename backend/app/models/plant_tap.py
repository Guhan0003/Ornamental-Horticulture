from datetime import date

from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlantTap(Base):
    """
    How many times the WhatsApp order button on a plant's page was pressed, one
    row per plant per day.

    The same shape as PlantView, for the same reasons: keyed by slug so a deleted
    plant's history stays readable, and a day at a time because that is as
    fine-grained as the question ever gets.

    A tap is not an order. It is someone who looked at a plant and went as far as
    opening a chat with the shop, which is the nearest thing to "wanted this" the
    site can see. Put beside the number of times the page was opened, it says which
    plants people look at and which ones they actually ask about.
    """

    __tablename__ = "plant_taps"

    slug: Mapped[str] = mapped_column(String(160), primary_key=True)
    # Indexed because every read of this table is "the last N days".
    day: Mapped[date] = mapped_column(Date, primary_key=True, index=True)
    taps: Mapped[int] = mapped_column(Integer, default=0)
