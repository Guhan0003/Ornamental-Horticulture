from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

# The schema is managed by Alembic: run `alembic upgrade head` before starting.

# Nothing this API serves is meant to be framed, content-type sniffed, or used
# as a referrer source.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response


def create_app() -> FastAPI:
    # The interactive docs are a map of the admin API. Useful while building,
    # nothing a visitor needs, so they are development-only.
    hidden_docs = (
        {"docs_url": None, "redoc_url": None, "openapi_url": None}
        if settings.is_production
        else {}
    )

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="Backend for the QR-code plant pages.",
        **hidden_docs,
    )

    app.add_middleware(SecurityHeaders)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        # Preview deployments get a fresh hostname each push, so they are
        # matched by pattern rather than listed.
        allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Local development stores uploads on disk and serves them from here. With
    # Supabase Storage the photos have their own public URLs, and on Vercel the
    # disk is read-only, so creating the folder would crash the app at startup.
    if not settings.uses_supabase_storage:
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)
        app.mount(settings.MEDIA_URL, StaticFiles(directory=media_root), name="media")

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


# Vercel and uvicorn both import this name.
app = create_app()
