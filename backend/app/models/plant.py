from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Plant(Base):
    """
    One plant — and therefore one QR code, one URL.

    `slug` is the permanent public identifier. Once a QR label is printed and
    stuck on a shelf it cannot be changed, so slugs must never be reused or
    repointed at a different plant.
    """

    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)

    common_name: Mapped[str] = mapped_column(String(200))
    scientific_name: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(String(500))
    cover_image_url: Mapped[str | None] = mapped_column(String(500))

    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    category: Mapped["Category | None"] = relationship(back_populates="plants")  # noqa: F821

    is_published: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    blocks: Mapped[list["ContentBlock"]] = relationship(  # noqa: F821
        back_populates="plant",
        cascade="all, delete-orphan",
        order_by="ContentBlock.position",
    )
