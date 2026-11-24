import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints

# What the owner can change from the dashboard. The site has its own copy of each
# of these built in (frontend/src/data/contact.js) and uses it until one is saved.

_PHONE_CHARS = re.compile(r"^\+[\d\s\-()]+$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
_INSTAGRAM_LINK = re.compile(r"^(?:https?://)?(?:www\.)?instagram\.com/([^/?#\s]+)", re.I)


def _phone(value: str) -> str:
    """
    A number with its country code, written the way people should see it.

    The country code is required because both links built from it need one:
    `tel:+…` to call, and `wa.me/…` to open WhatsApp, which does not understand a
    number without it. Left as typed, so "+91 86087 05789" stays that way.
    """
    if not value:
        return value
    if not _PHONE_CHARS.fullmatch(value):
        raise ValueError("start with the country code, like +91 86087 05789")
    digits = re.sub(r"\D", "", value)
    if not 8 <= len(digits) <= 15:
        raise ValueError("that does not look like a full phone number")
    return value


def _email(value: str) -> str:
    if value and not _EMAIL.fullmatch(value):
        raise ValueError("that does not look like an email address")
    return value


def _instagram(value: str) -> str:
    """The handle alone, whether it was typed as @name, name or pasted as a link."""
    if not value:
        return value
    link = _INSTAGRAM_LINK.match(value)
    handle = (link.group(1) if link else value).lstrip("@")
    if not _HANDLE.fullmatch(handle):
        raise ValueError("use the handle, like stomatalworld, or paste the profile link")
    return handle


Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=30), AfterValidator(_phone)]
Email = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120), AfterValidator(_email)]
Handle = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200), AfterValidator(_instagram)]
Greeting = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]


class SiteSettingsUpdate(BaseModel):
    """
    Everything the dashboard's settings page sends, every time. An empty value means
    "do not show this", for a contact that the shop does not have.
    """

    phone: Phone
    whatsapp: Phone
    email: Email
    instagram: Handle
    whatsapp_message: Greeting


class SiteSettingsRead(BaseModel):
    """
    What has been saved. A setting that never was is left out, so the site can tell
    "not set here, use the built-in one" from "set to nothing, show nothing".
    """

    phone: str | None = None
    whatsapp: str | None = None
    email: str | None = None
    instagram: str | None = None
    whatsapp_message: str | None = None
