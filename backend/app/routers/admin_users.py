"""Admin user management. Alleen super_admin mag gebruikers beheren."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import VALID_ROLES, User
from ..schemas import UserCreate, UserPublic, UserUpdate
from ..security import hash_password, require_super_admin
from ..services import audit_service

router = APIRouter(prefix="/api/admin/users", tags=["admin:users"])

ENTITY = "user"


def _get_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden.")
    return user


def _check_unique_email(db: Session, email: str, exclude_id: int | None = None) -> None:
    query = select(User).where(func.lower(User.email) == email.lower())
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=409, detail="Er bestaat al een gebruiker met dit e-mailadres.")


@router.get("", response_model=list[UserPublic])
def list_users(db: Session = Depends(get_db), actor: User = Depends(require_super_admin)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.name)).all())


@router.post("", response_model=UserPublic, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), actor: User = Depends(require_super_admin)) -> User:
    _check_unique_email(db, payload.email)
    user = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        role=payload.normalized_role(),
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit_service.record(db, actor=actor, action=audit_service.ACTION_CREATE, entity_type=ENTITY, entity_id=user.id, new=user)
    return user


@router.put("/{user_id}", response_model=UserPublic)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), actor: User = Depends(require_super_admin)) -> User:
    user = _get_or_404(db, user_id)
    before = audit_service.to_snapshot(user)

    if payload.email is not None:
        _check_unique_email(db, payload.email, exclude_id=user.id)
        user.email = payload.email.lower().strip()
    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(status_code=422, detail="Onbekende rol.")
        # Voorkom dat de laatste actieve super_admin zichzelf degradeert.
        if user.id == actor.id and payload.role != "super_admin":
            _guard_last_super_admin(db, user)
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == actor.id and payload.is_active is False:
            raise HTTPException(status_code=400, detail="Je kunt je eigen account niet deactiveren.")
        if payload.is_active is False:
            _guard_last_super_admin(db, user)
        user.is_active = payload.is_active
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    audit_service.record(db, actor=actor, action=audit_service.ACTION_UPDATE, entity_type=ENTITY, entity_id=user.id, old=before, new=user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, hard: bool = False, db: Session = Depends(get_db), actor: User = Depends(require_super_admin)) -> dict:
    user = _get_or_404(db, user_id)
    if user.id == actor.id:
        raise HTTPException(status_code=400, detail="Je kunt je eigen account niet verwijderen.")
    _guard_last_super_admin(db, user)
    before = audit_service.to_snapshot(user)
    if hard:
        db.delete(user)
        db.commit()
        audit_service.record(db, actor=actor, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=user_id, old=before)
        return {"detail": "Gebruiker definitief verwijderd."}
    user.is_active = False
    db.commit()
    audit_service.record(db, actor=actor, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=user.id, old=before, new=user)
    return {"detail": "Gebruiker gedeactiveerd."}


def _guard_last_super_admin(db: Session, target: User) -> None:
    """Blokkeer acties die de laatste actieve super_admin zouden uitschakelen."""
    if target.role != "super_admin":
        return
    active_supers = db.scalar(
        select(func.count()).select_from(User).where(User.role == "super_admin", User.is_active == True)  # noqa: E712
    )
    if (active_supers or 0) <= 1:
        raise HTTPException(status_code=400, detail="Er moet minstens één actieve super_admin blijven bestaan.")
