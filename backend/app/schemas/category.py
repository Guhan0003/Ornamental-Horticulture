from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import Slug, Text


class CategoryBase(BaseModel):
    name: Text(120, required=True)
    slug: Slug(120)
    description: Text(500) | None = None
    parent_id: int | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Text(120, required=True) | None = None
    slug: Slug(120) | None = None
    description: Text(500) | None = None
    parent_id: int | None = None

    @field_validator("name", "slug")
    @classmethod
    def _not_null(cls, value):
        # Omitting a field leaves it alone; sending null would break a NOT NULL column.
        if value is None:
            raise ValueError("cannot be null")
        return value


class CategoryRead(BaseModel):
    # Plain types, not CategoryBase: input rules must never make an existing
    # row unreadable.
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None = None
    parent_id: int | None = None
