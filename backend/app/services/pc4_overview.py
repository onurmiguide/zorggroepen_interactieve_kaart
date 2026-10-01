"""Automatisch overzicht: alle gecontracteerde PC4-ranges per zorggroep.

Volgt dezelfde regels als de kaart (script/script.js): plaats -> gemeente (plaatsnamen uit
de admin, anders de gemeentenaam), overlap-regels per gemeente, en daarna de PC4-range-
uitzonderingen. Niets wordt opgeslagen: pas je plaatsen of uitzonderingen aan, dan
verandert dit overzicht vanzelf mee.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Pc4Gemeente, PlaceAlias, PostcodeRangeOverride, Zorggroep
from . import seed_constants as sc
from .validation_service import route_key as _norm

GEEN_CONTRACT = _norm("Geen zorggroep contract")


def _load_pc4(db: Session) -> dict[str, dict[str, int]]:
    pc4: dict[str, dict[str, int]] = defaultdict(dict)
    for row in db.scalars(select(Pc4Gemeente)).all():
        pc4[row.pc4][row.gemeente] = row.pc6_count
    return pc4


def _city_to_gemeente(city: str, aliases: dict[str, str], gemeente_by_norm: dict[str, str]) -> str | None:
    """Gemeentenaam, "" als de plaats bewust niet ingekleurd wordt, of None als hij onbekend is."""
    clean = _norm(city)
    if not clean:
        return None
    if clean in aliases:
        gemeente = aliases[clean]
        if not gemeente:
            return ""  # plaats bewust niet inkleuren
        return gemeente_by_norm.get(_norm(gemeente), gemeente)
    if clean in gemeente_by_norm:
        return gemeente_by_norm[clean]
    without_brackets = _norm(re.sub(r"\(.*?\)", " ", city))
    return gemeente_by_norm.get(without_brackets)


def _resolve_zorggroep(name: str, zorggroepen: list[Zorggroep]) -> Zorggroep | None:
    """Zelfde naamkoppeling als getFeatureByZorggroepName (bijv. 'RHOGO' -> 'RHOGO (Regionale ...)')."""
    target = _norm(name)
    for zg in zorggroepen:
        if zg.name == name or _norm(zg.name) == target:
            return zg
    for zg in zorggroepen:
        if _norm(zg.name).startswith(f"{target} "):
            return zg
    return None


def build_pc4_overview(db: Session) -> dict:
    pc4_data = _load_pc4(db)
    gemeente_by_norm = {_norm(g): g for gems in pc4_data.values() for g in gems}

    zorggroepen = list(db.scalars(
        select(Zorggroep).where(Zorggroep.is_active == True).order_by(Zorggroep.name)  # noqa: E712
    ).all())
    alias_rows = db.scalars(select(PlaceAlias).where(PlaceAlias.is_active == True)).all()  # noqa: E712
    if alias_rows:
        aliases = {_norm(a.plaatsnaam): a.gemeente for a in alias_rows}
    else:  # zelfde terugval als de kaart: de vaste lijst
        aliases = {_norm(p): g for p, g in sc.PLACE_ALIASES_SEED}

    # 1) Gemeenten per zorggroep (via de plaatsen), in dezelfde volgorde als de kaart.
    owners: dict[str, list[Zorggroep]] = defaultdict(list)
    unmatched: dict[str, list[str]] = defaultdict(list)
    for zg in zorggroepen:
        seen: set[str] = set()
        for loc in zg.locations:
            gemeente = _city_to_gemeente(loc.city_name, aliases, gemeente_by_norm)
            if gemeente is None:
                unmatched[zg.name].append(loc.city_name)
                continue
            if not gemeente:
                continue
            key = _norm(gemeente)
            if key not in seen:
                seen.add(key)
                owners[key].append(zg)

    # 2) Overlap: één eigenaar per gemeente, behalve de toegestane overlap-gemeenten.
    allowed = {_norm(g) for g in sc.ALLOWED_OVERLAP_GEMEENTEN}
    preferred = {_norm(g): _norm(z) for g, z in sc.OVERLAP_GEMEENTE_OWNER_OVERRIDES.items()}
    for key, zgs in owners.items():
        if len(zgs) <= 1 or key in allowed:
            continue
        keep = next((z for z in zgs if _norm(z.name) == preferred.get(key)), zgs[0])
        owners[key] = [keep]

    # 3) PC4 -> zorggroep(en) op basis van de gemeenten (met aandeel PC6 als de PC4 over een grens loopt).
    #    Sleutel: (zorggroep-id, alleen-voor-verzekeraars)
    assignments: dict[str, dict[tuple[int, tuple[str, ...]], dict]] = {}
    for pc4, gems in pc4_data.items():
        total = sum(gems.values()) or 1
        per: dict[tuple[int, tuple[str, ...]], dict] = {}
        for gemeente, count in gems.items():
            for zg in owners.get(_norm(gemeente), []):
                entry = per.setdefault((zg.id, ()), {"count": 0, "gemeenten": set(), "bron": "Plaatsen"})
                entry["count"] += count
                entry["gemeenten"].add(gemeente)
        for entry in per.values():
            entry["share"] = entry["count"] / total
        assignments[pc4] = per

    # 4) PC4-range-uitzonderingen (eerste passende regel wint, net als de kaart).
    ranges = db.scalars(
        select(PostcodeRangeOverride).where(PostcodeRangeOverride.is_active == True)  # noqa: E712
        .order_by(PostcodeRangeOverride.start_pc4)
    ).all()
    handled: set[tuple[str, tuple[str, ...]]] = set()
    for rule in ranges:
        concerns = tuple(sorted(c for c in json.loads(rule.insurer_concerns or "[]") if c))
        target = None if _norm(rule.zorggroep) == GEEN_CONTRACT else _resolve_zorggroep(rule.zorggroep, zorggroepen)
        for pc4 in pc4_data:
            if not (rule.start_pc4 <= pc4 <= rule.end_pc4) or (pc4, concerns) in handled:
                continue
            handled.add((pc4, concerns))
            per = assignments[pc4]
            if not concerns:
                # Geldt voor iedereen: vervangt de plaatsen-indeling van deze PC4.
                for key in [k for k in per if not k[1]]:
                    del per[key]
            if target is not None:
                per[(target.id, concerns)] = {
                    "share": 1.0, "gemeenten": set(pc4_data[pc4]), "bron": "Uitzondering",
                }

    # 5) Aaneengesloten PC4's (in de volgorde van bestaande PC4's) samenvoegen tot ranges.
    by_id = {zg.id: zg for zg in zorggroepen}
    all_pc4 = sorted(pc4_data)
    open_ranges: dict[tuple[int, tuple[str, ...]], dict] = {}
    rows: list[dict] = []

    def close(key: tuple[int, tuple[str, ...]]) -> None:
        r = open_ranges.pop(key)
        zg = by_id[key[0]]
        rows.append({
            "zorggroep": zg.name,
            "alleen_voor": ", ".join(c.upper() for c in key[1]),
            "start_pc4": r["pc4s"][0],
            "end_pc4": r["pc4s"][-1],
            "aantal_pc4": len(r["pc4s"]),
            "gemeenten": ", ".join(sorted(r["gemeenten"])),
            "bron": " + ".join(sorted(r["bronnen"], reverse=True)),
            "deels": ", ".join(r["deels"]),
            "pc4s": " ".join(r["pc4s"]),
        })

    for index, pc4 in enumerate(all_pc4):
        present = {k: v for k, v in assignments[pc4].items() if by_id[k[0]].has_contract}
        for key in [k for k, r in open_ranges.items() if k not in present]:
            close(key)
        for key, entry in present.items():
            r = open_ranges.get(key)
            if r is None:
                r = open_ranges[key] = {"pc4s": [], "gemeenten": set(), "bronnen": set(), "deels": []}
            r["pc4s"].append(pc4)
            r["gemeenten"] |= entry["gemeenten"]
            r["bronnen"].add(entry["bron"])
            if entry["share"] < 0.995:
                r["deels"].append(f"{pc4} ({round(entry['share'] * 100)}%)")
    for key in list(open_ranges):
        close(key)

    rows.sort(key=lambda r: (r["zorggroep"].lower(), r["alleen_voor"], r["start_pc4"]))
    return {
        "ranges": rows,
        "aantal_pc4_totaal": len(all_pc4),
        "niet_gekoppelde_plaatsen": {k: v for k, v in sorted(unmatched.items()) if v},
    }
