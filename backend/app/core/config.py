from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Ornamental Horticulture API"
    API_V1_PREFIX: str = "/api/v1"

    # SQLite for local development; point this at Postgres in production.
    DATABASE_URL: str = "sqlite:///./ornamental.db"

    # Must be overridden in production. Rotating it invalidates all sessions.
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Origins allowed to call this API (the Vercel frontend, plus local dev).
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://stomatalworld.vercel.app",
        "https://ornamental-horticulture.vercel.app",
    ]

    # Where uploaded plant images go. Swap for S3/Cloudinary before launch.
    MEDIA_ROOT: str = "./media"
    MEDIA_URL: str = "/media"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
