from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser
from app.core.security import authenticate, create_access_token
from app.schemas.auth import AdminIdentity, Token

router = APIRouter()


@router.post("/login", response_model=Token)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    if not authenticate(form.username, form.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(access_token=create_access_token(form.username.strip().lower()))


@router.get("/me", response_model=AdminIdentity)
def read_current_user(email: CurrentUser):
    return AdminIdentity(email=email)
