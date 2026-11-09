import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import Slug, Text

# Keep in step with frontend/src/lib/plantFormat.js.
LIGHT_LEVELS = 4  # Low, Medium, Bright indirect, Direct sun
DeepDiveIcon = Literal["origin", "water", "sparkle", "paw", "sun", "home", "landscape", "pot"]

LightLevel = Annotated[int, Field(ge=0, le=LIGHT_LEVELS - 1)]

# The cover plus its gallery. "As many as it needs", capped so a plant page and
# its JSON stay light on a shop's Wi-Fi. Keep in step with frontend/src/lib/plantFormat.js.
MAX_PHOTOS = 12

# Keep in step with frontend/src/lib/commerce.js.
Availability = Literal["in_stock", "ask", "sold_out"]

# Paise. A price of nothing is "no price" (null), never 0; the ceiling is ₹10 lakh,
# far past any plant and comfortably inside a Postgres integer.
PriceMinor = Annotated[int, Field(ge=1, le=100_000_000)]


def price_problem(price: int | None, original: int | None) -> str | None:
    """Why this pair of prices makes no sense, or None if it is fine."""
    if original is None:
        return None
    if price is None:
        return "Add a price before an original price."
    if original <= price:
        return "The original price must be higher than the price."
    return None

_IMAGE_URL = re.compile(r"^(https?://|/)\S+$")
_PLACEHOLDER = re.compile(r"^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$")
_HEX_COLOUR = re.compile(r"^#[0-9a-fA-F]{6}$")


class PlantImage(BaseModel):
    url: Text(500, required=True)
    alt: Text(300) = ""
    # Tiny blurred preview and backdrop colour, both produced by the upload
    # endpoint. They end up in inline styles, so they are pattern-checked.
    placeholder: Text(4000) = ""
    background: Text(7) = ""

    @field_validator("url")
    @classmethod
    def _url(cls, value: str) -> str:
        # Only real links — never javascript: or data: in an <img src>.
        if not _IMAGE_URL.fullmatch(value):
            raise ValueError("must be an http(s) URL or a site path")
        return value

    @field_validator("placeholder")
    @classmethod
    def _placeholder(cls, value: str) -> str:
        if value and not _PLACEHOLDER.fullmatch(value):
            raise ValueError("must be a base64 image data URI")
        return value

    @field_validator("background")
    @classmethod
    def _background(cls, value: str) -> str:
        if value and not _HEX_COLOUR.fullmatch(value):
            raise ValueError("must be a colour like #c3c4c9")
        return value


class LightNeed(BaseModel):
    label: Text(120) = ""
    note: Text(120) = ""
    ideal: list[LightLevel] = Field(default_factory=list, max_length=LIGHT_LEVELS)
    tolerates: list[LightLevel] = Field(default_factory=list, max_length=LIGHT_LEVELS)

    @model_validator(mode="after")
    def _levels(self) -> "LightNeed":
        self.ideal = sorted(set(self.ideal))
        self.tolerates = sorted(set(self.tolerates) - set(self.ideal))
        return self


class UseList(BaseModel):
    items: list[Text(80, required=True)] = Field(default_factory=list, max_length=12)
    note: Text(120) = ""


class Profile(BaseModel):
    environment: Text(40) = ""
    light: LightNeed = Field(default_factory=LightNeed)
    landscape_use: UseList = Field(default_factory=UseList)
    home_use: UseList = Field(default_factory=UseList)


class DeepDivePoint(BaseModel):
    icon: DeepDiveIcon = "sparkle"
    title: Text(80, required=True)
    body: Text(1500, required=True)


class PlantFields(BaseModel):
    common_name: Text(200, required=True)
    scientific_name: Text(200) = ""
    # The cover, and the photos after it in swiping order.
    image: PlantImage
    gallery: list[PlantImage] = Field(default_factory=list, max_length=MAX_PHOTOS - 1)
    profile: Profile = Field(default_factory=Profile)
    snap: Text(600, required=True)
    deep_dive: list[DeepDivePoint] = Field(min_length=1, max_length=12)
    price_minor: PriceMinor | None = None
    original_price_minor: PriceMinor | None = None
    price_note: Text(120) = ""
    availability: Availability = "in_stock"


class PlantCreate(PlantFields):
    slug: Slug(160)

    @model_validator(mode="after")
    def _prices(self) -> "PlantCreate":
        problem = price_problem(self.price_minor, self.original_price_minor)
        if problem:
            raise ValueError(problem)
        return self


CLEARABLE = frozenset({"price_minor", "original_price_minor"})


class PlantUpdate(BaseModel):
    """Every field optional; omitted fields are left alone. The slug is absent on purpose."""

    common_name: Text(200, required=True) | None = None
    scientific_name: Text(200) | None = None
    image: PlantImage | None = None
    # Send [] to clear it; null is refused like the other sections.
    gallery: list[PlantImage] | None = Field(default=None, max_length=MAX_PHOTOS - 1)
    profile: Profile | None = None
    snap: Text(600, required=True) | None = None
    deep_dive: list[DeepDivePoint] | None = Field(default=None, min_length=1, max_length=12)
    # Unlike the sections above, a price can be taken away by sending null.
    price_minor: PriceMinor | None = None
    original_price_minor: PriceMinor | None = None
    price_note: Text(120) | None = None
    availability: Availability | None = None

    @field_validator("*")
    @classmethod
    def _not_null(cls, value, info):
        # Sending null explicitly would wipe a required section.
        if value is None and info.field_name not in CLEARABLE:
            raise ValueError("cannot be null; omit the field to leave it unchanged")
        return value


class PlantRead(PlantFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    currency: str = "INR"
    created_at: datetime
    updated_at: datetime
    # Filled in when a page is read. They travel with the plant rather than in
    # a second request: one round trip is the whole game on shop Wi-Fi.
    related: list["PlantSummary"] = Field(default_factory=list)


class PlantSummary(BaseModel):
    """What the home page, its search and the admin list need: enough to show a card."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    common_name: str
    scientific_name: str
    image: PlantImage
    price_minor: int | None
    original_price_minor: int | None
    currency: str
    price_note: str
    availability: str
    updated_at: datetime


PlantRead.model_rebuild()
