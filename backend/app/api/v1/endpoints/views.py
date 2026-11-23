from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.views import PlantViewCount, PlantViewHistory, ViewsOnADay
from app.services import taps, views

router = APIRouter()

# Admin only. How often a plant is looked at is the shop's business, not
# something to hand to anyone who asks the public API for it.

NOTHING = {"total": 0, "recent": 0, "today": 0}


@router.get("", response_model=list[PlantViewCount])
def view_counts(db: DbSession, user: CurrentUser, days: int = 30):
    """
    Every plant that has been looked at or asked about, most-viewed first, with how
    often its WhatsApp order button was pressed beside it.
    """
    seen = views.totals(db, days=days)
    asked = taps.totals(db, days=days)

    rows = []
    for slug in seen.keys() | asked.keys():
        looked, pressed = seen.get(slug, NOTHING), asked.get(slug, NOTHING)
        rows.append(
            PlantViewCount(
                slug=slug,
                total=looked["total"],
                recent=looked["recent"],
                today=looked["today"],
                taps_total=pressed["total"],
                taps_recent=pressed["recent"],
                taps_today=pressed["today"],
            )
        )
    return sorted(rows, key=lambda row: (-row.recent, -row.total, row.slug))


@router.get("/{slug}", response_model=PlantViewHistory)
def view_history(slug: str, db: DbSession, user: CurrentUser, days: int = 30):
    """One plant, day by day, with quiet days as zero."""
    series = views.daily(db, slug, days=days)
    return PlantViewHistory(
        slug=slug,
        days=[ViewsOnADay(day=day, views=count) for day, count in series],
        total=sum(count for _, count in series),
    )
