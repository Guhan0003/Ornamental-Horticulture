from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.models.block import ContentBlock
from app.models.plant import Plant
from app.schemas.block import BlockCreate, BlockRead, BlockUpdate

router = APIRouter()


class ReorderRequest(BaseModel):
    """New order for a plant's blocks, as block ids in display order."""

    block_ids: list[int]


@router.post(
    "/plant/{plant_id}", response_model=BlockRead, status_code=status.HTTP_201_CREATED
)
def add_block(plant_id: int, payload: BlockCreate, db: DbSession, user: CurrentUser):
    if db.get(Plant, plant_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found"
        )

    block = ContentBlock(plant_id=plant_id, **payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.patch("/{block_id}", response_model=BlockRead)
def update_block(block_id: int, payload: BlockUpdate, db: DbSession, user: CurrentUser):
    block = db.get(ContentBlock, block_id)
    if block is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Block not found"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(block, field, value)

    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(block_id: int, db: DbSession, user: CurrentUser):
    block = db.get(ContentBlock, block_id)
    if block is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Block not found"
        )

    db.delete(block)
    db.commit()


@router.put("/plant/{plant_id}/reorder", response_model=list[BlockRead])
def reorder_blocks(
    plant_id: int, payload: ReorderRequest, db: DbSession, user: CurrentUser
):
    """Drag-and-drop reordering in the admin panel lands here."""
    if db.get(Plant, plant_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found"
        )

    blocks = db.query(ContentBlock).filter(ContentBlock.plant_id == plant_id).all()
    by_id = {block.id: block for block in blocks}

    if set(payload.block_ids) != set(by_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="block_ids must list exactly the blocks belonging to this plant",
        )

    for position, block_id in enumerate(payload.block_ids):
        by_id[block_id].position = position

    db.commit()
    return sorted(by_id.values(), key=lambda block: block.position)
