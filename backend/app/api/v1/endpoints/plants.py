from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.models.plant import Plant, RetiredSlug
from app.schemas.plant import PlantCreate, PlantRead, PlantSummary, PlantUpdate

router = APIRouter()


def _get_or_404(db: DbSession, slug: str) -> Plant:
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return plant


@router.get("", response_model=list[PlantSummary])
def list_plants(db: DbSession):
    """Every plant, A–Z. Feeds the home page search and the admin list."""
    return db.query(Plant).order_by(Plant.common_name).all()


@router.get("/{slug}", response_model=PlantRead)
def get_plant(slug: str, db: DbSession):
    """Everything needed to render one plant page, in a single request."""
    return _get_or_404(db, slug)


@router.post("", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(payload: PlantCreate, db: DbSession, user: CurrentUser):
    if db.query(Plant).filter(Plant.slug == payload.slug).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another plant already uses that address.",
        )
    if db.get(RetiredSlug, payload.slug):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That address belonged to a deleted plant and can't be reused — "
            "an old QR label may still point at it.",
        )

    plant = Plant(**payload.model_dump())
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.patch("/{slug}", response_model=PlantRead)
def update_plant(slug: str, payload: PlantUpdate, db: DbSession, user: CurrentUser):
    plant = _get_or_404(db, slug)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plant, field, value)

    db.commit()
    db.refresh(plant)
    return plant


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(slug: str, db: DbSession, user: CurrentUser):
    plant = _get_or_404(db, slug)

    db.delete(plant)
    db.add(RetiredSlug(slug=slug))
    db.commit()
