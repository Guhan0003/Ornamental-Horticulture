from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.views import PlantViewCount, PlantViewHistory, ViewsOnADay
from app.services import views

router = APIRouter()

# Admin only. How often a plant is looked at is the shop's business, not
# something to hand to anyone who asks the public API for it.


@router.get("", response_model=list[PlantViewCount])
def view_counts(db: DbSession, user: CurrentUser, days: int = 30):
    """Every plant that has ever been looked at, most-viewed first."""
    counts = views.totals(db, days=days)
    rows = [
        PlantViewCount(slug=slug, total=c["total"], recent=c["recent"], today=c["today"])
        for slug, c in counts.items()
    ]
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
