from datetime import date

from pydantic import BaseModel


class PlantViewCount(BaseModel):
    """How often one plant has been looked at."""

    slug: str
    total: int
    # The window the dashboard asks for, 30 days by default.
    recent: int
    today: int


class ViewsOnADay(BaseModel):
    day: date
    views: int


class PlantViewHistory(BaseModel):
    slug: str
    days: list[ViewsOnADay]
    total: int
