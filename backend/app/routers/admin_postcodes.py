"""Admin CRUD voor postcode-uitzonderingen: exacte PC6, locatie-PC6 en PC4-ranges."""
from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    LocationPostcodeOverride,
    PostcodeOverride,
    PostcodeRangeOverride,
    User,
)
from ..schemas import (
    LocationOverrideCreate,
    LocationOverrideOut,
    LocationOverrideUpdate,
    PostcodeOverrideCreate,
    PostcodeOverrideOut,
    PostcodeOverrideUpdate,
    RangeOverrideCreate,
    RangeOverrideOut,
    RangeOverrideUpdate,
)
from ..security import require_editor
from ..services import audit_service
from ..services.import_seed import set_data_version

router = APIRouter(prefix="/api/admin/postcode-overrides", tags=["admin:postcodes"])

PC6_RE = re.compile(r"^\d{4}\s?[A-Za-z]{2}$")
PC4_RE = re.compile(r"^\d{4}$")


def _norm_pc6(value: str) -> str:
    cleaned = str(value or "").upper().replace(" ", "")
    if not PC6_RE.match(value or "") and not re.match(r"^\d{4}[A-Z]{2}$", cleaned):
        raise HTTPException(status_code=422, detail="Postcode moet formaat 1234AB hebben.")
    return cleaned


def _norm_pc4(value: str) -> str:
    cleaned = str(value or "").strip()
    if not PC4_RE.match(cleaned):
        raise HTTPException(status_code=422, detail="Postcode4 moet 4 cijfers zijn, bijv. 1234.")
    return cleaned


def _concerns(value) -> str:
    return json.dumps([str(v).strip() for v in (value or []) if str(v).strip()], ensure_ascii=False)


def _parse_concerns(raw: str) -> list[str]:
    try:
        val = json.loads(raw or "[]")
        return [str(v) for v in val] if isinstance(val, list) else []
    except (ValueError, TypeError):
        return []


# ---------------- Exacte PC6 ----------------
def _exact_out(o: PostcodeOverride) -> dict:
    return {
        "id": o.id, "postcode6": o.postcode6, "zorggroep": o.zorggroep, "source_sheet": o.source_sheet,
        "note": o.note, "insurer_concerns": _parse_concerns(o.insurer_concerns), "is_active": o.is_active,
        "created_at": o.created_at, "updated_at": o.updated_at,
    }


