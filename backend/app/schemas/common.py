import re
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Plant pages live at the top level (/peace-lily), so a slug must not shadow a
# route the site itself uses.
RESERVED_SLUGS = frozenset({"admin", "api", "assets"})


def _check_slug(value: str) -> str:
    # A slug ends up in a printed QR code, so anything that needs URL-encoding,
    # contains a "/", or is empty would make a permanently broken address.
    if not SLUG_PATTERN.fullmatch(value):
        raise ValueError(
            "use lowercase letters, numbers and single hyphens, e.g. peace-lily"
        )
    if value in RESERVED_SLUGS:
        raise ValueError(f'"{value}" is used by the site itself; choose another address')
    return value


def Slug(max_length: int):
    """A URL-safe slug that fits its database column."""
    return Annotated[
        str, StringConstraints(max_length=max_length), AfterValidator(_check_slug)
    ]


def Text(max_length: int, *, required: bool = False):
    """
    A trimmed string with a length limit. Postgres rejects an over-long value
    with an error, which would surface as a 500 instead of a readable 422.
    """
    return Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, min_length=1 if required else 0, max_length=max_length
        ),
    ]
