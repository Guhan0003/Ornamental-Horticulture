"""
Counting how often each plant's page is opened.

The point is to find out which printed labels actually get scanned — which
shelf earns its QR code and which one nobody looks at twice.

Two things shape how this is written. It must not slow the page down: the
whole product is someone on a shop's Wi-Fi, and an analytics write has no
business sitting between them and the plant, so the counting happens after
the response has gone out. And it must not lie: crawlers hit these pages too,
and a number inflated by bots is worse than no number at all.
"""

import logging
import re
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.plant_view import PlantView

logger = logging.getLogger(__name__)

# Enough to catch the honest crawlers, which is most of the traffic that
# isn't a person. Anything pretending to be a phone will get counted, and
# that is a fine place to stop for a shop's analytics.
_BOT = re.compile(
    r"bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|"
    r"whatsapp|telegram|preview|monitor|curl|wget|python-httpx|python-requests",
    re.I,
)


def looks_like_a_person(user_agent: str) -> bool:
    return bool(user_agent) and not _BOT.search(user_agent)


def record_view(slug: str, user_agent: str = "", today: date | None = None) -> None:
    """
    Add one to a plant's count for today.

    Runs after the response, in its own session, because the request's own
    session is closed by then. Analytics must never be the reason a page
    fails, so anything that goes wrong here is logged and swallowed.
    """
    if not looks_like_a_person(user_agent):
        return

    day = today or date.today()
    db = SessionLocal()
    try:
        _increment(db, slug, day)
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Could not count a view of %s", slug, exc_info=True)
    finally:
        db.close()


def _increment(db: Session, slug: str, day: date) -> None:
    updated = (
        db.query(PlantView)
        .filter(PlantView.slug == slug, PlantView.day == day)
        .update({PlantView.views: PlantView.views + 1}, synchronize_session=False)
    )

    if updated:
        db.commit()
        return

    # First view of the day. Two requests can arrive here together, and the
    # loser of that race just adds to the row the winner created.
    try:
        db.add(PlantView(slug=slug, day=day, views=1))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        db.query(PlantView).filter(PlantView.slug == slug, PlantView.day == day).update(
            {PlantView.views: PlantView.views + 1}, synchronize_session=False
        )
        db.commit()


def totals(db: Session, days: int = 30) -> dict[str, dict[str, int]]:
    """Views per plant: all time, the last `days`, and today. Admin only."""
    since = date.today() - timedelta(days=days - 1)

    counts: dict[str, dict[str, int]] = {}
    for slug, total in db.query(PlantView.slug, func.sum(PlantView.views)).group_by(
        PlantView.slug
    ):
        counts[slug] = {"total": int(total or 0), "recent": 0, "today": 0}

    recent = (
        db.query(PlantView.slug, func.sum(PlantView.views))
        .filter(PlantView.day >= since)
        .group_by(PlantView.slug)
    )
    for slug, total in recent:
        counts[slug]["recent"] = int(total or 0)

    for row in db.query(PlantView).filter(PlantView.day == date.today()):
        counts[row.slug]["today"] = row.views

    return counts


def daily(db: Session, slug: str, days: int = 30) -> list[tuple[date, int]]:
    """
    One plant, day by day, oldest first, with the quiet days filled in as 0
    so a chart doesn't have to guess what a missing day means.
    """
    first = date.today() - timedelta(days=days - 1)
    seen = {
        row.day: row.views
        for row in db.query(PlantView).filter(
            PlantView.slug == slug, PlantView.day >= first
        )
    }
    return [(first + timedelta(days=n), seen.get(first + timedelta(days=n), 0)) for n in range(days)]
