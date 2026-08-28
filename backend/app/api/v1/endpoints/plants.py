from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DbSession
from app.models.plant import Plant
from app.schemas.plant import PlantCreate, PlantDetail, PlantListItem, PlantUpdate

router = APIRouter()


@router.get("", response_model=list[PlantListItem])
def list_plants(db: DbSession, published_only: bool = True):
    query = db.query(Plant)
    if published_only:
        query = query.filter(Plant.is_published.is_(True))
    return query.order_by(Plant.common_name).all()


@router.get("/{slug}", response_model=PlantDetail)
def get_plant(slug: str, db: DbSession):
    """
    The QR-code target. Returns the plant with its ordered content blocks —
    everything needed to render the page in one request, because the visitor
    is standing in a store on poor Wi-Fi.
    """
    plant = (
        db.query(Plant)
        .options(joinedload(Plant.blocks), joinedload(Plant.category))
        .filter(Plant.slug == slug, Plant.is_published.is_(True))
        .first()
    )

    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found"
        )

    return plant


@router.post("", response_model=PlantDetail, status_code=status.HTTP_201_CREATED)
def create_plant(payload: PlantCreate, db: DbSession, user: CurrentUser):
    if db.query(Plant).filter(Plant.slug == payload.slug).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That slug is already taken. Slugs are permanent once a QR "
            "label is printed, so they cannot be reused.",
        )

    plant = Plant(**payload.model_dump())
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.patch("/{slug}", response_model=PlantDetail)
def update_plant(slug: str, payload: PlantUpdate, db: DbSession, user: CurrentUser):
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plant, field, value)

    db.commit()
    db.refresh(plant)
    return plant


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(slug: str, db: DbSession, user: CurrentUser):
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found"
        )

    db.delete(plant)
    db.commit()
