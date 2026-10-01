"""Tests voor de Vercel-specifieke onderdelen van de admin-backend."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_rewrite_herstelt_origineel_pad(client: TestClient) -> None:
    # Zoals Vercel het doorstuurt als alleen het functiepad binnenkomt.
    resp = client.get("/api/admin_api", params={"__zg_path": "/api/public/version"})
    assert resp.status_code == 200, resp.text
    assert "data_version" in resp.json()


def test_rewrite_hulpparameter_stoort_niet_bij_origineel_pad(client: TestClient) -> None:
    resp = client.get("/api/public/version", params={"__zg_path": "/api/public/version"})
    assert resp.status_code == 200, resp.text


def test_rewrite_kan_niet_naar_andere_paden(client: TestClient) -> None:
    # Alleen /api/auth|public|admin/ zijn toegestaan; een ander doel wordt genegeerd.
    resp = client.get("/api/admin_api", params={"__zg_path": "/admin/index.html"})
    assert resp.status_code == 404


def test_admin_route_via_rewrite_vereist_nog_steeds_login(client: TestClient) -> None:
    anoniem = TestClient(client.app)  # eigen client zonder sessie-cookie
    resp = anoniem.get("/api/admin_api", params={"__zg_path": "/api/admin/stats"})
    assert resp.status_code in (401, 403), resp.text


def test_online_nooit_publieke_dev_sleutel_en_secure_cookie(monkeypatch) -> None:
    from app.config import Settings

    monkeypatch.delenv("ADMIN_JWT_SECRET", raising=False)
    monkeypatch.delenv("ADMIN_COOKIE_SECURE", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://gebruiker:geheim@host/db")
    monkeypatch.setenv("VERCEL", "1")
    settings = Settings()
    assert settings.jwt_secret != "dev-only-insecure-secret-change-me"
    assert len(settings.jwt_secret) == 64
    assert settings.cookie_secure is True
