"""Tests voor contractstatus, plaatsnamen, ZHZ-splitsing en verzekeraars uit de admin."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _uitloggen_na_test(client: TestClient):
    # De client wordt gedeeld tussen testbestanden: sessie-cookie niet laten doorlekken.
    yield
    client.cookies.clear()


def _public_zorggroepen(client: TestClient) -> dict:
    resp = client.get("/api/public/zorggroepen")
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_zhz_staat_als_twee_zorggroepen_in_de_data(client: TestClient) -> None:
    names = {z["zorggroep"] for z in _public_zorggroepen(client)["zorggroepen"]}
    assert {"ZHZ CZ", "ZHZ VGZ"} <= names
    assert "Zuid-Holland-Zuid" not in names


def test_geen_contract_zorggroepen_komen_als_nee_door(client: TestClient) -> None:
    status = {z["zorggroep"]: z["contract"] for z in _public_zorggroepen(client)["zorggroepen"]}
    assert status["HOOG"] is False
    assert status["HHT & HZGB"] is False
    assert status["ZHZ VGZ"] is True


def test_contractstatus_aanpassen_werkt_door_in_publieke_api(auth_client: TestClient) -> None:
    created = auth_client.post(
        "/api/admin/zorggroepen",
        json={"name": "Testgroep Contract", "has_contract": False, "locations": [{"city_name": "Testplaats"}]},
    )
    assert created.status_code == 201, created.text
    zid = created.json()["id"]
    assert created.json()["has_contract"] is False
    status = {z["zorggroep"]: z["contract"] for z in _public_zorggroepen(auth_client)["zorggroepen"]}
    assert status["Testgroep Contract"] is False

    updated = auth_client.put(f"/api/admin/zorggroepen/{zid}", json={"has_contract": True})
    assert updated.status_code == 200, updated.text
    status = {z["zorggroep"]: z["contract"] for z in _public_zorggroepen(auth_client)["zorggroepen"]}
    assert status["Testgroep Contract"] is True


def test_plaatsnamen_beheren_en_in_publieke_api(auth_client: TestClient) -> None:
    created = auth_client.post("/api/admin/place-aliases", json={"plaatsnaam": "Testdorp", "gemeente": "Lochem"})
    assert created.status_code == 201, created.text
    dubbel = auth_client.post("/api/admin/place-aliases", json={"plaatsnaam": "testdorp", "gemeente": "Deventer"})
    assert dubbel.status_code == 409
    aliases = _public_zorggroepen(auth_client)["place_aliases"]
    assert {"plaatsnaam": "Testdorp", "gemeente": "Lochem"} in aliases

    pid = created.json()["id"]
    assert auth_client.put(f"/api/admin/place-aliases/{pid}", json={"is_active": False}).status_code == 200
    aliases = _public_zorggroepen(auth_client)["place_aliases"]
    assert all(a["plaatsnaam"] != "Testdorp" for a in aliases)
    assert auth_client.delete(f"/api/admin/place-aliases/{pid}").status_code == 200


def test_vaste_plaatslijst_staat_in_de_admin(client: TestClient) -> None:
    aliases = {a["plaatsnaam"]: a["gemeente"] for a in _public_zorggroepen(client)["place_aliases"]}
    assert len(aliases) >= 96
    assert aliases["Bussum"] == "Gooise Meren"
    assert aliases["Friesland"] == ""  # bewust niet inkleuren
    # Alle BAG-woonplaatsen; dubbele/verwarrende namen met de gemeente erachter.
    assert len(aliases) > 2400
    assert aliases["Epse"] == "Lochem"
    assert aliases["Beuningen (Losser)"] == "Losser"
    assert "Beuningen" not in aliases  # kale naam = gemeente Beuningen, niet het dorp in Losser


def test_plaatsnaam_zonder_gemeente_mag(auth_client: TestClient) -> None:
    created = auth_client.post("/api/admin/place-aliases", json={"plaatsnaam": "Testregio Leeg"})
    assert created.status_code == 201, created.text
    assert created.json()["gemeente"] == ""
    lijst = auth_client.get("/api/admin/place-aliases")
    assert lijst.status_code == 200, lijst.text
    assert any(r["plaatsnaam"] == "Testregio Leeg" and r["gemeente"] == "" for r in lijst.json())
    assert auth_client.delete(f"/api/admin/place-aliases/{created.json()['id']}").status_code == 200


def test_pc4_overzicht_bevat_alle_gecontracteerde_ranges(auth_client: TestClient) -> None:
    resp = auth_client.get("/api/admin/postcode-overrides/ranges/overzicht")
    assert resp.status_code == 200, resp.text
    rows = resp.json()["ranges"]

    def zorggroepen_voor(pc4: str) -> set[str]:
        return {r["zorggroep"] for r in rows if pc4 in r["pc4s"].split()}

    assert zorggroepen_voor("3012") == {"Rijnmond dokters"}  # Rotterdam, via de plaatsen
    assert "HOOG" not in {r["zorggroep"] for r in rows}  # geen contract -> niet in het overzicht
    assert any(r["zorggroep"] == "Eemland" and "Uitzondering" in r["bron"] for r in rows)
    assert any(r["zorggroep"] == "ZHZ CZ" and r["alleen_voor"] == "CZ" for r in rows)


def test_pc4_overzicht_volgt_contractstatus(auth_client: TestClient) -> None:
    zg = next(z for z in auth_client.get("/api/admin/zorggroepen").json() if z["name"] == "Rijnmond dokters")
    try:
        assert auth_client.put(f"/api/admin/zorggroepen/{zg['id']}", json={"has_contract": False}).status_code == 200
        rows = auth_client.get("/api/admin/postcode-overrides/ranges/overzicht").json()["ranges"]
        assert all(r["zorggroep"] != "Rijnmond dokters" for r in rows)
    finally:
        auth_client.put(f"/api/admin/zorggroepen/{zg['id']}", json={"has_contract": True})


def test_nieuwe_verzekeraar_verschijnt_in_publieke_lijst(auth_client: TestClient) -> None:
    resp = auth_client.post("/api/admin/zorgverzekeraars", json={"name": "Testverzekeraar", "concern_key": "cz"})
    assert resp.status_code == 201, resp.text
    lijst = auth_client.get("/api/public/zorgverzekeraars").json()["zorgverzekeraars"]
    assert {"name": "Testverzekeraar", "concern_key": "cz"}.items() <= next(
        v for v in lijst if v["name"] == "Testverzekeraar"
    ).items()
