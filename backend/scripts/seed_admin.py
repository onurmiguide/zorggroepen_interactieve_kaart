"""CLI om een seed super_admin aan te maken of het wachtwoord te resetten.

Gebruik (vanuit de repo-root, met geactiveerde venv):

    python backend/scripts/seed_admin.py --email admin@miguide.nl --name "MiGuide Admin"

Het wachtwoord komt uit (in volgorde):
1. de --password vlag,
2. de env var SEED_ADMIN_PASSWORD,
3. een interactieve, verborgen prompt.

Er staan dus nooit wachtwoorden in de code of in git.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import SessionLocal, init_db  # noqa: E402
from app.models import ROLE_SUPER_ADMIN, User  # noqa: E402
from app.security import hash_password  # noqa: E402
from sqlalchemy import select  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Maak of update een seed super_admin.")
    parser.add_argument("--email", default=os.getenv("SEED_ADMIN_EMAIL", "admin@miguide.nl"))
    parser.add_argument("--name", default=os.getenv("SEED_ADMIN_NAME", "MiGuide Admin"))
    parser.add_argument("--password", default=None, help="Optioneel; anders env of prompt.")
    parser.add_argument("--reset-password", action="store_true", help="Reset wachtwoord als gebruiker al bestaat.")
    args = parser.parse_args()

    email = args.email.lower().strip()
    password = args.password or os.getenv("SEED_ADMIN_PASSWORD") or ""
    if not password:
        password = getpass.getpass("Wachtwoord voor seed-admin: ")
        confirm = getpass.getpass("Bevestig wachtwoord: ")
        if password != confirm:
            print("Wachtwoorden komen niet overeen.", file=sys.stderr)
            return 1
    if len(password) < 8:
        print("Wachtwoord moet minstens 8 tekens zijn.", file=sys.stderr)
        return 1

    init_db()
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            if args.reset_password:
                existing.password_hash = hash_password(password)
                existing.is_active = True
                existing.role = ROLE_SUPER_ADMIN
                db.commit()
                print(f"Wachtwoord/rol bijgewerkt voor bestaande gebruiker: {email}")
            else:
                print(f"Gebruiker bestaat al: {email}. Gebruik --reset-password om te resetten.")
            return 0

        user = User(
            name=args.name.strip(),
            email=email,
            password_hash=hash_password(password),
            role=ROLE_SUPER_ADMIN,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Seed super_admin aangemaakt: {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
