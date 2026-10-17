"""
Letting go of a photo nobody points at any more.

Every upload is a new object in storage, so replacing a plant's photo or
deleting the plant leaves the old file behind. Nothing ever collected those,
so storage could only grow, and no one could tell which files were still live.
"""

import logging

from sqlalchemy.orm import Session

from app.models.plant import Plant
from app.services.storage import StorageError, get_storage

logger = logging.getLogger(__name__)


def discard_if_unused(db: Session, url: str) -> None:
    """
    Delete a photo from storage, unless a plant still shows it.

    Called after the database already has its way. Storage failing is not a
    reason to fail the admin's request — the plant really was deleted — so a
    problem here is logged and left: the worst case is a file nobody reads.
    """
    if not url or _still_in_use(db, url):
        return

    try:
        get_storage().delete(url)
    except (StorageError, OSError):
        # The plant is already saved or gone; never fail that for a file.
        logger.warning("Could not delete the photo at %s", url, exc_info=True)


def _still_in_use(db: Session, url: str) -> bool:
    # An admin can point two plants at one photo by pasting its address, so
    # this asks every plant rather than assuming uploads are never shared.
    # It runs only when a photo is replaced or a plant deleted, never on a page view.
    return any(image.get("url") == url for (image,) in db.query(Plant.image).all())
