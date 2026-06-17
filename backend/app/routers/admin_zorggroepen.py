"""Admin CRUD voor zorggroepen (incl. plaatsen/locations)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Zorggroep, ZorggroepLocation
from ..schemas import ZorggroepCreate, ZorggroepOut, ZorggroepUpdate
from ..security import require_editor
from ..services import audit_service
from ..services.import_seed import set_data_version
from ..services.validation_service import is_valid_color, is_valid_url

router = APIRouter(prefix="/api/admin/zorggroepen", tags=["admin:zorggroepen"])

ENTITY = "zorggroep"


def _validate_color(value: str) -> None:
    if not is_valid_color(value):
        raise HTTPException(status_code=422, detail="Kleur moet een hex-code zijn zoals #1f77b4 (of leeg).")


def _get_or_404(db: Session, zorggroep_id: int) -> Zorggroep:
    zg = db.get(Zorggroep, zorggroep_id)
    if zg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zorggroep niet gevonden.")
    return zg


def _check_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    query = select(Zorggroep).where(func.lower(Zorggroep.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Zorggroep.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Er bestaat al een zorggroep met deze naam.")


@router.get("", response_model=list[ZorggroepOut])
def list_zorggroepen(
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
) -> list[Zorggroep]:
    query = select(Zorggroep).order_by(Zorggroep.name)
    if not include_inactive:
        query = query.where(Zorggroep.is_active == True)  # noqa: E712
    return list(db.scalars(query).all())


@router.get("/{zorggroep_id}", response_model=ZorggroepOut)
def get_zorggroep(zorggroep_id: int, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> Zorggroep:
    return _get_or_404(db, zorggroep_id)


@router.post("", response_model=ZorggroepOut, status_code=status.HTTP_201_CREATED)
def create_zorggroep(payload: ZorggroepCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> Zorggroep:
    if not is_valid_url(payload.website):
        raise HTTPException(status_code=422, detail="Website moet beginnen met http:// of https://")
    _validate_color(payload.color)
    _check_unique_name(db, payload.name)
    zg = Zorggroep(
        name=payload.name.strip(),
        regio=payload.regio.strip(),
        website=payload.website.strip(),
        color=payload.color.strip(),
        is_active=payload.is_active,
    )
    for loc in payload.locations:
        zg.locations.append(
            ZorggroepLocation(city_name=loc.city_name.strip(), gemeente_name=loc.gemeente_name.strip(), notes=loc.notes.strip())
        )
    db.add(zg)
    db.commit()
    db.refresh(zg)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type=ENTITY, entity_id=zg.id, new=zg)
    set_data_version(db)
    return zg


@router.put("/{zorggroep_id}", response_model=ZorggroepOut)
def update_zorggroep(zorggroep_id: int, payload: ZorggroepUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> Zorggroep:
    zg = _get_or_404(db, zorggroep_id)
    before = audit_service.to_snapshot(zg)

    if payload.name is not None:
        _check_unique_name(db, payload.name, exclude_id=zg.id)
        zg.name = payload.name.strip()
    if payload.regio is not None:
        zg.regio = payload.regio.strip()
    if payload.website is not None:
        if not is_valid_url(payload.website):
            raise HTTPException(status_code=422, detail="Website moet beginnen met http:// of https://")
        zg.website = payload.website.strip()
    if payload.color is not None:
        _validate_color(payload.color)
        zg.color = payload.color.strip()
    if payload.is_active is not None:
        zg.is_active = payload.is_active
    if payload.locations is not None:
        zg.locations.clear()
        db.flush()
        for loc in payload.locations:
            zg.locations.append(
                ZorggroepLocation(city_name=loc.city_name.strip(), gemeente_name=loc.gemeente_name.strip(), notes=loc.notes.strip())
            )

    db.commit()
    db.refresh(zg)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type=ENTITY, entity_id=zg.id, old=before, new=zg)
    set_data_version(db)
    return zg


@router.delete("/{zorggroep_id}")
def delete_zorggroep(zorggroep_id: int, hard: bool = False, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    zg = _get_or_404(db, zorggroep_id)
    before = audit_service.to_snapshot(zg)
    if hard:
        db.delete(zg)
        db.commit()
        audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=zorggroep_id, old=before)
        set_data_version(db)
        return {"detail": "Zorggroep definitief verwijderd."}
    zg.is_active = False
    db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=zg.id, old=before, new=zg)
    set_data_version(db)
    return {"detail": "Zorggroep gedeactiveerd."}
