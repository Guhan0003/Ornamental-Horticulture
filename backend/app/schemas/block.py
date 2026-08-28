from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.block import BlockType


class BlockBase(BaseModel):
    type: BlockType
    position: int = 0
    data: dict[str, Any] = {}


class BlockCreate(BlockBase):
    pass


class BlockUpdate(BaseModel):
    type: BlockType | None = None
    position: int | None = None
    data: dict[str, Any] | None = None


class BlockRead(BlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
