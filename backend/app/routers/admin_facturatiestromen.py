"""Admin CRUD voor facturatiestromen en facturatiemodules."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Facturatiestroom, User
from ..schemas import FacturatiestroomCreate, FacturatiestroomOut, FacturatiestroomUpdate
from ..security import require_editor
from ..services import audit_service
from ..services.import_seed import set_data_version

router = APIRouter(prefix="/api/admin/facturatiestromen", tags=["admin:facturatiestromen"])

ENTITY = "facturatiestroom"


def _get_or_404(db: Session, item_id: int) -> Facturatiestroom:
    item = db.get(Facturatiestroom, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Facturatiestroom niet gevonden.")
    return item


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    query = select(Facturatiestroom).where(func.lower(Facturatiestroom.code) == code.lower())
    if exclude_id is not None:
        query = query.where(Facturatiestroom.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=409, detail="Er bestaat al een item met deze code.")


@router.get("", response_model=list[FacturatiestroomOut])
def list_items(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[Facturatiestroom]:
    return list(db.scalars(select(Facturatiestroom).order_by(Facturatiestroom.kind, Facturatiestroom.code)).all())


@router.post("", response_model=FacturatiestroomOut, status_code=201)
def create_item(payload: FacturatiestroomCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> Facturatiestroom:
    _check_unique_code(db, payload.code)
    item = Facturatiestroom(
        code=payload.code.strip(),
        label=payload.label.strip(),
        kind=payload.kind.strip() or "stroom",
        module_name=payload.module_name.strip(),
        prestatiecode=payload.prestatiecode.strip(),
        description=payload.description.strip(),
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type=ENTITY, entity_id=item.id, new=item)
    set_data_version(db)
    return item


@router.put("/{item_id}", response_model=FacturatiestroomOut)
def update_item(item_id: int, payload: FacturatiestroomUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> Facturatiestroom:
    item = _get_or_404(db, item_id)
    before = audit_service.to_snapshot(item)
    if payload.code is not None:
        _check_unique_code(db, payload.code, exclude_id=item.id)
        item.code = payload.code.strip()
    if payload.label is not None:
        item.label = payload.label.strip()
    if payload.kind is not None:
        item.kind = payload.kind.strip() or "stroom"
    if payload.module_name is not None:
        item.module_name = payload.module_name.strip()
    if payload.prestatiecode is not None:
        item.prestatiecode = payload.prestatiecode.strip()
    if payload.description is not None:
        item.description = payload.description.strip()
    if payload.is_active is not None:
        item.is_active = payload.is_active
    db.commit()
    db.refresh(item)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type=ENTITY, entity_id=item.id, old=before, new=item)
    set_data_version(db)
    return item


@router.delete("/{item_id}")
def delete_item(item_id: int, hard: bool = False, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    item = _get_or_404(db, item_id)
    before = audit_service.to_snapshot(item)
    if hard:
        db.delete(item)
        db.commit()
        audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=item_id, old=before)
        set_data_version(db)
        return {"detail": "Item definitief verwijderd."}
    item.is_active = False
    db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=item.id, old=before, new=item)
    set_data_version(db)
    return {"detail": "Item gedeactiveerd."}
