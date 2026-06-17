"""Integratietests voor de admin-API."""
from __future__ import annotations


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_seed_loaded_public_zorggroepen(client):
    data = client.get("/api/public/zorggroepen").json()
    assert data["source"] == "miguide-admin-api"
    assert len(data["zorggroepen"]) >= 1
    first = data["zorggroepen"][0]
    assert set(["zorggroep", "regio", "website", "cities"]).issubset(first.keys())


def test_login_required_for_admin(client):
    # Zonder sessie -> 401
    assert client.get("/api/admin/stats").status_code == 401


def test_wrong_password(client):
    resp = client.post("/api/auth/login", json={"email": "test-admin@miguide.nl", "password": "fout"})
    assert resp.status_code == 401


def test_me_and_stats(auth_client):
    me = auth_client.get("/api/auth/me").json()
    assert me["role"] == "super_admin"
    stats = auth_client.get("/api/admin/stats").json()
    assert stats["zorggroepen_total"] >= 1


def test_zorggroep_crud_and_version_bump(auth_client):
    before = auth_client.get("/api/public/version").json()["data_version"]

    created = auth_client.post(
        "/api/admin/zorggroepen",
        json={"name": "PyTest Groep", "regio": "Test", "website": "https://x.nl", "is_active": True,
              "locations": [{"city_name": "Teststad"}]},
    ).json()
    assert created["id"] > 0
    assert len(created["locations"]) == 1

    # Dubbele naam -> 409
    dup = auth_client.post("/api/admin/zorggroepen", json={"name": "PyTest Groep"})
    assert dup.status_code == 409

    # Ongeldige website -> 422
    bad = auth_client.post("/api/admin/zorggroepen", json={"name": "Bad URL", "website": "geen-url"})
    assert bad.status_code == 422

    updated = auth_client.put(f"/api/admin/zorggroepen/{created['id']}", json={"regio": "Gewijzigd"}).json()
    assert updated["regio"] == "Gewijzigd"

    after = auth_client.get("/api/public/version").json()["data_version"]
    assert int(after) > int(before)

    # Soft-delete
    auth_client.delete(f"/api/admin/zorggroepen/{created['id']}")
    got = auth_client.get(f"/api/admin/zorggroepen/{created['id']}").json()
    assert got["is_active"] is False

    # Hard delete opruimen
    auth_client.delete(f"/api/admin/zorggroepen/{created['id']}?hard=true")
    assert auth_client.get(f"/api/admin/zorggroepen/{created['id']}").status_code == 404


def test_zorgverzekeraar_aliases(auth_client):
    created = auth_client.post(
        "/api/admin/zorgverzekeraars",
        json={"name": "PyTest Verzekeraar", "concern_key": "pytest", "aliases": ["Alias A", "Alias B"], "is_active": True},
    ).json()
    assert created["aliases"] == ["Alias A", "Alias B"]
    auth_client.delete(f"/api/admin/zorgverzekeraars/{created['id']}?hard=true")


def test_contract_rule_validation(auth_client):
    zg = auth_client.post("/api/admin/zorggroepen", json={"name": "PyTest Contract ZG"}).json()
    rule = auth_client.post(
        "/api/admin/contract-rules",
        json={"zorggroep_id": zg["id"], "contract_status": "gecontracteerd", "notes": "test"},
    ).json()
    assert rule["zorggroep_name"] == "PyTest Contract ZG"
    # Dubbele combinatie -> 409
    dup = auth_client.post("/api/admin/contract-rules", json={"zorggroep_id": zg["id"]})
    assert dup.status_code == 409
    # Onbekende zorggroep -> 422
    bad = auth_client.post("/api/admin/contract-rules", json={"zorggroep_id": 999999})
    assert bad.status_code == 422
    auth_client.delete(f"/api/admin/contract-rules/{rule['id']}")
    auth_client.delete(f"/api/admin/zorggroepen/{zg['id']}?hard=true")


