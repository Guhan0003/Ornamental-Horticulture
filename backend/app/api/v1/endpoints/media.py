from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.models.media import MediaAsset
from app.schemas.media import MediaRead
from app.services.images import ACCEPTED_TYPES, UnsupportedImage, optimize
from app.services.storage import StorageError, get_storage

router = APIRouter()

# Generous, because this is the size BEFORE optimisation — a phone photo is
# routinely 5MB and we shrink it ourselves.
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("", response_model=MediaRead, status_code=status.HTTP_201_CREATED)
async def upload_image(db: DbSession, email: CurrentUser, file: UploadFile = File(...)):
    """
    Upload a plant photo.

    The file is resized and re-encoded to WebP before storage, so what a
    customer downloads in a shop is a fraction of what was uploaded.
    """
    if file.content_type not in ACCEPTED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported type {file.content_type}. "
            f"Allowed: {', '.join(sorted(ACCEPTED_TYPES))}",
        )

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image must be {MAX_UPLOAD_BYTES // (1024 * 1024)}MB or smaller",
        )

    try:
        data, content_type, extension = optimize(contents)
    except UnsupportedImage as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    try:
        url = get_storage().save(data, extension, content_type)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    asset = MediaAsset(
        filename=file.filename or f"upload{extension}",
        url=url,
        content_type=content_type,
        size_bytes=len(data),
        uploaded_by=email,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("", response_model=list[MediaRead])
def list_media(db: DbSession, email: CurrentUser):
    return db.query(MediaAsset).order_by(MediaAsset.created_at.desc()).all()
