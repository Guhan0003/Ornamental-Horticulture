from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import CurrentUser
from app.schemas.media import UploadedImage
from app.services.images import ACCEPTED_TYPES, UnsupportedImage, optimize
from app.services.storage import StorageError, get_storage

router = APIRouter()

# Generous, because this is the size BEFORE optimisation — a phone photo is
# routinely 5MB and we shrink it ourselves.
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("", response_model=UploadedImage, status_code=status.HTTP_201_CREATED)
async def upload_image(user: CurrentUser, file: UploadFile = File(...)):
    """
    Upload a plant photo.

    The file is resized and re-encoded to WebP before storage, so what a
    customer downloads in a shop is a fraction of what was uploaded. The
    response also carries a tiny blurred preview and a backdrop colour for the
    plant page to show while the photo loads.
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
        image = optimize(contents)
    except UnsupportedImage as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        url = get_storage().save(image.data, image.extension, image.content_type)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return UploadedImage(
        url=url,
        placeholder=image.placeholder,
        background=image.background,
        width=image.width,
        height=image.height,
        size_bytes=len(image.data),
    )
