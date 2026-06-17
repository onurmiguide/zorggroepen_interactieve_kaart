"""Publiceer de database terug naar de zg-data JSON-bestanden en (optioneel)
commit + push naar GitHub. Alleen de data-bestanden worden gecommit; de admin-code
kan nooit meegepusht worden dankzij een allowlist-check.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import REPO_ROOT
from ..models import (
    LocationPostcodeOverride,
    PostcodeOverride,
    PostcodeRangeOverride,
    Zorggroep,
)

ZG_JSON = REPO_ROOT / "zg-data" / "zorggroepen.json"
PC_JSON = REPO_ROOT / "zg-data" / "postcode_overrides.json"

# Alleen deze paden mogen door de publish-actie gecommit/gepusht worden.
ALLOWED_PATHS = {"zg-data/zorggroepen.json", "zg-data/postcode_overrides.json"}


def _parse_concerns(raw: str) -> list[str]:
    try:
        val = json.loads(raw or "[]")
        return [str(v) for v in val] if isinstance(val, list) else []
    except (ValueError, TypeError):
        return []


def build_zorggroepen_json(db: Session) -> dict:
    existing_source = "miguide-admin"
    if ZG_JSON.exists():
        try:
            existing_source = json.loads(ZG_JSON.read_text(encoding="utf-8")).get("source", existing_source)
        except (ValueError, OSError):
            pass
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
    return {"source": existing_source, "zorggroepen": zorggroepen}


def build_postcode_overrides_json(db: Session) -> dict:
    # Behoud bestaande metadata-velden.
    meta = {}
    if PC_JSON.exists():
        try:
            existing = json.loads(PC_JSON.read_text(encoding="utf-8"))
            for key in ("source_workbook", "generated_on", "notes", "used_sheets"):
                if key in existing:
                    meta[key] = existing[key]
        except (ValueError, OSError):
            pass

    exact: dict[str, dict] = {}
    for o in db.scalars(select(PostcodeOverride).where(PostcodeOverride.is_active == True).order_by(PostcodeOverride.postcode6)).all():  # noqa: E712
        entry: dict = {"zorggroep": o.zorggroep, "source_sheet": o.source_sheet}
        if o.note:
            entry["note"] = o.note
        concerns = _parse_concerns(o.insurer_concerns)
        if concerns:
            entry["insurer_concerns"] = concerns
        exact[o.postcode6] = entry

    location: dict[str, dict] = {}
    for o in db.scalars(select(LocationPostcodeOverride).where(LocationPostcodeOverride.is_active == True).order_by(LocationPostcodeOverride.postcode6)).all():  # noqa: E712
        location[o.postcode6] = {
            "woonplaats": o.woonplaats,
            "gemeente": o.gemeente,
            "zorggroep": o.zorggroep,
            "source": o.source,
        }

    ranges: list[dict] = []
    for o in db.scalars(select(PostcodeRangeOverride).where(PostcodeRangeOverride.is_active == True).order_by(PostcodeRangeOverride.start_pc4)).all():  # noqa: E712
        entry = {"start": o.start_pc4, "end": o.end_pc4, "zorggroep": o.zorggroep, "source_sheet": o.source_sheet}
        concerns = _parse_concerns(o.insurer_concerns)
        if concerns:
            entry["insurer_concerns"] = concerns
        ranges.append(entry)

    payload = dict(meta)
    payload["exact_postcode6_overrides"] = exact
    payload["location_postcode6_overrides"] = location
    payload["postcode4_range_overrides"] = ranges
    return payload


def _git(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=120
    )


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def publish(db: Session, *, actor, do_push: bool = True) -> dict:
    log: list[str] = []
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    # 1) Backup huidige bestanden.
    backup_dir = REPO_ROOT / "backups" / f"publish-{ts}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    for src in (ZG_JSON, PC_JSON):
        if src.exists():
            shutil.copy2(src, backup_dir / src.name)
    log.append(f"Backup gemaakt in backups/publish-{ts}/")

    # 2) Schrijf nieuwe JSON vanuit de database.
    _write_json(ZG_JSON, build_zorggroepen_json(db))
    _write_json(PC_JSON, build_postcode_overrides_json(db))
    log.append("zorggroepen.json en postcode_overrides.json bijgewerkt vanuit de database.")

    result = {"ok": True, "pushed": False, "committed": False, "log": log, "backup": f"backups/publish-{ts}"}

    if not do_push:
        return result

    target_branch = os.getenv("ADMIN_PUBLISH_BRANCH", "main").strip() or "main"
    result["branch"] = target_branch

    # 3) Is dit wel een git-repo?
    check = _git(["rev-parse", "--is-inside-work-tree"])
    if check.returncode != 0:
        result["ok"] = False
        log.append("Geen git-repository gevonden; JSON-bestanden zijn wel lokaal bijgewerkt.")
        return result

    # 4) Stage alleen de toegestane databestanden.
    _git(["add", "--", "zg-data/zorggroepen.json", "zg-data/postcode_overrides.json"])
    staged = _git(["diff", "--cached", "--name-only"]).stdout.strip().splitlines()
    staged = [s.strip() for s in staged if s.strip()]
    if not staged:
        log.append("Geen wijzigingen om te publiceren (data is identiek aan de huidige JSON).")
        return result

    # Veiligheid: nooit iets buiten de allowlist committen.
    extra = [s for s in staged if s not in ALLOWED_PATHS]
    if extra:
        _git(["reset", "HEAD", "--", *staged])
        result["ok"] = False
        log.append(f"Publiceren afgebroken: onverwachte bestanden in de staging ({', '.join(extra)}). Niets gecommit/gepusht.")
        return result

    actor_email = getattr(actor, "email", "") or "admin"
    msg = (
        f"Admin publish: zorggroep-/postcodedata bijgewerkt via admin panel ({actor_email})\n\n"
        "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
    )
    commit = _git(["commit", "-m", msg, "--", "zg-data/zorggroepen.json", "zg-data/postcode_overrides.json"])
    if commit.returncode != 0:
        result["ok"] = False
        log.append(f"Commit mislukt: {commit.stderr.strip() or commit.stdout.strip()}")
        return result
    result["committed"] = True
    head = _git(["rev-parse", "--short", "HEAD"]).stdout.strip()
    log.append(f"Commit gemaakt ({head}).")

    # 5) Push naar de doel-branch.
    push = _git(["push", "origin", f"HEAD:{target_branch}"])
    if push.returncode != 0:
        result["ok"] = False
        log.append(f"Push mislukt: {(push.stderr or push.stdout).strip()}")
        log.append("De wijziging is wel lokaal gecommit. Push handmatig of controleer je GitHub-toegang.")
        return result
    result["pushed"] = True
    log.append(f"Gepusht naar origin/{target_branch}. De live site wordt na de deploy bijgewerkt.")
    return result
