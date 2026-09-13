from fastapi import APIRouter

from app.api.v1.endpoints import auth, media, plants

api_router = APIRouter()

# Public reads, admin writes.
api_router.include_router(plants.router, prefix="/plants", tags=["plants"])

# Admin — behind the login.
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
