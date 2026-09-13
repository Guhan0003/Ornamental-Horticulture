import re
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _check_slug(value: str) -> str:
    # A slug ends up in a printed QR code, so anything that needs URL-encoding,
    # contains a "/", or is empty would make a permanently broken address.
    if not SLUG_PATTERN.fullmatch(value):
        raise ValueError(
            "use lowercase letters, numbers and single hyphens, e.g. monstera-deliciosa"
        )
    return value


def Slug(max_length: int):
    """A URL-safe slug that fits its database column."""
    return Annotated[
        str, StringConstraints(max_length=max_length), AfterValidator(_check_slug)
    ]


def Text(max_length: int, *, required: bool = False):
    """
    A string bounded by its database column. Postgres rejects an over-long value
    with an error, which would surface as a 500 instead of a readable 422.
    """
    return Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, min_length=1 if required else 0, max_length=max_length
        ),
    ]
