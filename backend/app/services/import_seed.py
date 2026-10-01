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
    Pc4Gemeente,
    PlaceAlias,
    PostcodeOverride,
    PostcodeRangeOverride,
    RoutingRule,
    Zorggroep,
    ZorggroepLocation,
    Zorgverzekeraar,
)
from . import seed_constants as sc
from .validation_service import normalize_text, route_key

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


_NO_CONTRACT_ROUTE_KEYS = {key for key, route in sc.BESLISBOOM_ROUTE_BY_ZORGGROEP_2026 if route == "no_contract"}

# Zuid-Holland-Zuid als twee aparte zorggroepen (voorheen gesplitst in de kaartcode).
ZHZ_CZ_PLAATSEN = ["Hoekse Waard"]
ZHZ_VGZ_PLAATSEN = [
    "Alblasserdam", "Altena", "Dordrecht", "Gorinchem", "Hardinxveld-Giessendam",
    "Hendrik Ido Ambacht", "Molenlanden", "Papendrecht", "Sliedrecht", "Zwijndrecht",
]
_ZHZ_SHEET_TO_NAME = {"ZHZ leefstijl coalitie CZ": "ZHZ CZ", "ZHZ leefstijl coalitie VGZ": "ZHZ VGZ"}


def _initial_contract_status(item: dict, name: str) -> bool:
    """Contractstatus bij het seeden: expliciet uit de JSON ('contract'), anders afgeleid
    uit de beslisboom (route 'no_contract' = geen contract)."""
    explicit = item.get("contract")
    if isinstance(explicit, bool):
        return explicit
    return route_key(name) not in _NO_CONTRACT_ROUTE_KEYS


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
            has_contract=_initial_contract_status(item, name),
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


def _apply_zorggroep_corrections(db: Session) -> int:
    """Past bekende zorggroep-datacorrecties toe op een al-geseede database (idempotent).

    - "LCK" is geen zorggroep (dat zijn de leefstijlcoaches in Kennemerland); de
      juiste zorggroep is Kennemerland (HOZK/HZK). Hernoem de bestaande rij.
    - "West-Friesland" heet voortaan "Kop van Noord-Holland" (zelfde gebied). Hernoem
      de rij en zet postcode-uitzonderingen die nog naar de oude naam wijzen om.
    Bestaande, al gecorrigeerde of handmatig aangepaste rijen worden niet aangeraakt.
    """
    changed = 0

    lck = db.scalar(select(Zorggroep).where(Zorggroep.name == "LCK"))
    has_kennemerland = (
        db.scalar(select(func.count()).select_from(Zorggroep).where(Zorggroep.name == "Kennemerland")) or 0
    )
    if lck is not None and not has_kennemerland:
        lck.name = "Kennemerland"
        lck.regio = "Kennemerland"
        changed += 1

    wf = db.scalar(select(Zorggroep).where(Zorggroep.name == "West-Friesland"))
    has_kop = (
        db.scalar(
            select(func.count()).select_from(Zorggroep).where(Zorggroep.name == "Kop van Noord-Holland")
        )
        or 0
    )
    if wf is not None and not has_kop:
        wf.name = "Kop van Noord-Holland"
        if wf.regio in ("", "West-Friesland"):
            wf.regio = "Kop van Noord-Holland en West-Friesland"
        changed += 1
    for model in (PostcodeRangeOverride, PostcodeOverride):
        for row in db.scalars(select(model).where(model.zorggroep == "West-Friesland")).all():
            row.zorggroep = "Kop van Noord-Holland"
            changed += 1

    # ESV = Eerstelijns Samenwerking Veenendaal; Veenendaal hoort er dus bij.
    esv = db.scalar(select(Zorggroep).where(Zorggroep.name == "ESV"))
    if esv is not None:
        have = {normalize_text(loc.city_name) for loc in esv.locations}
        if "veenendaal" not in have:
            esv.locations.append(ZorggroepLocation(city_name="Veenendaal"))
            changed += 1

    # Zuid-Holland-Zuid wordt twee aparte zorggroepen: de oude rij wordt ZHZ VGZ (id en
    # koppelingen blijven), ZHZ CZ komt erbij. Postcode-uitzonderingen volgen hun bronblad.
    zhz = db.scalar(select(Zorggroep).where(Zorggroep.name == "Zuid-Holland-Zuid"))
    has_vgz = db.scalar(select(Zorggroep).where(Zorggroep.name == "ZHZ VGZ")) is not None
    if zhz is not None and not has_vgz:
        zhz.name = "ZHZ VGZ"
        zhz.regio = "Zuid-Holland-Zuid"
        zhz.has_contract = True
        zhz.locations.clear()
        for plaats in ZHZ_VGZ_PLAATSEN:
            zhz.locations.append(ZorggroepLocation(city_name=plaats))
        if db.scalar(select(Zorggroep).where(Zorggroep.name == "ZHZ CZ")) is None:
            cz = Zorggroep(name="ZHZ CZ", regio="Zuid-Holland-Zuid", website=zhz.website, has_contract=True, is_active=True)
            for plaats in ZHZ_CZ_PLAATSEN:
                cz.locations.append(ZorggroepLocation(city_name=plaats))
            db.add(cz)
        changed += 1
    for model in (PostcodeRangeOverride, PostcodeOverride):
        for row in db.scalars(select(model).where(model.zorggroep == "Zuid-Holland-Zuid")).all():
            new_name = _ZHZ_SHEET_TO_NAME.get(row.source_sheet or "")
            if new_name:
                row.zorggroep = new_name
                changed += 1

    # HCDO (Deventer e.o.) als nieuwe zorggroep toevoegen als die nog niet bestaat.
    if db.scalar(select(Zorggroep).where(Zorggroep.name == "HCDO")) is None:
        hcdo = Zorggroep(name="HCDO", regio="Deventer en omgeving", website="", is_active=True)
        for gemeente in [
            "Deventer", "Lochem", "Olst-Wijhe", "Raalte",
            "Hellendoorn", "Rijssen-Holten", "Hof van Twente", "Voorst",
        ]:
            hcdo.locations.append(ZorggroepLocation(city_name=gemeente))
        db.add(hcdo)
        changed += 1

    if changed:
        db.commit()
    return changed


