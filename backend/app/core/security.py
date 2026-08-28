import hmac
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"

# bcrypt truncates silently past this, so we reject instead of quietly
# ignoring the tail of a long passphrase.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {MAX_PASSWORD_BYTES} bytes when UTF-8 encoded"
        )
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    encoded = plain.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(encoded, hashed.encode("utf-8"))
    except ValueError:
        # Malformed hash in config — treat as a failed login, never a 500.
        return False


def authenticate(email: str, password: str) -> bool:
    """
    Check credentials against the single configured admin login.

    Both comparisons are constant-time: bcrypt is by construction, and the
    email uses compare_digest so a wrong address can't be distinguished from
    a wrong password by timing.
    """
    email_ok = hmac.compare_digest(
        email.strip().lower(), settings.ADMIN_EMAIL.strip().lower()
    )

    if settings.ADMIN_PASSWORD_HASH:
        password_ok = verify_password(password, settings.ADMIN_PASSWORD_HASH)
    else:
        password_ok = hmac.compare_digest(password, settings.ADMIN_PASSWORD)

    # Evaluate both before returning so the result doesn't leak which failed.
    return email_ok and password_ok


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": subject, "exp": expire}, settings.SECRET_KEY, algorithm=ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
