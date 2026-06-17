"""Pytest fixtures: tijdelijke DB, TestClient en een ingelogde admin-sessie."""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Zet env VOOR het importeren van app-modules (db-engine wordt bij import gemaakt).
_TMP_DIR = tempfile.mkdtemp(prefix="miguide_test_")
os.environ["ADMIN_DB_PATH"] = os.path.join(_TMP_DIR, "test.db")
os.environ["ADMIN_JWT_SECRET"] = "test-secret-met-voldoende-lengte-voor-hmac-sha256"
os.environ["ADMIN_SESSION_MINUTES"] = "60"

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db import SessionLocal, init_db  # noqa: E402
from app.models import ROLE_SUPER_ADMIN, User  # noqa: E402
from app.security import hash_password  # noqa: E402

ADMIN_EMAIL = "test-admin@miguide.nl"
ADMIN_PASSWORD = "TestWachtwoord#1"


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as c:  # triggert startup: init_db + seed
        init_db()
        db = SessionLocal()
        try:
            if db.query(User).filter(User.email == ADMIN_EMAIL).first() is None:
                db.add(
                    User(
                        name="Test Admin",
                        email=ADMIN_EMAIL,
                        password_hash=hash_password(ADMIN_PASSWORD),
                        role=ROLE_SUPER_ADMIN,
                        is_active=True,
                    )
                )
                db.commit()
        finally:
            db.close()
        yield c


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    resp = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, resp.text
    return client