def _ensure_exact_postcode_overrides(db: Session) -> int:
    """Voegt ontbrekende exacte PC6-overrides uit de JSON additief toe (idempotent).

    Houdt de admin-database in sync met de exacte postcode-uitzonderingen uit
    postcode_overrides.json, ook nadat de tabel al geseed is. Bestaande rijen
    (per postcode6) worden nooit aangeraakt.
    """
    if not settings.postcode_overrides_seed_path.exists():
        return 0
    data = json.loads(settings.postcode_overrides_seed_path.read_text(encoding="utf-8"))
    existing = {
        (r.postcode6 or "").upper().replace(" ", "")
        for r in db.scalars(select(PostcodeOverride)).all()
    }
    added = 0
    for pc6, row in (data.get("exact_postcode6_overrides") or {}).items():
        key = str(pc6).upper().replace(" ", "")
        if not key or key in existing:
            continue
        db.add(
            PostcodeOverride(
                postcode6=key,
                zorggroep=str(row.get("zorggroep") or ""),
                source_sheet=str(row.get("source_sheet") or ""),
                note=str(row.get("note") or ""),
                insurer_concerns=json.dumps(row.get("insurer_concerns") or [], ensure_ascii=False),
                is_active=True,
            )
        )
        existing.add(key)
        added += 1
    if added:
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


def _ensure_place_aliases(db: Session) -> int:
    """Zet de vaste plaatslijst (PLACE_ALIASES_SEED) eenmalig in place_aliases.

    Daarna is de admin leidend: verwijderde of aangepaste rijen komen niet terug.
    """
    if db.get(AppMeta, "place_aliases_seeded") is not None:
        return 0
    existing = {normalize_text(r.plaatsnaam) for r in db.scalars(select(PlaceAlias)).all()}
    added = 0
    for plaatsnaam, gemeente in sc.PLACE_ALIASES_SEED:
        key = normalize_text(plaatsnaam)
        if key in existing:
            continue
        db.add(PlaceAlias(plaatsnaam=plaatsnaam, gemeente=gemeente, is_active=True))
        existing.add(key)
        added += 1
    db.add(AppMeta(key="place_aliases_seeded", value="1"))
    db.commit()
    return added


