from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LoginAttempt(Base):
    """
    Failed admin logins, counted per client.

    One password guards the whole dashboard, so this endpoint is the only
    thing between a guesser and every plant page. The count lives in the
    database rather than in memory on purpose: the API runs as serverless
    functions, and a process-local counter resets the moment a new instance
    picks up the request.
    """

    __tablename__ = "login_attempts"

    # The client address. 64 characters holds an IPv6 address comfortably.
    client: Mapped[str] = mapped_column(String(64), primary_key=True)

    failures: Mapped[int] = mapped_column(Integer, default=0)
    last_failure_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    # Set once the allowance runs out; null while the client is still free to try.
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
