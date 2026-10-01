"""Zet de database klaar en synchroniseer hem met zg-data (idempotent).

Online (Vercel) doet de backend dit NIET bij elke koude start; draai dit script
bewust na een wijziging in zg-data of in het datamodel.

Gebruik (vanuit de repo-root, met de venv):

    python backend/scripts/sync_database.py          # lokale database (SQLite)
    python backend/scripts/sync_database.py --neon   # online database (NEON_DATABASE_URL uit backend/.env)

Eerste admin: als er nog geen gebruikers zijn, wordt een super_admin aangemaakt met
SEED_ADMIN_EMAIL (standaard admin@miguide.nl) en het wachtwoord uit
NEON_SEED_ADMIN_PASSWORD (bij --neon) of SEED_ADMIN_PASSWORD. Wachtwoorden en
database-adressen staan alleen in backend/.env, nooit in git.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _env_file_value(key: str) -> str:
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return ""
    match = re.search(rf"^{re.escape(key)}=(.+)$", env_path.read_text(encoding="utf-8"), re.M)
    return match.group(1).strip().strip('"').strip("'") if match else ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Synchroniseer de database met zg-data.")
    parser.add_argument("--neon", action="store_true", help="Gebruik de online Neon-database.")
    args = parser.parse_args()

    if args.neon:
        url = os.getenv("NEON_DATABASE_URL") or _env_file_value("NEON_DATABASE_URL")
        if not url:
            print("NEON_DATABASE_URL ontbreekt; zet hem in backend/.env.")
            return 1
        # Vóór het importeren van de app: de database-engine wordt bij import gemaakt.
        os.environ["DATABASE_URL"] = url
        password = os.getenv("NEON_SEED_ADMIN_PASSWORD") or _env_file_value("NEON_SEED_ADMIN_PASSWORD")
        if password:
            os.environ["SEED_ADMIN_PASSWORD"] = password
    os.environ.setdefault("SEED_ADMIN_EMAIL", "admin@miguide.nl")

    from sqlalchemy import func, select

    from app.db import SessionLocal, init_db
    from app.models import PostcodeOverride, PostcodeRangeOverride, User, Zorggroep, Zorgverzekeraar
    from app.services.import_seed import ensure_seed_admin, import_seed

    print(f"Database: {'Neon (online)' if args.neon else 'lokaal (SQLite)'}")
    init_db()
    db = SessionLocal()
    try:
        result = import_seed(db)
        admin_created = ensure_seed_admin(db)

        def count(model) -> int:
            return db.scalar(select(func.count()).select_from(model)) or 0

        changes = {key: value for key, value in result.items() if value}
        print("Wijzigingen:", changes or "geen (al in sync)")
        print("Super_admin aangemaakt:", "ja" if admin_created else "nee (bestond al, of geen wachtwoord ingesteld)")
        print(
            f"Totaal - zorggroepen: {count(Zorggroep)}, verzekeraars: {count(Zorgverzekeraar)}, "
            f"exacte postcodes: {count(PostcodeOverride)}, postcode-ranges: {count(PostcodeRangeOverride)}, "
            f"gebruikers: {count(User)}"
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
