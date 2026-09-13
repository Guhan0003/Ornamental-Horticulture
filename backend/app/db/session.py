import os
from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def engine_options(database_url: str, *, serverless: bool) -> dict[str, Any]:
    if database_url.startswith("sqlite"):
        # SQLite connections are single-thread by default; FastAPI uses a thread pool.
        return {"connect_args": {"check_same_thread": False}}

    options: dict[str, Any] = {
        # Supabase's transaction pooler (the one to use from serverless functions)
        # hands each transaction a different server connection, so prepared
        # statements from an earlier transaction don't exist. Turn them off.
        "connect_args": {"prepare_threshold": None},
        # A reused function instance may hold a connection the pooler has closed.
        "pool_pre_ping": True,
    }
    if serverless:
        # Don't keep connections open in a function that may be frozen between
        # requests; the Supabase pooler does the pooling.
        options["poolclass"] = NullPool
    return options


# Vercel sets VERCEL=1 in every deployment.
engine = create_engine(
    settings.DATABASE_URL,
    **engine_options(settings.DATABASE_URL, serverless=bool(os.environ.get("VERCEL"))),
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
