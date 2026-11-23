from datetime import date

from pydantic import BaseModel


class PlantViewCount(BaseModel):
    """How often one plant has been looked at, and how often its order button was pressed."""

    slug: str
    total: int
    # The window the dashboard asks for, 30 days by default.
    recent: int
    today: int
    # Presses of the WhatsApp order button, over the same three spans. Zero for a
    # plant nobody has pressed it on, and for all of them until the table exists.
    taps_total: int = 0
    taps_recent: int = 0
    taps_today: int = 0


class ViewsOnADay(BaseModel):
    day: date
    views: int


class PlantViewHistory(BaseModel):
    slug: str
    days: list[ViewsOnADay]
    total: int
