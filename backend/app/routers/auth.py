"""Login/logout/me endpoints met HttpOnly cookie-sessie."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, MessageOut, UserPublic
from ..security import (
    create_session_token,
    get_current_user,
    verify_password,
)
from ..services import audit_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.session_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


@router.post("/login", response_model=UserPublic)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Onjuiste e-mail of wachtwoord.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dit account is gedeactiveerd.",
        )
    token = create_session_token(user)
    _set_session_cookie(response, token)
    audit_service.record(
        db, actor=user, action=audit_service.ACTION_LOGIN, entity_type="auth", entity_id=user.id
    )
    return user


@router.post("/logout", response_model=MessageOut)
def logout(response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    response.delete_cookie(settings.cookie_name, path="/")
    audit_service.record(
        db, actor=user, action=audit_service.ACTION_LOGOUT, entity_type="auth", entity_id=user.id
    )
    return {"detail": "Uitgelogd."}


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> User:
    return user