def test_user_management_and_guards(auth_client):
    # Maak een editor aan
    created = auth_client.post(
        "/api/admin/users",
        json={"name": "PyTest Editor", "email": "pytest-editor@miguide.nl", "password": "WachtwoordA1", "role": "editor"},
    ).json()
    assert created["role"] == "editor"

    # Dubbel e-mail -> 409
    dup = auth_client.post(
        "/api/admin/users",
        json={"name": "x", "email": "pytest-editor@miguide.nl", "password": "WachtwoordA1"},
    )
    assert dup.status_code == 409

    # Te kort wachtwoord -> 422
    short = auth_client.post(
        "/api/admin/users",
        json={"name": "x", "email": "short@miguide.nl", "password": "1234"},
    )
    assert short.status_code == 422

    auth_client.delete(f"/api/admin/users/{created['id']}?hard=true")


def test_editor_cannot_manage_users(client):
    # Maak via super_admin een editor aan, log daarna in als editor.
    client.post("/api/auth/login", json={"email": "test-admin@miguide.nl", "password": "TestWachtwoord#1"})
    client.post(
        "/api/admin/users",
        json={"name": "RBAC Editor", "email": "rbac-editor@miguide.nl", "password": "WachtwoordA1", "role": "editor"},
    )
    client.post("/api/auth/logout")

    client.post("/api/auth/login", json={"email": "rbac-editor@miguide.nl", "password": "WachtwoordA1"})
    # Editor mag GEEN users zien
    assert client.get("/api/admin/users").status_code == 403
    # Editor mag WEL zorggroepen zien
    assert client.get("/api/admin/zorggroepen").status_code == 200
    client.post("/api/auth/logout")


def test_zorggroep_color_field(auth_client):
    created = auth_client.post(
        "/api/admin/zorggroepen", json={"name": "Kleur ZG", "color": "#ff8800"}
    ).json()
    assert created["color"] == "#ff8800"
    # zichtbaar in publieke API
    pub = auth_client.get("/api/public/zorggroepen").json()
    match = next((z for z in pub["zorggroepen"] if z["zorggroep"] == "Kleur ZG"), None)
    assert match and match.get("color") == "#ff8800"
    # ongeldige kleur -> 422
    bad = auth_client.put(f"/api/admin/zorggroepen/{created['id']}", json={"color": "rood"})
    assert bad.status_code == 422
    auth_client.delete(f"/api/admin/zorggroepen/{created['id']}?hard=true")


def test_postcode_overrides_seeded_and_public(client):
    data = client.get("/api/public/postcode-overrides").json()
    assert "exact_postcode6_overrides" in data
    assert "postcode4_range_overrides" in data
    assert isinstance(data["postcode4_range_overrides"], list)


def test_exact_override_crud(auth_client):
    created = auth_client.post(
        "/api/admin/postcode-overrides/exact",
        json={"postcode6": "1234AB", "zorggroep": "Geen zorggroep contract", "source_sheet": "test"},
    ).json()
    assert created["postcode6"] == "1234AB"
    # duplicate -> 409
    dup = auth_client.post(
        "/api/admin/postcode-overrides/exact",
        json={"postcode6": "1234 ab", "zorggroep": "X"},
    )
    assert dup.status_code == 409
    # invalid postcode -> 422
    bad = auth_client.post(
        "/api/admin/postcode-overrides/exact", json={"postcode6": "12", "zorggroep": "X"}
    )
    assert bad.status_code == 422
    auth_client.delete(f"/api/admin/postcode-overrides/exact/{created['id']}")


def test_range_override_validation(auth_client):
    bad = auth_client.post(
        "/api/admin/postcode-overrides/ranges",
        json={"start_pc4": "1300", "end_pc4": "1200", "zorggroep": "RHOGO"},
    )
    assert bad.status_code == 422
    ok = auth_client.post(
        "/api/admin/postcode-overrides/ranges",
        json={"start_pc4": "1200", "end_pc4": "1299", "zorggroep": "RHOGO", "source_sheet": "test"},
    ).json()
    assert ok["start_pc4"] == "1200"
    auth_client.delete(f"/api/admin/postcode-overrides/ranges/{ok['id']}")


def test_publish_build_functions_no_write(client):
    # Roept de build-functies direct aan (geen bestand schrijven, geen git).
    from app.db import SessionLocal
    from app.services import publish_service

    db = SessionLocal()
    try:
        zg = publish_service.build_zorggroepen_json(db)
        assert "zorggroepen" in zg and isinstance(zg["zorggroepen"], list)
        pc = publish_service.build_postcode_overrides_json(db)
        assert "exact_postcode6_overrides" in pc
        assert "postcode4_range_overrides" in pc
    finally:
        db.close()


