import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.media import MediaAsset
from app.schemas.media import MediaRead

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}
MAX_BYTES = 10 * 1024 * 1024


@router.post("", response_model=MediaRead, status_code=status.HTTP_201_CREATED)
async def upload_image(db: DbSession, user: CurrentUser, file: UploadFile = File(...)):
    """
    Editors upload plant photos here; image and gallery blocks reference the
    returned URL.

    Local disk for now — swap for S3 or Cloudinary before launch, since most
    hosts give containers an ephemeral filesystem.
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported type {file.content_type}. Allowed: {sorted(ALLOWED_TYPES)}",
        )

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be 10MB or smaller",
        )

    suffix = Path(file.filename or "").suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{suffix}"

    media_root = Path(settings.MEDIA_ROOT)
    media_root.mkdir(parents=True, exist_ok=True)
    (media_root / stored_name).write_bytes(contents)

    asset = MediaAsset(
        filename=file.filename or stored_name,
        url=f"{settings.MEDIA_URL}/{stored_name}",
        content_type=file.content_type,
        size_bytes=len(contents),
        uploaded_by_id=user.id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("", response_model=list[MediaRead])
def list_media(db: DbSession, user: CurrentUser):
    return db.query(MediaAsset).order_by(MediaAsset.created_at.desc()).all()
