import io

from PIL import Image, ImageOps

from app.core.config import settings

# Formats we accept from an editor's phone or laptop.
ACCEPTED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}


class UnsupportedImage(ValueError):
    pass


def optimize(content: bytes) -> tuple[bytes, str, str]:
    """
    Resize and re-encode an upload to something a phone on store Wi-Fi can load.

    A 4MB photo straight off a camera is the single easiest way to make a plant
    page unusable, so this is not optional polish.

    Returns (data, content_type, file_extension).
    """
    try:
        image = Image.open(io.BytesIO(content))
        image.load()
    except Exception as exc:  # Pillow raises a variety of types here
        raise UnsupportedImage("That file could not be read as an image") from exc

    # Phone photos carry rotation in EXIF; bake it in before we strip metadata.
    image = ImageOps.exif_transpose(image)

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.mode else "RGB")

    limit = settings.IMAGE_MAX_DIMENSION
    if max(image.size) > limit:
        image.thumbnail((limit, limit), Image.LANCZOS)

    buffer = io.BytesIO()
    # WebP: broad support, and markedly smaller than JPEG at equal quality.
    # save() writes no EXIF here, so location data in the original is dropped.
    image.save(buffer, format="WEBP", quality=settings.IMAGE_QUALITY, method=6)
    return buffer.getvalue(), "image/webp", ".webp"
