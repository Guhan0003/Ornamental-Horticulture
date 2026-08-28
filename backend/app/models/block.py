import enum
from typing import Any

from sqlalchemy import Enum, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BlockType(str, enum.Enum):
    """
    The kinds of section an editor can drop onto a plant page.

    Adding a type here plus a matching component in the frontend's
    BlockRenderer is the whole cost of a new section format.
    """

    HEADING = "heading"
    TEXT = "text"
    IMAGE = "image"
    GALLERY = "gallery"
    FACTS = "facts"


class ContentBlock(Base):
    """
    This is what makes the page format dynamic.

    A plant page is not a fixed template — it is an ordered list of blocks
    composed in the admin panel. The shape of each block's content lives in
    the JSON `data` column, so an editor can restructure a page, and we can
    introduce new block types, without a database migration.

    `data` shape by type:
      heading -> {"text": str, "level": int}
      text    -> {"body": str}
      image   -> {"url": str, "alt": str, "caption": str}
      gallery -> {"images": [{"url": str, "alt": str}]}
      facts   -> {"items": [{"label": str, "value": str}]}
    """

    __tablename__ = "content_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id"), index=True)
    plant: Mapped["Plant"] = relationship(back_populates="blocks")  # noqa: F821

    type: Mapped[BlockType] = mapped_column(Enum(BlockType))
    position: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
