from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.block import BlockRead
from app.schemas.category import CategoryRead


class PlantBase(BaseModel):
    slug: str
    common_name: str
    scientific_name: str | None = None
    summary: str | None = None
    cover_image_url: str | None = None
    category_id: int | None = None
    is_published: bool = False


class PlantCreate(PlantBase):
    pass


class PlantUpdate(BaseModel):
    common_name: str | None = None
    scientific_name: str | None = None
    summary: str | None = None
    cover_image_url: str | None = None
    category_id: int | None = None
    is_published: bool | None = None
    # slug is intentionally absent: printed QR labels depend on it never changing.


class PlantListItem(PlantBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class PlantDetail(PlantListItem):
    """What a QR scan resolves to: the plant plus its ordered blocks."""

    category: CategoryRead | None = None
    blocks: list[BlockRead] = []
