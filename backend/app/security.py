"""Wachtwoord-hashing, JWT-sessies en role-based dependencies."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import (
    ROLE_ADMIN,
    ROLE_EDITOR,
    ROLE_SUPER_ADMIN,
    ROLE_VIEWER,
    User,
)

settings = get_settings()

# Rolhiërarchie: hoger getal = meer rechten.
ROLE_LEVEL = {
    ROLE_VIEWER: 1,
    ROLE_EDITOR: 2,
    ROLE_ADMIN: 3,
    ROLE_SUPER_ADMIN: 4,
}


def hash_password(plain: str) -> str:
    # bcrypt heeft een limiet van 72 bytes; langere wachtwoorden worden afgekapt.
    payload = plain.encode("utf-8")[:72]
    return bcrypt.hashpw(payload, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_session_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.session_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def get_current_user(
    db: Session = Depends(get_db),
    session_cookie: str | None = Cookie(default=None, alias=settings.cookie_name),
) -> User:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd.")
    try:
        payload = decode_session_token(session_cookie)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessie verlopen.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ongeldige sessie.")

    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account inactief of onbekend.")
    return user


def require_role(*allowed_roles: str):
    """Dependency-factory die controleert of de gebruiker minstens een van de rollen heeft.

    Een rol met een hoger niveau voldoet automatisch aan een lagere eis.
    """
    min_level = min(ROLE_LEVEL.get(r, 99) for r in allowed_roles) if allowed_roles else 99

    def checker(user: User = Depends(get_current_user)) -> User:
        if ROLE_LEVEL.get(user.role, 0) < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Onvoldoende rechten voor deze actie.",
            )
        return user

    return checker


# Veelgebruikte dependencies.
require_viewer = require_role(ROLE_VIEWER)
require_editor = require_role(ROLE_EDITOR)
require_admin = require_role(ROLE_ADMIN)
require_super_admin = require_role(ROLE_SUPER_ADMIN)
