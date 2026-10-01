"""Admin CRUD voor plaatsnamen (plaats -> gemeente), gebruikt door beide kaarten."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PlaceAlias, User
from ..schemas import PlaceAliasCreate, PlaceAliasOut, PlaceAliasUpdate
from ..security import require_editor
from ..services import audit_service
from ..services.import_seed import set_data_version
from ..services.validation_service import normalize_text

router = APIRouter(prefix="/api/admin/place-aliases", tags=["admin:plaatsnamen"])
ENTITY = "place_alias"


def _check_unique(db: Session, plaatsnaam: str, exclude_id: int | None = None) -> None:
    target = normalize_text(plaatsnaam)
    for row in db.scalars(select(PlaceAlias)).all():
        if row.id != exclude_id and normalize_text(row.plaatsnaam) == target:
            raise HTTPException(status_code=409, detail=f"Plaatsnaam '{plaatsnaam}' bestaat al.")


def _get_or_404(db: Session, item_id: int) -> PlaceAlias:
    item = db.get(PlaceAlias, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Plaatsnaam niet gevonden.")
    return item


@router.get("", response_model=list[PlaceAliasOut])
def list_places(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[PlaceAlias]:
    return list(db.scalars(select(PlaceAlias).order_by(PlaceAlias.plaatsnaam)).all())


@router.post("", response_model=PlaceAliasOut, status_code=201)
def create_place(payload: PlaceAliasCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> PlaceAlias:
    if not payload.plaatsnaam.strip():
        raise HTTPException(status_code=422, detail="Plaatsnaam is verplicht.")
    _check_unique(db, payload.plaatsnaam)
    item = PlaceAlias(
        plaatsnaam=payload.plaatsnaam.strip(),
        gemeente=payload.gemeente.strip(),
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type=ENTITY, entity_id=item.id, new=item)
    set_data_version(db)
    return item


@router.put("/{item_id}", response_model=PlaceAliasOut)
def update_place(item_id: int, payload: PlaceAliasUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> PlaceAlias:
    item = _get_or_404(db, item_id)
    before = audit_service.to_snapshot(item)
    if payload.plaatsnaam is not None:
        if not payload.plaatsnaam.strip():
            raise HTTPException(status_code=422, detail="Plaatsnaam is verplicht.")
        _check_unique(db, payload.plaatsnaam, exclude_id=item.id)
        item.plaatsnaam = payload.plaatsnaam.strip()
    if payload.gemeente is not None:
        item.gemeente = payload.gemeente.strip()
    if payload.is_active is not None:
        item.is_active = payload.is_active
    db.commit()
    db.refresh(item)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type=ENTITY, entity_id=item.id, old=before, new=item)
    set_data_version(db)
    return item


@router.delete("/{item_id}")
def delete_place(item_id: int, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    item = _get_or_404(db, item_id)
    before = audit_service.to_snapshot(item)
    db.delete(item)
    db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=item_id, old=before)
    set_data_version(db)
    return {"detail": "Plaatsnaam verwijderd."}
