import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import Slug, Text

# Keep in step with frontend/src/lib/plantFormat.js.
LIGHT_LEVELS = 4  # Low, Medium, Bright indirect, Direct sun
DeepDiveIcon = Literal["origin", "water", "sparkle", "paw", "sun", "home", "landscape", "pot"]

LightLevel = Annotated[int, Field(ge=0, le=LIGHT_LEVELS - 1)]

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
    image: PlantImage
    profile: Profile = Field(default_factory=Profile)
    snap: Text(600, required=True)
    deep_dive: list[DeepDivePoint] = Field(min_length=1, max_length=12)


class PlantCreate(PlantFields):
    slug: Slug(160)


class PlantUpdate(BaseModel):
    """Every field optional; omitted fields are left alone. The slug is absent on purpose."""

    common_name: Text(200, required=True) | None = None
    scientific_name: Text(200) | None = None
    image: PlantImage | None = None
    profile: Profile | None = None
    snap: Text(600, required=True) | None = None
    deep_dive: list[DeepDivePoint] | None = Field(default=None, min_length=1, max_length=12)

    @field_validator("*")
    @classmethod
    def _not_null(cls, value):
        # Sending null explicitly would wipe a required section.
        if value is None:
            raise ValueError("cannot be null; omit the field to leave it unchanged")
        return value


class PlantRead(PlantFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    created_at: datetime
    updated_at: datetime


class PlantSummary(BaseModel):
    """What the home search and the admin list need: enough to show a card."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    common_name: str
    scientific_name: str
    image: PlantImage
    updated_at: datetime