def _woonplaats_alias_rows(rows: list[dict]) -> list[tuple[str, str]]:
    """Maakt (plaatsnaam, gemeente)-paren van de BAG-woonplaatsen.

    Een naam die meerdere keren voorkomt (bijv. Hengelo) of gelijk is aan een andere
    gemeente (bijv. Beuningen in Losser) krijgt de gemeente erachter, zodat de
    kale naam nooit naar de verkeerde gemeente wijst.
    """
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(normalize_text(row["woonplaats"]), []).append(row)
    gemeente_keys = {normalize_text(r["gemeente"]) for r in rows}

    def suffixed(row: dict) -> tuple[str, str]:
        gemeente_kort = re.sub(r"\s*\(.*?\)\s*", "", row["gemeente"]).strip()
        extra = row["gemeente"]
        if normalize_text(gemeente_kort) == normalize_text(row["woonplaats"]):
            extra = row.get("provincie") or row["gemeente"]
        return f"{row['woonplaats']} ({extra})", row["gemeente"]

    result: list[tuple[str, str]] = []
    for key, group in groups.items():
        owners = [r for r in group if normalize_text(r["gemeente"]) == key]
        if len(group) == 1 and (key not in gemeente_keys or owners):
            result.append((group[0]["woonplaats"], group[0]["gemeente"]))
            continue
        plain_owner = owners[0] if len(owners) == 1 else None
        if plain_owner is not None:
            result.append((plain_owner["woonplaats"], plain_owner["gemeente"]))
        result.extend(suffixed(r) for r in group if r is not plain_owner)
    return result


def _ensure_woonplaatsen(db: Session) -> int:
    """Zet alle BAG-woonplaatsen (zg-data/woonplaatsen.json) eenmalig in place_aliases.

    Bestaande plaatsnamen (zoals de vaste lijst) gaan voor; daarna is de admin leidend.
    """
    path = settings.zorggroepen_seed_path.with_name("woonplaatsen.json")
    if db.get(AppMeta, "woonplaatsen_seeded") is not None or not path.exists():
        return 0
    rows = json.loads(path.read_text(encoding="utf-8")).get("woonplaatsen") or []
    existing = {normalize_text(r.plaatsnaam) for r in db.scalars(select(PlaceAlias)).all()}
    added = 0
    for plaatsnaam, gemeente in _woonplaats_alias_rows(rows):
        key = normalize_text(plaatsnaam)
        if key in existing:
            continue
        db.add(PlaceAlias(plaatsnaam=plaatsnaam, gemeente=gemeente, is_active=True))
        existing.add(key)
        added += 1
    db.add(AppMeta(key="woonplaatsen_seeded", value="1"))
    db.commit()
    return added


def _ensure_pc4_gemeenten(db: Session) -> int:
    """Vult de referentietabel pc4_gemeenten uit zg-data/pc4_gemeenten.json.

    Alleen opnieuw als de 'versie' in het bestand verandert (na fetch_pc4_gemeenten.py).
    """
    path = settings.zorggroepen_seed_path.with_name("pc4_gemeenten.json")
    if not path.exists():
        return 0
    data = json.loads(path.read_text(encoding="utf-8"))
    versie = str(data.get("versie") or "")
    meta = db.get(AppMeta, "pc4_gemeenten_versie")
    if meta is not None and meta.value == versie:
        return 0
    db.query(Pc4Gemeente).delete()
    rows = [
        {"pc4": pc4, "gemeente": gemeente, "pc6_count": int(count)}
        for pc4, gemeenten in (data.get("pc4") or {}).items()
        for gemeente, count in gemeenten.items()
    ]
    db.bulk_insert_mappings(Pc4Gemeente, rows)
    if meta is None:
        db.add(AppMeta(key="pc4_gemeenten_versie", value=versie))
    else:
        meta.value = versie
    db.commit()
    return len(rows)


def ensure_seed_admin(db: Session) -> bool:
    """Maak bij de allereerste start een super_admin aan uit env-variabelen.

    Gebruikt door backend/scripts/sync_database.py (online: Neon): zet SEED_ADMIN_EMAIL en SEED_ADMIN_PASSWORD
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
    # Datacorrecties op bestaande rijen (bijv. LCK -> Kennemerland, West-Friesland ->
    # Kop van Noord-Holland). Vóór de postcode-sync, zodat hernoemde uitzonderingen
    # niet nog een keer onder de nieuwe naam worden toegevoegd.
    result["zorggroep_correcties"] = _apply_zorggroep_corrections(db)
    # Additief: houd de postcode-uitzonderingen in sync ook als de tabel al geseed was.
    result["postcode_exact_toegevoegd"] = _ensure_exact_postcode_overrides(db)
    result["postcode_ranges_toegevoegd"] = _ensure_postcode_ranges(db)
    result["plaatsnamen_toegevoegd"] = _ensure_place_aliases(db)
    result["woonplaatsen_toegevoegd"] = _ensure_woonplaatsen(db)
    result["pc4_gemeenten_geladen"] = _ensure_pc4_gemeenten(db)
    if db.get(AppMeta, "data_version") is None:
        set_data_version(db, "1")
    return result
