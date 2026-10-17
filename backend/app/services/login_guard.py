"""
Failed-login lockout for the single admin password.

Five wrong guesses from one client and that client has to wait, so the one
password protecting the dashboard can't be worked through at network speed.
Counts live in the database because the API runs as serverless functions: an
in-process counter would reset whenever a new instance answered the request.
"""

import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.login_attempt import LoginAttempt


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    # SQLite forgets the offset, so a value read back in development is naive.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _window() -> timedelta:
    return timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)


def client_key(request: Request) -> str:
    """
    Which client a failed attempt belongs to.

    Behind Vercel the caller's real address arrives only in a forwarded
    header. Those headers are trivial to forge, and trusting them where
    nothing sets them would hand a guesser a fresh allowance per request, so
    they are read only when TRUST_PROXY_HEADERS says a proxy is in front.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-vercel-forwarded-for") or request.headers.get(
            "x-forwarded-for"
        )
        if forwarded:
            # Left-most entry is the original client; the rest are proxies.
            return forwarded.split(",")[0].strip()[:64]

    return request.client.host[:64] if request.client else "unknown"


def check_not_locked(db: Session, client: str) -> None:
    """Refuse a locked-out client before the password is even looked at."""
    attempt = db.get(LoginAttempt, client)
    if attempt is None or attempt.locked_until is None:
        return

    remaining = _as_utc(attempt.locked_until) - _now()
    if remaining.total_seconds() <= 0:
        return

    minutes = max(1, math.ceil(remaining.total_seconds() / 60))
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many failed sign-in attempts. Try again in {minutes} "
        f"minute{'s' if minutes != 1 else ''}.",
        headers={"Retry-After": str(math.ceil(remaining.total_seconds()))},
    )


def record_failure(db: Session, client: str) -> None:
    """Count a wrong guess, and lock the client once the allowance is gone."""
    now = _now()
    attempt = db.get(LoginAttempt, client)

    if attempt is None:
        attempt = LoginAttempt(client=client, failures=1, last_failure_at=now)
        db.add(attempt)
    else:
        lock_ran_out = (
            attempt.locked_until is not None and _as_utc(attempt.locked_until) <= now
        )
        went_quiet = _as_utc(attempt.last_failure_at) < now - _window()
        # A served lockout, or a long quiet spell, earns a fresh allowance.
        attempt.failures = 1 if (lock_ran_out or went_quiet) else attempt.failures + 1
        attempt.last_failure_at = now
        attempt.locked_until = None

    if attempt.failures >= settings.LOGIN_MAX_FAILURES:
        attempt.locked_until = now + _window()

    # Write this client's row before pruning, so the prune can't delete the
    # pre-update row from under it and strand the pending change.
    db.flush()
    _forget_stale(db, now, keep=client)
    db.commit()


def record_success(db: Session, client: str) -> None:
    """A correct password clears the client's history."""
    attempt = db.get(LoginAttempt, client)
    if attempt is not None:
        db.delete(attempt)
        db.commit()


def _forget_stale(db: Session, now: datetime, *, keep: str) -> None:
    """
    Drop rows for clients that have gone quiet.

    Anyone on the internet can make this table grow by one row, so rows that
    no longer hold anything back are cleared out as we go. A row older than
    the window can only be an expired lock or a spent count, never an active
    one: a live lock always runs from its own last failure.
    """
    db.query(LoginAttempt).filter(
        LoginAttempt.last_failure_at < now - _window(),
        LoginAttempt.client != keep,
    ).delete(synchronize_session=False)
