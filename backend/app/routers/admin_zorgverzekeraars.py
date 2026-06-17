"""Admin CRUD voor zorgverzekeraars (incl. aliases)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Zorgverzekeraar
from ..schemas import ZorgverzekeraarCreate, ZorgverzekeraarOut, ZorgverzekeraarUpdate
from ..security import require_editor
from ..services import audit_service
from ..services.import_seed import set_data_version
from ..services.validation_service import normalize_text
from ._helpers import zorgverzekeraar_out

router = APIRouter(prefix="/api/admin/zorgverzekeraars", tags=["admin:zorgverzekeraars"])

ENTITY = "zorgverzekeraar"


def _get_or_404(db: Session, zv_id: int) -> Zorgverzekeraar:
    zv = db.get(Zorgverzekeraar, zv_id)
    if zv is None:
        raise HTTPException(status_code=404, detail="Zorgverzekeraar niet gevonden.")
    return zv


def _check_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    query = select(Zorgverzekeraar).where(func.lower(Zorgverzekeraar.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Zorgverzekeraar.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=409, detail="Er bestaat al een zorgverzekeraar met deze naam.")


def _dump_aliases(aliases: list[str]) -> str:
    cleaned = [a.strip() for a in aliases if a and a.strip()]
    return json.dumps(cleaned, ensure_ascii=False)


@router.get("", response_model=list[ZorgverzekeraarOut])
def list_zorgverzekeraars(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[dict]:
    rows = db.scalars(select(Zorgverzekeraar).order_by(Zorgverzekeraar.name)).all()
    return [zorgverzekeraar_out(zv) for zv in rows]


@router.post("", response_model=ZorgverzekeraarOut, status_code=201)
def create_zorgverzekeraar(payload: ZorgverzekeraarCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    _check_unique_name(db, payload.name)
    zv = Zorgverzekeraar(
        name=payload.name.strip(),
        concern_key=payload.concern_key.strip() or normalize_text(payload.name),
        aliases=_dump_aliases(payload.aliases),
        is_active=payload.is_active,
    )
    db.add(zv)
    db.commit()
    db.refresh(zv)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type=ENTITY, entity_id=zv.id, new=zv)
    set_data_version(db)
    return zorgverzekeraar_out(zv)


@router.put("/{zv_id}", response_model=ZorgverzekeraarOut)
def update_zorgverzekeraar(zv_id: int, payload: ZorgverzekeraarUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    zv = _get_or_404(db, zv_id)
    before = audit_service.to_snapshot(zv)
    if payload.name is not None:
        _check_unique_name(db, payload.name, exclude_id=zv.id)
        zv.name = payload.name.strip()
    if payload.concern_key is not None:
        zv.concern_key = payload.concern_key.strip()
    if payload.aliases is not None:
        zv.aliases = _dump_aliases(payload.aliases)
    if payload.is_active is not None:
        zv.is_active = payload.is_active
    db.commit()
    db.refresh(zv)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type=ENTITY, entity_id=zv.id, old=before, new=zv)
    set_data_version(db)
    return zorgverzekeraar_out(zv)


@router.delete("/{zv_id}")
def delete_zorgverzekeraar(zv_id: int, hard: bool = False, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    zv = _get_or_404(db, zv_id)
    before = audit_service.to_snapshot(zv)
    if hard:
        db.delete(zv)
        db.commit()
        audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=zv_id, old=before)
        set_data_version(db)
        return {"detail": "Zorgverzekeraar definitief verwijderd."}
    zv.is_active = False
    db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=zv.id, old=before, new=zv)
    set_data_version(db)
    return {"detail": "Zorgverzekeraar gedeactiveerd."}
