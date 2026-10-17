from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.core.security import authenticate, create_access_token
from app.schemas.auth import AdminIdentity, Token
from app.services import login_guard

router = APIRouter()


@router.post("/login", response_model=Token)
def login(
    request: Request,
    db: DbSession,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    client = login_guard.client_key(request)
    # A locked-out client is turned away before the password is looked at.
    login_guard.check_not_locked(db, client)

    if not authenticate(form.username, form.password):
        login_guard.record_failure(db, client)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    login_guard.record_success(db, client)
    return Token(access_token=create_access_token(form.username.strip().lower()))


@router.get("/me", response_model=AdminIdentity)
def read_current_user(email: CurrentUser):
    return AdminIdentity(email=email)
