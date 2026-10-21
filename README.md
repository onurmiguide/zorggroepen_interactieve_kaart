# MiGuide Zorgtools

Deze repository bevat inmiddels meer dan 1 webapp binnen dezelfde toolset.

Huidige apps:
- `Zorgtool` (`zorgtool.html`): zoeken op postcode/gemeente en zorgverzekeraar
- `Zorggroep kaart` (`zorggroepkaart.html`): overzicht van alle zorggroepen
- `Losse verwijzing tool` (`losse-verwijzing-tool/`, in opbouw)
- `Admin CRUD-omgeving` (`admin/`) - zie [`backend/README.md`](backend/README.md)

De startpagina `index.html` toont na inloggen de tools en de laatste updates.
Alle pagina's (behalve de admin) delen `css/site.css` en `script/site.js`.

## Admin CRUD-omgeving (lokaal)

Er is een lokale adminomgeving (FastAPI + SQLite) waarmee zorggroepen,
zorgverzekeraars, facturatiestromen/-modules, contractregels en gebruikers beheerd
kunnen worden, met save-knoppen, validatie en een History/audit-tab. De kaart leest
de actuele data via een publieke API en valt terug op `zg-data/zorggroepen.json`.

Snel starten (vanuit de repo-root):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\scripts\seed_admin.py --email admin@miguide.nl --name "MiGuide Admin"
python -m uvicorn backend.app.main:app --reload --port 8000
```

Open daarna **http://127.0.0.1:8000/admin/**. Volledige uitleg, API-overzicht en een
testchecklist staan in [`backend/README.md`](backend/README.md).

> Online draait de admin-API als Vercel-functie met een Neon-database; zie `backend/README.md`.

## App 1: Zorggroepen Interactieve Kaart

Interactieve webapp (Leaflet.js) voor het tonen en filteren van Nederlandse zorggroep-domeinen op basis van officiele bestuurlijke gebieden en lokale zorggroepdata.

## Functionaliteiten

- Kaart met zorggroepgebieden (Leaflet + OpenStreetMap tiles), begrensd tot Nederland
- Zoekveld voor gemeente, plaats/stad/dorp, Postcode4 (`1234`) en Postcode6 (`1234AB` of `1234 AB`), met suggesties (ook met het toetsenbord te bedienen)
- Zorgverzekeraar-keuze; de uitkomst toont zorggroep, facturatiemodule, facturatiestroom en prestatiecode, met een uitleg "Waarom?"
- Meldingen voor ZHZ (via Monter), VGZ (verwijzing controleren) en RMA (GLI niet vergoed)
- Kaartfilters voor zorggroep en facturatiestroom (wat niet past wordt gedimd)
- Klik op een gebied: zorggroep met plaatsen en postcodes
- Deelbare link: `zorgtool.html?postcode=1234AB&verzekeraar=CZ`
- Donkere modus en een versleepbaar onderpaneel op mobiel

## Tech Stack

- HTML, CSS, JavaScript (vanilla)
- [Leaflet 1.9.4](https://leafletjs.com/) via CDN
- OpenStreetMap tiles (geen API key)

## Datasources

### Lokale projectdata

- `zg-data/zorggroepen.json`
  - Zorggroepen, regio, website, en lijst met plaatsen/steden/dorpen
- `zg-data/Miguide_website_logo_32-px.png.webp`

### Externe PDOK APIs

- Bestuurlijke gebieden OGC API (gemeentegrenzen):
  - `https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1`
- CBS Postcode6 WFS (postcode-lookup):
  - `https://service.pdok.nl/cbs/postcode6/2024/wfs/v1_0`

## App 2: Losse verwijzing verwerken

Tweede app in deze repository:
- doel: inkomende verwijzingen uit PDF of afbeelding omzetten naar gestructureerde data
- huidige status: in opbouw / concept
- huidige richting: frontend reviewtool + Python backend voor documentverwerking

Wat er nu onder valt:
- upload van PDF of afbeelding
- document preview
- ruwe tekstextractie
- automatische veldextractie naar gestructureerde data
- validatie en JSON export

De losse verwijzing-app staat in:
- `losse-verwijzing-tool/`

