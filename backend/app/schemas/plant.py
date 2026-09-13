from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.block import BlockRead
from app.schemas.category import CategoryRead
from app.schemas.common import Slug, Text


class PlantBase(BaseModel):
    slug: Slug(160)
    common_name: Text(200, required=True)
    scientific_name: Text(200) | None = None
    summary: Text(500) | None = None
    cover_image_url: Text(500) | None = None
    category_id: int | None = None
    is_published: bool = False


class PlantCreate(PlantBase):
    pass


class PlantUpdate(BaseModel):
    common_name: Text(200, required=True) | None = None
    scientific_name: Text(200) | None = None
    summary: Text(500) | None = None
    cover_image_url: Text(500) | None = None
    category_id: int | None = None
    is_published: bool | None = None
    # slug is intentionally absent: printed QR labels depend on it never changing.

    @field_validator("common_name", "is_published")
    @classmethod
    def _not_null(cls, value):
        # Omitting a field leaves it alone; sending null would break a NOT NULL column.
        if value is None:
            raise ValueError("cannot be null")
        return value


class PlantListItem(BaseModel):
    # Plain types, not PlantBase: input rules must never make an existing row
    # unreadable, or one legacy slug would take down the whole list.
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    common_name: str
    scientific_name: str | None = None
    summary: str | None = None
    cover_image_url: str | None = None
    category_id: int | None = None
    is_published: bool
    updated_at: datetime


class PlantDetail(PlantListItem):
    """What a QR scan resolves to: the plant plus its ordered blocks."""

    category: CategoryRead | None = None
    blocks: list[BlockRead] = []
