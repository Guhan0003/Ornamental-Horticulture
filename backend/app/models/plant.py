from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Plant(Base):
    """
    One plant — one page, one permanent URL, and later one QR code.

    The columns follow the sections of the plant page. The nested parts
    (image, quick profile, deep dive) are JSON: their shape is enforced by the
    Pydantic schemas on the way in, and they are only ever read whole.
    """

    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(primary_key=True)

    # The permanent public address. Set at creation and never changed, because
    # a printed QR label cannot be changed.
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)

    common_name: Mapped[str] = mapped_column(String(200))
    scientific_name: Mapped[str] = mapped_column(String(200), default="")

    # {"url", "alt", "placeholder", "background"}
    image: Mapped[dict[str, Any]] = mapped_column(JSON)

    # {"environment", "light": {...}, "landscape_use": {...}, "home_use": {...}}
    profile: Mapped[dict[str, Any]] = mapped_column(JSON)

    # The Snap — the short description.
    snap: Mapped[str] = mapped_column(Text)

    # The Deep Dive — [{"icon", "title", "body"}, ...]
    deep_dive: Mapped[list[dict[str, Any]]] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class RetiredSlug(Base):
    """
    Addresses of deleted plants.

    A QR label may still be stuck on a shelf somewhere, so a deleted plant's
    address must never be given to a different plant.
    """

    __tablename__ = "retired_slugs"

    slug: Mapped[str] = mapped_column(String(160), primary_key=True)
    retired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
