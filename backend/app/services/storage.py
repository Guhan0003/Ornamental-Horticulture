import uuid
from pathlib import Path

import httpx

from app.core.config import settings


class StorageError(RuntimeError):
    pass


class LocalStorage:
    """Development only — most hosts wipe the container disk on redeploy."""

    def save(self, data: bytes, extension: str, content_type: str) -> str:
        name = f"{uuid.uuid4().hex}{extension}"
        root = Path(settings.MEDIA_ROOT)
        root.mkdir(parents=True, exist_ok=True)
        (root / name).write_bytes(data)
        return f"{settings.MEDIA_URL}/{name}"


class SupabaseStorage:
    """
    Supabase Storage over its REST API.

    Deliberately not using the supabase client library — this is one HTTP POST
    and one URL to build, and the library pulls in a large dependency tree.
    """

    def __init__(self) -> None:
        self.base = settings.SUPABASE_URL.rstrip("/")
        self.bucket = settings.SUPABASE_BUCKET
        self.key = settings.SUPABASE_SERVICE_KEY

    def _auth_headers(self) -> dict[str, str]:
        # New secret keys (sb_secret_...) aren't JWTs and belong only in `apikey`;
        # sending one as a Bearer token fails JWT verification. The legacy
        # service_role key is a JWT and is sent both ways.
        headers = {"apikey": self.key}
        if self.key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {self.key}"
        return headers

    def save(self, data: bytes, extension: str, content_type: str) -> str:
        name = f"{uuid.uuid4().hex}{extension}"
        url = f"{self.base}/storage/v1/object/{self.bucket}/{name}"

        try:
            response = httpx.post(
                url,
                content=data,
                headers={
                    **self._auth_headers(),
                    "Content-Type": content_type,
                    "cache-control": "public, max-age=31536000, immutable",
                },
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise StorageError(f"Could not reach Supabase Storage: {exc}") from exc

        if response.status_code >= 400:
            raise StorageError(
                f"Supabase Storage rejected the upload ({response.status_code}): "
                f"{response.text[:200]}"
            )

        # Bucket must be public for these URLs to resolve.
        return f"{self.base}/storage/v1/object/public/{self.bucket}/{name}"


def get_storage():
    return SupabaseStorage() if settings.uses_supabase_storage else LocalStorage()
