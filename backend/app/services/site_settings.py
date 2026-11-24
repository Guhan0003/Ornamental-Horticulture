from sqlalchemy.orm import Session

from app.models.site_setting import SiteSetting
from app.schemas.settings import SiteSettingsRead, SiteSettingsUpdate

KEYS = tuple(SiteSettingsRead.model_fields)


def read(db: Session) -> SiteSettingsRead:
    saved = {row.key: row.value for row in db.query(SiteSetting).all() if row.key in KEYS}
    return SiteSettingsRead(**saved)


def save(db: Session, update: SiteSettingsUpdate) -> SiteSettingsRead:
    """Keep every value the dashboard sent, replacing what was there."""
    existing = {row.key: row for row in db.query(SiteSetting).all()}
    for key, value in update.model_dump().items():
        if key in existing:
            existing[key].value = value
        else:
            db.add(SiteSetting(key=key, value=value))
    db.commit()
    return read(db)
