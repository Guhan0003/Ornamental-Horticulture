"""
Counting how often the WhatsApp order button is pressed on each plant.

Views say which plants people look at; taps say which of those they go on to ask
about. The two together are what tells the shop whether a plant needs a better
photo, a lower price, or just a spot nearer the front.

This must never get in the way of the order itself. The page sends the tap as a
beacon, in the same moment WhatsApp opens, so nothing here is waited on, and
anything that goes wrong is logged and swallowed rather than shown to anyone.
"""

import logging
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.plant_tap import PlantTap

logger = logging.getLogger(__name__)


def record_tap(db: Session, slug: str, day: date | None = None) -> None:
    """Add one to a plant's tap count for today. Never raises."""
    day = day or date.today()
    try:
        _increment(db, slug, day)
    except SQLAlchemyError:
        # The usual cause is a database that has not had its latest migration
        # yet, and a customer pressing the order button should not feel that.
        db.rollback()
        logger.warning("Could not count a tap on %s", slug, exc_info=True)


def _increment(db: Session, slug: str, day: date) -> None:
    updated = (
        db.query(PlantTap)
        .filter(PlantTap.slug == slug, PlantTap.day == day)
        .update({PlantTap.taps: PlantTap.taps + 1}, synchronize_session=False)
    )

    if updated:
        db.commit()
        return

    # First tap of the day. Two taps can arrive here together, and the loser of
    # that race just adds to the row the winner created.
    try:
        db.add(PlantTap(slug=slug, day=day, taps=1))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        db.query(PlantTap).filter(PlantTap.slug == slug, PlantTap.day == day).update(
            {PlantTap.taps: PlantTap.taps + 1}, synchronize_session=False
        )
        db.commit()


def totals(db: Session, days: int = 30) -> dict[str, dict[str, int]]:
    """
    Taps per plant: all time, the last `days`, and today. Admin only.

    Empty, not an error, if the table is not there yet: the dashboard should
    still list its plants on the day the code ships ahead of its migration.
    """
    since = date.today() - timedelta(days=days - 1)

    try:
        counts: dict[str, dict[str, int]] = {}
        for slug, total in db.query(PlantTap.slug, func.sum(PlantTap.taps)).group_by(PlantTap.slug):
            counts[slug] = {"total": int(total or 0), "recent": 0, "today": 0}

        recent = (
            db.query(PlantTap.slug, func.sum(PlantTap.taps))
            .filter(PlantTap.day >= since)
            .group_by(PlantTap.slug)
        )
        for slug, total in recent:
            counts[slug]["recent"] = int(total or 0)

        for row in db.query(PlantTap).filter(PlantTap.day == date.today()):
            counts[row.slug]["today"] = row.taps
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Could not read tap counts", exc_info=True)
        return {}

    return counts
