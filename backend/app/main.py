from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings

# The schema is managed by Alembic: run `alembic upgrade head` before starting.

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Backend for the QR-code plant pages.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Local development stores uploads on disk and serves them from here. With
# Supabase Storage the photos have their own public URLs, and on Vercel the disk
# is read-only, so creating the folder would crash the app at startup.
if not settings.uses_supabase_storage:
    media_root = Path(settings.MEDIA_ROOT)
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount(settings.MEDIA_URL, StaticFiles(directory=media_root), name="media")


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
