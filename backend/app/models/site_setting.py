from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SiteSetting(Base):
    """
    One thing about the shop that the owner can change from the dashboard: a phone
    number, the WhatsApp number, the email address, the Instagram handle.

    A row per setting rather than a column per setting, so adding the next one is a
    line of code and not a migration. A setting with no row has never been set here,
    and the site uses the value built into it; a row holding an empty string means
    "show nothing", which is a different thing and is kept different.
    """

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(String(500), default="")
