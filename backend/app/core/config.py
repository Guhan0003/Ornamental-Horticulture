from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Obvious placeholder, and long enough not to trip HS256 key-length warnings
# in development. Refused outright when ENVIRONMENT=production.
DEV_SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Ornamental Horticulture API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # SQLite for local development; point this at Postgres in production.
    DATABASE_URL: str = "sqlite:///./ornamental.db"

    SECRET_KEY: str = DEV_SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # The single admin login. There is no users table and no signup.
    ADMIN_EMAIL: str = "admin@stomatalworld.local"
    # Plaintext fallback for convenience. Prefer ADMIN_PASSWORD_HASH: set that
    # and the plaintext one is ignored, so no readable password sits in the
    # hosting dashboard. Generate with scripts/hash_password.py
    ADMIN_PASSWORD: str = "changeme123"
    ADMIN_PASSWORD_HASH: str = ""

    # Supabase Storage. When unset, uploads fall back to local disk (dev only).
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_BUCKET: str = "plant-images"

    # Uploaded photos are resized and re-encoded before storage; a 4MB phone
    # photo is unusable on store Wi-Fi.
    IMAGE_MAX_DIMENSION: int = 1600
    IMAGE_QUALITY: int = 80

    # Origins allowed to call this API (the Vercel frontend, plus local dev).
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://stomatalworld.vercel.app",
        "https://ornamental-horticulture.vercel.app",
    ]

    # Where uploaded plant images go. Swap for S3/Cloudinary before launch.
    MEDIA_ROOT: str = "./media"
    MEDIA_URL: str = "/media"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def _reject_weak_secret_in_production(self) -> "Settings":
        """
        Fail loudly at startup rather than quietly signing tokens with a key
        anyone can read in the source.
        """
        if not self.is_production:
            return self

        if self.SECRET_KEY == DEV_SECRET_KEY:
            raise ValueError(
                "SECRET_KEY is still the development default. Set a real one:\n"
                '  python -c "import secrets; print(secrets.token_urlsafe(32))"'
            )

        if len(self.SECRET_KEY) < MIN_SECRET_KEY_LENGTH:
            raise ValueError(
                f"SECRET_KEY must be at least {MIN_SECRET_KEY_LENGTH} characters "
                f"in production (got {len(self.SECRET_KEY)})."
            )

        if not self.ADMIN_PASSWORD_HASH and self.ADMIN_PASSWORD == "changeme123":
            raise ValueError(
                "Set ADMIN_PASSWORD (or better, ADMIN_PASSWORD_HASH) before "
                "running in production."
            )

        return self

    @property
    def uses_supabase_storage(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_KEY)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
