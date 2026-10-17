import re
import uuid
from pathlib import Path

import httpx

from app.core.config import settings

# What save() writes: uuid4().hex, then the extension.
_OBJECT_NAME = re.compile(r"[0-9a-f]{32}\.[A-Za-z0-9]{1,8}")


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

    def delete(self, url: str) -> None:
        name = _own_object_name(url, f"{settings.MEDIA_URL}/")
        if name is None:
            return
        Path(settings.MEDIA_ROOT, name).unlink(missing_ok=True)


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

    def _check_key(self) -> None:
        # Supabase hands out two keys. The publishable one is meant for
        # browsers and is blocked by row-level security, so an upload fails
        # with "new row violates row-level security policy". Name the real
        # problem instead of passing that through.
        if self.key.startswith("sb_publishable_"):
            raise StorageError(
                "SUPABASE_SERVICE_KEY is Supabase's publishable key, which cannot "
                "write to storage. Use a secret key (sb_secret_...) from "
                "Project Settings -> API Keys."
            )

    def _auth_headers(self) -> dict[str, str]:
        # New secret keys (sb_secret_...) aren't JWTs and belong only in `apikey`;
        # sending one as a Bearer token fails JWT verification. The legacy
        # service_role key is a JWT and is sent both ways.
        headers = {"apikey": self.key}
        if self.key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {self.key}"
        return headers

    def save(self, data: bytes, extension: str, content_type: str) -> str:
        self._check_key()
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

    def delete(self, url: str) -> None:
        name = _own_object_name(
            url, f"{self.base}/storage/v1/object/public/{self.bucket}/"
        )
        if name is None:
            return

        self._check_key()
        try:
            response = httpx.delete(
                f"{self.base}/storage/v1/object/{self.bucket}/{name}",
                headers=self._auth_headers(),
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise StorageError(f"Could not reach Supabase Storage: {exc}") from exc

        # 404 means it is already gone, which is the outcome we wanted.
        if response.status_code >= 400 and response.status_code != 404:
            raise StorageError(
                f"Supabase Storage refused to delete {name} "
                f"({response.status_code}): {response.text[:200]}"
            )


def _own_object_name(url: str, prefix: str) -> str | None:
    """
    The object this URL names, but only if we are the ones who stored it.

    A plant's image URL is whatever was saved on it, and an admin can paste
    any address into that field, so this matches the exact shape `save()`
    writes — a uuid4 and an extension — instead of trying to guess which
    stray characters would be dangerous in a path. Anything else is left
    alone, which at worst leaves a file nobody reads.
    """
    if not url.startswith(prefix):
        return None

    name = url[len(prefix) :]
    return name if _OBJECT_NAME.fullmatch(name) else None


def get_storage():
    return SupabaseStorage() if settings.uses_supabase_storage else LocalStorage()