@router.get("/exact", response_model=list[PostcodeOverrideOut])
def list_exact(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[dict]:
    return [_exact_out(o) for o in db.scalars(select(PostcodeOverride).order_by(PostcodeOverride.postcode6)).all()]


@router.post("/exact", response_model=PostcodeOverrideOut, status_code=201)
def create_exact(payload: PostcodeOverrideCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    pc6 = _norm_pc6(payload.postcode6)
    if db.scalar(select(PostcodeOverride).where(func.upper(PostcodeOverride.postcode6) == pc6)):
        raise HTTPException(status_code=409, detail="Er bestaat al een uitzondering voor deze postcode.")
    o = PostcodeOverride(postcode6=pc6, zorggroep=payload.zorggroep.strip(), source_sheet=payload.source_sheet.strip(),
                         note=payload.note.strip(), insurer_concerns=_concerns(payload.insurer_concerns), is_active=payload.is_active)
    db.add(o); db.commit(); db.refresh(o)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type="postcode_override", entity_id=o.id, new=o)
    set_data_version(db)
    return _exact_out(o)


@router.put("/exact/{item_id}", response_model=PostcodeOverrideOut)
def update_exact(item_id: int, payload: PostcodeOverrideUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    o = db.get(PostcodeOverride, item_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    before = audit_service.to_snapshot(o)
    if payload.postcode6 is not None:
        o.postcode6 = _norm_pc6(payload.postcode6)
    if payload.zorggroep is not None:
        o.zorggroep = payload.zorggroep.strip()
    if payload.source_sheet is not None:
        o.source_sheet = payload.source_sheet.strip()
    if payload.note is not None:
        o.note = payload.note.strip()
    if payload.insurer_concerns is not None:
        o.insurer_concerns = _concerns(payload.insurer_concerns)
    if payload.is_active is not None:
        o.is_active = payload.is_active
    db.commit(); db.refresh(o)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type="postcode_override", entity_id=o.id, old=before, new=o)
    set_data_version(db)
    return _exact_out(o)


@router.delete("/exact/{item_id}")
def delete_exact(item_id: int, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    o = db.get(PostcodeOverride, item_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    before = audit_service.to_snapshot(o)
    db.delete(o); db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type="postcode_override", entity_id=item_id, old=before)
    set_data_version(db)
    return {"detail": "Postcode-uitzondering verwijderd."}


# ---------------- Locatie PC6 ----------------
def _loc_out(o: LocationPostcodeOverride) -> dict:
    return {
        "id": o.id, "postcode6": o.postcode6, "woonplaats": o.woonplaats, "gemeente": o.gemeente,
        "zorggroep": o.zorggroep, "source": o.source, "is_active": o.is_active,
        "created_at": o.created_at, "updated_at": o.updated_at,
    }


@router.get("/location", response_model=list[LocationOverrideOut])
def list_location(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[dict]:
    return [_loc_out(o) for o in db.scalars(select(LocationPostcodeOverride).order_by(LocationPostcodeOverride.postcode6)).all()]


@router.post("/location", response_model=LocationOverrideOut, status_code=201)
def create_location(payload: LocationOverrideCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    pc6 = _norm_pc6(payload.postcode6)
    if db.scalar(select(LocationPostcodeOverride).where(func.upper(LocationPostcodeOverride.postcode6) == pc6)):
        raise HTTPException(status_code=409, detail="Er bestaat al een locatie-uitzondering voor deze postcode.")
    o = LocationPostcodeOverride(postcode6=pc6, woonplaats=payload.woonplaats.strip(), gemeente=payload.gemeente.strip(),
                                 zorggroep=payload.zorggroep.strip(), source=payload.source.strip(), is_active=payload.is_active)
    db.add(o); db.commit(); db.refresh(o)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type="location_override", entity_id=o.id, new=o)
    set_data_version(db)
    return _loc_out(o)


@router.put("/location/{item_id}", response_model=LocationOverrideOut)
def update_location(item_id: int, payload: LocationOverrideUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    o = db.get(LocationPostcodeOverride, item_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    before = audit_service.to_snapshot(o)
    if payload.postcode6 is not None:
        o.postcode6 = _norm_pc6(payload.postcode6)
    if payload.woonplaats is not None:
        o.woonplaats = payload.woonplaats.strip()
    if payload.gemeente is not None:
        o.gemeente = payload.gemeente.strip()
    if payload.zorggroep is not None:
        o.zorggroep = payload.zorggroep.strip()
    if payload.source is not None:
        o.source = payload.source.strip()
    if payload.is_active is not None:
        o.is_active = payload.is_active
    db.commit(); db.refresh(o)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type="location_override", entity_id=o.id, old=before, new=o)
    set_data_version(db)
    return _loc_out(o)


@router.delete("/location/{item_id}")
def delete_location(item_id: int, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    o = db.get(LocationPostcodeOverride, item_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    before = audit_service.to_snapshot(o)
    db.delete(o); db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type="location_override", entity_id=item_id, old=before)
    set_data_version(db)
    return {"detail": "Locatie-uitzondering verwijderd."}


# ---------------- PC4 ranges ----------------
def _range_out(o: PostcodeRangeOverride) -> dict:
    return {
        "id": o.id, "start_pc4": o.start_pc4, "end_pc4": o.end_pc4, "zorggroep": o.zorggroep,
        "source_sheet": o.source_sheet, "insurer_concerns": _parse_concerns(o.insurer_concerns), "is_active": o.is_active,
        "created_at": o.created_at, "updated_at": o.updated_at,
    }


@router.get("/ranges", response_model=list[RangeOverrideOut])
def list_ranges(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[dict]:
    return [_range_out(o) for o in db.scalars(select(PostcodeRangeOverride).order_by(PostcodeRangeOverride.start_pc4)).all()]


@router.post("/ranges", response_model=RangeOverrideOut, status_code=201)
def create_range(payload: RangeOverrideCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    start = _norm_pc4(payload.start_pc4)
    end = _norm_pc4(payload.end_pc4)
    if int(start) > int(end):
        raise HTTPException(status_code=422, detail="Beginpostcode mag niet hoger zijn dan eindpostcode.")
    o = PostcodeRangeOverride(start_pc4=start, end_pc4=end, zorggroep=payload.zorggroep.strip(),
                              source_sheet=payload.source_sheet.strip(), insurer_concerns=_concerns(payload.insurer_concerns), is_active=payload.is_active)
    db.add(o); db.commit(); db.refresh(o)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type="range_override", entity_id=o.id, new=o)
    set_data_version(db)
    return _range_out(o)


@router.put("/ranges/{item_id}", response_model=RangeOverrideOut)
def update_range(item_id: int, payload: RangeOverrideUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    o = db.get(PostcodeRangeOverride, item_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    before = audit_service.to_snapshot(o)
    if payload.start_pc4 is not None:
        o.start_pc4 = _norm_pc4(payload.start_pc4)
    if payload.end_pc4 is not None:
        o.end_pc4 = _norm_pc4(payload.end_pc4)
    if int(o.start_pc4) > int(o.end_pc4):
        raise HTTPException(status_code=422, detail="Beginpostcode mag niet hoger zijn dan eindpostcode.")
    if payload.zorggroep is not None:
        o.zorggroep = payload.zorggroep.strip()
    if payload.source_sheet is not None:
        o.source_sheet = payload.source_sheet.strip()
    if payload.insurer_concerns is not None:
        o.insurer_concerns = _concerns(payload.insurer_concerns)
    if payload.is_active is not None:
        o.is_active = payload.is_active
    db.commit(); db.refresh(o)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type="range_override", entity_id=o.id, old=before, new=o)
    set_data_version(db)
    return _range_out(o)


@router.delete("/ranges/{item_id}")
def delete_range(item_id: int, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    o = db.get(PostcodeRangeOverride, item_id)
    if o is None:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    before = audit_service.to_snapshot(o)
    db.delete(o); db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type="range_override", entity_id=item_id, old=before)
    set_data_version(db)
    return {"detail": "Range-uitzondering verwijderd."}
