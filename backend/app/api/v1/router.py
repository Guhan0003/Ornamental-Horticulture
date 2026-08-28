from fastapi import APIRouter

from app.api.v1.endpoints import auth, blocks, categories, media, plants, users

api_router = APIRouter()

# Public — what a QR scan hits.
api_router.include_router(plants.router, prefix="/plants", tags=["plants"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])

# Admin — behind a login.
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(blocks.router, prefix="/blocks", tags=["blocks"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
