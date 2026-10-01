"""Vercel-functie voor de admin-backend van de Zorgtool (FastAPI + Neon PostgreSQL).

vercel.json stuurt /api/auth/*, /api/public/* en /api/admin/* naar deze functie.
De database komt uit de Vercel-omgevingsvariabele DATABASE_URL (Neon). Schema en
data synchroniseer je bewust met backend/scripts/sync_database.py (niet bij elke
koude start).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app  # noqa: E402,F401  (Vercel zoekt naar 'app')
