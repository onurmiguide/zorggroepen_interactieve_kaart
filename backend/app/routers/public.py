"""Publieke (read-only) endpoints voor de kaart. Geen auth vereist."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import json

from ..db import get_db
from ..models import (
    AppMeta,
    Facturatiestroom,
    LocationPostcodeOverride,
    PostcodeOverride,
    PostcodeRangeOverride,
    Zorggroep,
    Zorgverzekeraar,
)
from ._helpers import parse_aliases

router = APIRouter(prefix="/api/public", tags=["public"])


def _data_version(db: Session) -> str:
    meta = db.get(AppMeta, "data_version")
    return meta.value if meta else "0"


@router.get("/version")
def version(db: Session = Depends(get_db)) -> dict:
    return {"data_version": _data_version(db)}


@router.get("/zorggroepen")
def public_zorggroepen(db: Session = Depends(get_db)) -> dict:
    """Levert data in hetzelfde formaat als zg-data/zorggroepen.json, zodat
    de bestaande kaart dit direct kan gebruiken."""
    rows = db.scalars(
        select(Zorggroep).where(Zorggroep.is_active == True).order_by(Zorggroep.name)  # noqa: E712
    ).all()
    zorggroepen = []
    for zg in rows:
        item = {
            "zorggroep": zg.name,
            "regio": zg.regio,
            "website": zg.website,
            "cities": [loc.city_name for loc in zg.locations],
        }
        if zg.color:
            item["color"] = zg.color
        zorggroepen.append(item)
    return {
        "source": "miguide-admin-api",
        "data_version": _data_version(db),
        "zorggroepen": zorggroepen,
    }


@router.get("/zorgverzekeraars")
def public_zorgverzekeraars(db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(
        select(Zorgverzekeraar).where(Zorgverzekeraar.is_active == True).order_by(Zorgverzekeraar.name)  # noqa: E712
    ).all()
    return {
        "data_version": _data_version(db),
        "zorgverzekeraars": [
            {"name": zv.name, "concern_key": zv.concern_key, "aliases": parse_aliases(zv.aliases)}
            for zv in rows
        ],
    }


def _concerns(raw: str) -> list[str]:
    try:
        val = json.loads(raw or "[]")
        return [str(v) for v in val] if isinstance(val, list) else []
    except (ValueError, TypeError):
        return []


@router.get("/postcode-overrides")
def public_postcode_overrides(db: Session = Depends(get_db)) -> dict:
    """Levert postcode-uitzonderingen in hetzelfde formaat als
    zg-data/postcode_overrides.json, zodat de kaart dit direct kan gebruiken."""
    exact = {}
    for o in db.scalars(select(PostcodeOverride).where(PostcodeOverride.is_active == True).order_by(PostcodeOverride.postcode6)).all():  # noqa: E712
        entry = {"zorggroep": o.zorggroep, "source_sheet": o.source_sheet}
        if o.note:
            entry["note"] = o.note
        concerns = _concerns(o.insurer_concerns)
        if concerns:
            entry["insurer_concerns"] = concerns
        exact[o.postcode6] = entry

    location = {}
    for o in db.scalars(select(LocationPostcodeOverride).where(LocationPostcodeOverride.is_active == True).order_by(LocationPostcodeOverride.postcode6)).all():  # noqa: E712
        location[o.postcode6] = {"woonplaats": o.woonplaats, "gemeente": o.gemeente, "zorggroep": o.zorggroep, "source": o.source}

    ranges = []
    for o in db.scalars(select(PostcodeRangeOverride).where(PostcodeRangeOverride.is_active == True).order_by(PostcodeRangeOverride.start_pc4)).all():  # noqa: E712
        entry = {"start": o.start_pc4, "end": o.end_pc4, "zorggroep": o.zorggroep, "source_sheet": o.source_sheet}
        concerns = _concerns(o.insurer_concerns)
        if concerns:
            entry["insurer_concerns"] = concerns
        ranges.append(entry)

    return {
        "data_version": _data_version(db),
        "exact_postcode6_overrides": exact,
        "location_postcode6_overrides": location,
        "postcode4_range_overrides": ranges,
    }


@router.get("/facturatiestromen")
def public_facturatiestromen(db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(
        select(Facturatiestroom).where(Facturatiestroom.is_active == True).order_by(Facturatiestroom.kind, Facturatiestroom.code)  # noqa: E712
    ).all()
    return {
        "data_version": _data_version(db),
        "facturatiestromen": [
            {
                "code": f.code,
                "label": f.label,
                "kind": f.kind,
                "module_name": f.module_name,
                "prestatiecode": f.prestatiecode,
                "description": f.description,
            }
            for f in rows
        ],
    }