De backend van deze app staat in:
- `losse-verwijzing-tool/backend/`

Meer details en startinstructies:
- `losse-verwijzing-tool/README.md`

## Projectstructuur

```text
.
|- index.html               startpagina (wachtwoord, tools, laatste updates)
|- zorgtool.html            Zorgtool
|- zorggroepkaart.html      Zorggroep kaart (alle-zorggroepen.html stuurt hierheen door)
|- updates.html / documentatie.html / data-overzicht.html
|- README.md
|- css/
|  |- site.css              huisstijl voor alle pagina's
|- script/
|  |- site.js               thema, menu, wachtwoordscherm, mobiel onderpaneel
|  |- script.js             logica Zorgtool
|  |- zorgtool.js           weergave Zorgtool
|  |- alle-zorggroepen.js   logica Zorggroep kaart
|  |- zorggroepkaart.js     weergave Zorggroep kaart
|  |- data-overzicht.js
|- losse-verwijzing-tool/
|  |- index.html
|  |- style.css
|  |- script.js
|  |- README.md
|  |- backend/
|  |  |- app.py
|  |  |- service.py
|  |  |- requirements.txt
|  |- data/
|     |- referral-schema.json
|- zg-data/
|  |- zorggroepen.json
|  |- zorggroepen.geojson
|  |- Miguide_website_logo_32-px.png.webp
|  |- _postcode_wfs_capabilities.xml
|  |- _postcode_wms_capabilities.xml
|  |- _postcode_wfs_describe.xml
```

## Lokaal draaien

1. Open de map in VS Code.
2. Installeer/gebruik de extension `Live Server`.
3. Start `index.html` met Live Server, of start de backend (zie hierboven) en open
   http://127.0.0.1:8000/.

Belangrijk:
- Gebruik een lokale server (niet `file://`) i.v.m. `fetch` van JSON/API data.
- Internetverbinding is nodig voor PDOK en OpenStreetMap.

## Zoek- en filterlogica

- Zoek op gemeente/plaats:
  - Suggesties verschijnen live.
  - Enter of klikken past filters toe.
- Zoek op postcode:
  - `1234` (PC4) of `1234AB`/`1234 AB` (PC6)
  - App zoekt via PDOK WFS en koppelt naar gemeente.
  - Als gemeente niet in zorggroepdomeinen valt, verschijnt melding.
- Domeinfilter + zoekfilter werken gecombineerd.

## Aanpassen van zorggroepdata

Bewerk `zg-data/zorggroepen.json`:

- `zorggroep`: naam van de zorggroep
- `regio`: regio-label
- `website`: website URL
- `cities`: lijst met plaatsen/steden/dorpen

Na opslaan en refresh in browser worden wijzigingen direct gebruikt.

### Contractdata (zorgverzekeraar + facturatiestroom)

De app ondersteunt contractdata per zorggroep via 2 opties:

1. Inline per zorggroep-object:

```json
{
  "zorggroep": "Rijnmond dokters",
  "cities": ["Rotterdam"],
  "contracten": [
    { "zorgverzekeraar": "Menzis", "declaratiestroom": "VIPLive", "contract": "Ja" },
    { "zorgverzekeraar": "CZ", "declaratiestroom": "VIPLive", "contract": "Nee" }
  ]
}
```

2. Centrale matrix op root-niveau:

```json
{
  "contracten": [
    { "zorggroep": "Rijnmond dokters", "zorgverzekeraar": "Menzis", "declaratiestroom": "VIPLive", "contract": "Ja" }
  ]
}
```

`contract` accepteert o.a. `Ja/Nee`, `true/false`, `gecontracteerd/ongecontracteerd`.

## Bekende aandachtspunten

- Plaatsnamen met varianten/afkortingen beheer je in de admin (Postcodes → Plaatsnamen); `CITY_TO_GEMEENTE` in `script/script.js` is alleen een reserve als de API niet bereikbaar is.
- Resultaten van postcodezoeking hangen af van beschikbaarheid/kwaliteit van PDOK dataset.
- De verwijzing-tool heeft voor documentverwerking een aparte Python backend nodig.

## Contact

Bij issues of updates:
- Email: `info@miguide.nl`
- Of intern bericht aan Onur
