import base64
import io
from dataclasses import dataclass

from PIL import Image, ImageOps

from app.core.config import settings

# Formats we accept from an editor's phone or laptop.
ACCEPTED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif"}

PLACEHOLDER_WIDTH = 20


class UnsupportedImage(ValueError):
    pass


@dataclass(frozen=True)
class OptimizedImage:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int
    # A ~20px WebP as a data URI, blurred up while the real photo loads.
    placeholder: str
    # The photo's average colour, e.g. "#c3c4c9", for the page behind it.
    background: str


def optimize(content: bytes) -> OptimizedImage:
    """
    Resize and re-encode an upload to something a phone on store Wi-Fi can load.

    A 4MB photo straight off a camera is the single easiest way to make a plant
    page unusable, so this is not optional polish.
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

    return OptimizedImage(
        data=buffer.getvalue(),
        content_type="image/webp",
        extension=".webp",
        width=image.width,
        height=image.height,
        placeholder=_placeholder(image),
        background=_average_colour(image),
    )


def _placeholder(image: Image.Image) -> str:
    height = max(1, round(image.height * PLACEHOLDER_WIDTH / image.width))
    tiny = image.convert("RGB").resize((PLACEHOLDER_WIDTH, height), Image.LANCZOS)
    buffer = io.BytesIO()
    tiny.save(buffer, format="WEBP", quality=60)
    return "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _average_colour(image: Image.Image) -> str:
    # Average the outer edge rather than the whole photo: the edge is the
    # backdrop the page colour has to blend into, not the plant itself.
    small = image.convert("RGB").resize((24, 24), Image.BOX)
    edge = [
        small.getpixel((x, y))
        for x in range(24)
        for y in range(24)
        if x in (0, 23) or y in (0, 23)
    ]
    r, g, b = (sum(pixel[i] for pixel in edge) // len(edge) for i in range(3))
    return f"#{r:02x}{g:02x}{b:02x}"
