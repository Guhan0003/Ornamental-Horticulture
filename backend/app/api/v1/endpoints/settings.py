from fastapi import APIRouter, Response
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import CurrentUser, DbSession
from app.api.v1.caching import cache_at_the_edge
from app.schemas.settings import SiteSettingsRead, SiteSettingsUpdate
from app.services import site_settings

router = APIRouter()


@router.get("", response_model=SiteSettingsRead, response_model_exclude_none=True)
def get_settings(db: DbSession, response: Response, fresh: bool = False):
    """
    The shop's contact details: public, because every page needs them to build its
    call and WhatsApp buttons.

    Kept at the CDN like the plant list, so it costs a visitor almost nothing. The
    site shows the details it has built in until this arrives, and remembers the
    last answer on the phone. `?fresh=1` skips the cache; the dashboard asks that way.
    """
    cache_at_the_edge(response, fresh)
    try:
        return site_settings.read(db)
    except SQLAlchemyError:
        # The code can ship a moment before its migration. Nothing saved is an
        # honest answer, and the site carries on with what it has built in.
        db.rollback()
        return SiteSettingsRead()


@router.put("", response_model=SiteSettingsRead, response_model_exclude_none=True)
def save_settings(update: SiteSettingsUpdate, db: DbSession, user: CurrentUser):
    """Admin only. Replaces all of it, so the page always sends the whole form."""
    return site_settings.save(db, update)
