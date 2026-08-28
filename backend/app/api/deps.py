from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Same scheme, but a missing token yields None instead of a 401. Used by
# endpoints that are public but show more to a signed-in editor.
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", auto_error=False
)

DbSession = Annotated[Session, Depends(get_db)]


def _email_from_token(token: str) -> str | None:
    """The token subject, but only if it is still the configured admin."""
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return None

    email = payload.get("sub")
    if not email:
        return None

    # Changing ADMIN_EMAIL invalidates tokens issued for the old address.
    if email.strip().lower() != settings.ADMIN_EMAIL.strip().lower():
        return None

    return email


def get_current_admin(token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    email = _email_from_token(token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return email


def get_current_admin_optional(
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
) -> str | None:
    """None for anonymous visitors — never raises."""
    if not token:
        return None
    return _email_from_token(token)


CurrentUser = Annotated[str, Depends(get_current_admin)]
OptionalUser = Annotated[str | None, Depends(get_current_admin_optional)]