def test_publish_requires_admin_role(client):
    # Editor mag niet publiceren (403, en er wordt niets geschreven/gepusht).
    client.post("/api/auth/login", json={"email": "test-admin@miguide.nl", "password": "TestWachtwoord#1"})
    client.post(
        "/api/admin/users",
        json={"name": "Pub Editor", "email": "pub-editor@miguide.nl", "password": "WachtwoordA1", "role": "editor"},
    )
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "pub-editor@miguide.nl", "password": "WachtwoordA1"})
    assert client.post("/api/admin/publish?push=false").status_code == 403
    client.post("/api/auth/logout")


def test_rollback_update(auth_client):
    # Maak een zorggroep, wijzig 'm, herstel via de bijbehorende auditregel.
    created = auth_client.post("/api/admin/zorggroepen", json={"name": "Rollback ZG", "regio": "Eerst"}).json()
    auth_client.put(f"/api/admin/zorggroepen/{created['id']}", json={"regio": "Gewijzigd"})
    # vind de update-logregel
    logs = auth_client.get("/api/admin/audit-logs?entity_type=zorggroep&action=update&limit=20").json()
    log = next(l for l in logs if l["entity_id"] == str(created["id"]))
    res = auth_client.post(f"/api/admin/audit-logs/{log['id']}/rollback")
    assert res.status_code == 200
    restored = auth_client.get(f"/api/admin/zorggroepen/{created['id']}").json()
    assert restored["regio"] == "Eerst"
    auth_client.delete(f"/api/admin/zorggroepen/{created['id']}?hard=true")


def test_rollback_restores_locations(auth_client):
    # Maak een zorggroep met 2 plaatsen, wijzig de plaatsen, herstel via history.
    created = auth_client.post(
        "/api/admin/zorggroepen",
        json={"name": "Loc Rollback ZG", "locations": [{"city_name": "Stad A"}, {"city_name": "Stad B"}]},
    ).json()
    assert len(created["locations"]) == 2
    # wijzig plaatsen naar 1 andere plaats
    auth_client.put(
        f"/api/admin/zorggroepen/{created['id']}",
        json={"locations": [{"city_name": "Stad C"}]},
    )
    mid = auth_client.get(f"/api/admin/zorggroepen/{created['id']}").json()
    assert [l["city_name"] for l in mid["locations"]] == ["Stad C"]
    # herstel de update
    logs = auth_client.get("/api/admin/audit-logs?entity_type=zorggroep&action=update&limit=30").json()
    log = next(l for l in logs if l["entity_id"] == str(created["id"]))
    auth_client.post(f"/api/admin/audit-logs/{log['id']}/rollback")
    restored = auth_client.get(f"/api/admin/zorggroepen/{created['id']}").json()
    cities = sorted(l["city_name"] for l in restored["locations"])
    assert cities == ["Stad A", "Stad B"]
    auth_client.delete(f"/api/admin/zorggroepen/{created['id']}?hard=true")


def test_rollback_recreates_deleted(auth_client):
    created = auth_client.post("/api/admin/zorgverzekeraars", json={"name": "Rollback ZV", "concern_key": "rb"}).json()
    auth_client.delete(f"/api/admin/zorgverzekeraars/{created['id']}?hard=true")
    logs = auth_client.get("/api/admin/audit-logs?entity_type=zorgverzekeraar&action=delete&limit=20").json()
    log = next(l for l in logs if l["entity_id"] == str(created["id"]))
    res = auth_client.post(f"/api/admin/audit-logs/{log['id']}/rollback")
    assert res.status_code == 200
    names = [z["name"] for z in auth_client.get("/api/admin/zorgverzekeraars").json()]
    assert "Rollback ZV" in names


def test_audit_logs_recorded(auth_client):
    auth_client.post("/api/auth/login", json={"email": "test-admin@miguide.nl", "password": "TestWachtwoord#1"})
    logs = auth_client.get("/api/admin/audit-logs?limit=10").json()
    assert isinstance(logs, list)
    assert any(l["action"] in ("create", "update", "delete", "login") for l in logs)
    # Wachtwoorden mogen nooit in audit terechtkomen
    for l in logs:
        assert "password" not in l["new_value_json"].lower()
