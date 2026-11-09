"""
Letting go of photos nobody points at any more.

Every upload is a new object in storage, so replacing a plant's photos or
deleting the plant leaves the old files behind. Nothing ever collected those,
so storage could only grow, and no one could tell which files were still live.
"""

import logging
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.plant import Plant
from app.services.storage import StorageError, get_storage

logger = logging.getLogger(__name__)


def photo_urls(plant: Plant) -> set[str]:
    """Every photo a plant shows: its cover, then its gallery."""
    urls = [plant.image.get("url", ""), *(photo.get("url", "") for photo in plant.gallery or [])]
    return {url for url in urls if url}


def discard_unused(db: Session, urls: Iterable[str]) -> None:
    """
    Delete these photos from storage, except any that a plant still shows.

    Called after the database already has its way. Storage failing is not a
    reason to fail the admin's request — the plant really was saved or deleted —
    so a problem here is logged and left: the worst case is a file nobody reads.
    """
    candidates = {url for url in urls if url}
    if not candidates:
        return

    for url in sorted(candidates - _in_use(db)):
        try:
            get_storage().delete(url)
        except (StorageError, OSError):
            # The plant is already saved or gone; never fail that for a file.
            logger.warning("Could not delete the photo at %s", url, exc_info=True)


def _in_use(db: Session) -> set[str]:
    # An admin can point two plants at one photo by pasting its address, and a
    # photo can move from a plant's cover to its gallery, so this asks every
    # plant, cover and gallery alike, rather than assuming uploads are never
    # shared. It runs only when photos are replaced or a plant deleted, never on
    # a page view.
    urls: set[str] = set()
    for image, gallery in db.query(Plant.image, Plant.gallery).all():
        urls.add(image.get("url", ""))
        urls.update(photo.get("url", "") for photo in gallery or [])
    return urls
