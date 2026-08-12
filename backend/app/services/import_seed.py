"""Seed-import: vult een lege database met bestaande data uit zorggroepen.json
en de hardcoded 2026-beslisboomwaarden uit script/script.js."""
from __future__ import annotations

import json
import os
import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import (
    AppMeta,
    Facturatiestroom,
    LocationPostcodeOverride,
    PostcodeOverride,
    PostcodeRangeOverride,
    RoutingRule,
    Zorggroep,
    ZorggroepLocation,
    Zorgverzekeraar,
)
from . import seed_constants as sc
from .validation_service import normalize_text

settings = get_settings()


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "item"


def _count(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def set_data_version(db: Session, value: str | None = None) -> str:
    meta = db.get(AppMeta, "data_version")
    if value is None:
        try:
            value = str(int(meta.value) + 1) if meta and meta.value else "1"
        except (TypeError, ValueError):
            value = "1"
    if meta is None:
        meta = AppMeta(key="data_version", value=value)
        db.add(meta)
    else:
        meta.value = value
    db.commit()
    return value


def _seed_zorggroepen(db: Session) -> int:
    if _count(db, Zorggroep) > 0:
        return 0
    if not settings.zorggroepen_seed_path.exists():
        return 0
    data = json.loads(settings.zorggroepen_seed_path.read_text(encoding="utf-8"))
    added = 0
    for item in data.get("zorggroepen", []):
        name = str(item.get("zorggroep") or "").strip()
        if not name:
            continue
        zg = Zorggroep(
            name=name,
            regio=str(item.get("regio") or "").strip(),
            website=str(item.get("website") or "").strip(),
            is_active=True,
        )
        for city in item.get("cities") or []:
            city_name = str(city or "").strip()
            if city_name:
                zg.locations.append(ZorggroepLocation(city_name=city_name))
        db.add(zg)
        added += 1
    db.commit()
    return added


def _seed_zorgverzekeraars(db: Session) -> int:
    if _count(db, Zorgverzekeraar) > 0:
        return 0
    added = 0
    seen: set[str] = set()
    # Groepeer labels per concern voor aliases.
    concern_to_labels: dict[str, list[str]] = {}
    for label in sc.DEFAULT_ZORGVERZEKERAARS:
        concern = sc.INSURER_LABEL_TO_CONCERN.get(normalize_text(label), normalize_text(label))
        concern_to_labels.setdefault(concern, []).append(label)

    for label in sc.DEFAULT_ZORGVERZEKERAARS:
        key = normalize_text(label)
        if key in seen:
            continue
        seen.add(key)
        concern = sc.INSURER_LABEL_TO_CONCERN.get(key, key)
        aliases = [l for l in concern_to_labels.get(concern, []) if l != label]
        db.add(
            Zorgverzekeraar(
                name=label,
                concern_key=concern,
                aliases=json.dumps(aliases, ensure_ascii=False),
                is_active=True,
            )
        )
        added += 1
    db.commit()
    return added


def _ensure_default_zorgverzekeraars(db: Session) -> int:
    """Voegt ontbrekende standaard-zorgverzekeraars additief toe (idempotent).

    De gewone seed (`_seed_zorgverzekeraars`) slaat een reeds-gevulde tabel over.
    Deze functie draait bij elke start en houdt de admin-database in sync met
    DEFAULT_ZORGVERZEKERAARS, zodat later toegevoegde verzekeraars (zoals SZVK)
    ook in een al-geseede database verschijnen. Bestaande rijen (ook inactieve)
    worden nooit aangeraakt, zodat handmatige admin-keuzes intact blijven.
    """
    existing = {
        normalize_text(zv.name) for zv in db.scalars(select(Zorgverzekeraar)).all()
    }
    concern_to_labels: dict[str, list[str]] = {}
    for label in sc.DEFAULT_ZORGVERZEKERAARS:
        concern = sc.INSURER_LABEL_TO_CONCERN.get(normalize_text(label), normalize_text(label))
        concern_to_labels.setdefault(concern, []).append(label)

    added = 0
    for label in sc.DEFAULT_ZORGVERZEKERAARS:
        key = normalize_text(label)
        if key in existing:
            continue
        concern = sc.INSURER_LABEL_TO_CONCERN.get(key, key)
        aliases = [l for l in concern_to_labels.get(concern, []) if l != label]
        db.add(
            Zorgverzekeraar(
                name=label,
                concern_key=concern,
                aliases=json.dumps(aliases, ensure_ascii=False),
                is_active=True,
            )
        )
        existing.add(key)
        added += 1
    if added:
        db.commit()
    return added


def _seed_facturatiestromen(db: Session) -> int:
    if _count(db, Facturatiestroom) > 0:
        return 0
    added = 0
    # De 5 stromen.
    for code, label in sc.FACTURATIESTROMEN.items():
        db.add(
            Facturatiestroom(
                code=code,
                label=label,
                kind="stroom",
                description=sc.FACTURATIESTROOM_CONTEXT.get(code, ""),
                is_active=True,
            )
        )
        added += 1
    # De facturatiemodule-templates.
    for name, description in sc.FACTURATIEMODULE_TEMPLATES.items():
        db.add(
            Facturatiestroom(
                code="module-" + _slug(name),
                label=name,
                kind="module",
                module_name=name,
                prestatiecode=sc.FACTURATIEMODULE_PRESTATIECODE.get(name, ""),
                description=description,
                is_active=True,
            )
        )
        added += 1
    db.commit()
    return added


def _seed_routing_rules(db: Session) -> int:
    if _count(db, RoutingRule) > 0:
        return 0
    # Maak een index van zorggroep normalized name -> id voor koppeling.
    zg_by_key = {
        normalize_text(zg.name): zg.id for zg in db.scalars(select(Zorggroep)).all()
    }
    added = 0
    for index, (key, route_type) in enumerate(sc.BESLISBOOM_ROUTE_BY_ZORGGROEP_2026):
        db.add(
            RoutingRule(
                zorggroep_id=zg_by_key.get(key),
                zorggroep_key=key,
                route_type=route_type,
                priority=index,
                is_active=True,
            )
        )
        added += 1
    db.commit()
    return added


def _seed_postcode_overrides(db: Session) -> int:
    if _count(db, PostcodeOverride) > 0 or _count(db, PostcodeRangeOverride) > 0 or _count(db, LocationPostcodeOverride) > 0:
        return 0
    if not settings.postcode_overrides_seed_path.exists():
        return 0
    data = json.loads(settings.postcode_overrides_seed_path.read_text(encoding="utf-8"))
    added = 0

    for pc6, row in (data.get("exact_postcode6_overrides") or {}).items():
        db.add(
            PostcodeOverride(
                postcode6=str(pc6).upper().replace(" ", ""),
                zorggroep=str(row.get("zorggroep") or ""),
                source_sheet=str(row.get("source_sheet") or ""),
                note=str(row.get("note") or ""),
                insurer_concerns=json.dumps(row.get("insurer_concerns") or [], ensure_ascii=False),
                is_active=True,
            )
        )
        added += 1

    for pc6, row in (data.get("location_postcode6_overrides") or {}).items():
        db.add(
            LocationPostcodeOverride(
                postcode6=str(pc6).upper().replace(" ", ""),
                woonplaats=str(row.get("woonplaats") or ""),
                gemeente=str(row.get("gemeente") or ""),
                zorggroep=str(row.get("zorggroep") or ""),
                source=str(row.get("source") or ""),
                is_active=True,
            )
        )
        added += 1

    for row in data.get("postcode4_range_overrides") or []:
        start = str(row.get("start") or row.get("from") or "").strip()
        end = str(row.get("end") or row.get("to") or "").strip()
        if not start or not end:
            continue
        db.add(
            PostcodeRangeOverride(
                start_pc4=start,
                end_pc4=end,
                zorggroep=str(row.get("zorggroep") or ""),
                source_sheet=str(row.get("source_sheet") or ""),
                insurer_concerns=json.dumps(row.get("insurer_concerns") or [], ensure_ascii=False),
                is_active=True,
            )
        )
        added += 1

    db.commit()
    return added


def _ensure_postcode_ranges(db: Session) -> int:
    """Voegt ontbrekende postcode4-ranges uit de JSON additief toe (idempotent).

    Houdt de admin-database in sync met postcode_overrides.json, ook nadat de
    tabel al geseed is (bijv. bij nieuwe ranges zoals Kop van Noord-Holland en
    West-Friesland). Bestaande rijen worden nooit aangeraakt.
    """
    if not settings.postcode_overrides_seed_path.exists():
        return 0
    data = json.loads(settings.postcode_overrides_seed_path.read_text(encoding="utf-8"))
    existing = {
        (r.start_pc4, r.end_pc4, normalize_text(r.zorggroep))
        for r in db.scalars(select(PostcodeRangeOverride)).all()
    }
    added = 0
    for row in data.get("postcode4_range_overrides") or []:
        start = str(row.get("start") or row.get("from") or "").strip()
        end = str(row.get("end") or row.get("to") or "").strip()
        zorggroep = str(row.get("zorggroep") or "")
        if not start or not end:
            continue
        key = (start, end, normalize_text(zorggroep))
        if key in existing:
            continue
        db.add(
            PostcodeRangeOverride(
                start_pc4=start,
                end_pc4=end,
                zorggroep=zorggroep,
                source_sheet=str(row.get("source_sheet") or ""),
                insurer_concerns=json.dumps(row.get("insurer_concerns") or [], ensure_ascii=False),
                is_active=True,
            )
        )
        existing.add(key)
        added += 1
    if added:
        db.commit()
    return added


def ensure_seed_admin(db: Session) -> bool:
    """Maak bij de allereerste start een super_admin aan uit env-variabelen.

    Handig voor online hosting (Render): zet SEED_ADMIN_EMAIL en SEED_ADMIN_PASSWORD
    als environment variables; bij een lege gebruikerstabel wordt de admin aangemaakt.
    Lokaal gebruik je gewoon scripts/seed_admin.py.
    """
    from ..models import ROLE_SUPER_ADMIN, User
    from ..security import hash_password

    if (db.scalar(select(func.count()).select_from(User)) or 0) > 0:
        return False
    email = os.getenv("SEED_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("SEED_ADMIN_PASSWORD", "")
    if not email or len(password) < 8:
        return False
    db.add(
        User(
            name=os.getenv("SEED_ADMIN_NAME", "MiGuide Admin").strip() or "MiGuide Admin",
            email=email,
            password_hash=hash_password(password),
            role=ROLE_SUPER_ADMIN,
            is_active=True,
        )
    )
    db.commit()
    return True


def import_seed(db: Session) -> dict[str, int]:
    """Idempotente seed: vult alleen tabellen die nog leeg zijn."""
    result = {
        "zorggroepen": _seed_zorggroepen(db),
        "zorgverzekeraars": _seed_zorgverzekeraars(db),
        "facturatiestromen": _seed_facturatiestromen(db),
        "routing_rules": _seed_routing_rules(db),
        "postcode_overrides": _seed_postcode_overrides(db),
    }
    # Additief: houd de verzekeraarslijst in sync ook als de tabel al geseed was.
    result["zorgverzekeraars_toegevoegd"] = _ensure_default_zorgverzekeraars(db)
    # Additief: houd de postcode4-ranges in sync ook als de tabel al geseed was.
    result["postcode_ranges_toegevoegd"] = _ensure_postcode_ranges(db)
    if db.get(AppMeta, "data_version") is None:
        set_data_version(db, "1")
    return result
