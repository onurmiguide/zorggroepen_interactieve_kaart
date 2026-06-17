# MiGuide Zorgtools - Admin CRUD backend

Lokale admin-omgeving voor het beheren van zorggroepen, zorgverzekeraars,
facturatiestromen/-modules, contractregels en gebruikers. Gebouwd met **FastAPI +
SQLite**. De publieke kaart blijft werken op de bestaande `zg-data/zorggroepen.json`
als fallback wanneer de backend niet draait.

> **Belangrijk:** dit is een lokale build. Er is **niets naar GitHub gepusht**.
> Test eerst lokaal; pushen beslis je (Onur) zelf.

## Wat zit erin

- `backend/app/` - FastAPI applicatie (modellen, schemas, security, routers, services).
- `admin/` - de adminomgeving (login + tabs Dashboard, Zorggroepen, Zorgverzekeraars,
  Facturatiestromen, Contracten/Matrix, Gebruikers, History).
- `shared/api-client.js` - gedeelde fetch-client (stuurt de HttpOnly sessie-cookie mee).
- `backend/scripts/seed_admin.py` - CLI om de eerste super_admin aan te maken.
- `backend/tests/` - pytest integratietests.

De database wordt bij de eerste start **automatisch geseed** vanuit
`zg-data/zorggroepen.json` en de 2026-beslisboomwaarden uit `script/script.js`
(zorgverzekeraars, facturatiestromen, facturatiemodules, routeregels).

## 1. Installeren

Vanuit de repo-root (Windows PowerShell):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Optioneel een eigen omgeving instellen:

```powershell
copy backend\.env.example backend\.env
# Open backend\.env en zet minimaal een lange, willekeurige ADMIN_JWT_SECRET.
```

## 2. Seed-admin aanmaken

De eerste keer maak je een super_admin aan. Het wachtwoord staat **nooit in code**;
het komt uit een prompt of uit de env var `SEED_ADMIN_PASSWORD`.

```powershell
python backend\scripts\seed_admin.py --email admin@miguide.nl --name "MiGuide Admin"
# Voer daarna een wachtwoord in (min. 8 tekens).
```

Wachtwoord later resetten:

```powershell
python backend\scripts\seed_admin.py --email admin@miguide.nl --reset-password
```

## 3. Backend starten

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

De server draait nu op `http://127.0.0.1:8000`.

- Adminomgeving: **http://127.0.0.1:8000/admin/**
- Publieke kaart (same-origin, met live admin-data): **http://127.0.0.1:8000/**
- API-documentatie (Swagger): **http://127.0.0.1:8000/docs**

> De adminomgeving wordt bewust **same-origin** geserveerd door de backend, zodat de
> veilige HttpOnly sessie-cookie meegestuurd kan worden. Open de admin dus via
> `:8000/admin/`, niet via Live Server.

## 4. De publieke kaart

De kaart (`script/script.js`) probeert eerst de actuele data uit
`GET /api/public/zorggroepen` en valt automatisch terug op
`zg-data/zorggroepen.json` als de backend niet draait.

- Open je de kaart via **http://127.0.0.1:8000/** dan zie je live de admin-data
  (na een save loopt de data-versie op; herlaad de pagina om de wijziging te zien).
- Open je de kaart via **Live Server (:5500)** dan probeert hij `127.0.0.1:8000`
  te bereiken (CORS staat dit toe) en valt anders terug op het JSON-bestand.
- In productie (Vercel, zonder backend) wordt gewoon het JSON-bestand gebruikt.

## 5. Tests draaien

```powershell
pip install -r backend\requirements-dev.txt
python -m pytest backend\tests -q
```

## Kaartkleuren per zorggroep

In het tabblad **Zorggroepen** kun je per zorggroep een vaste kaartkleur kiezen
(kleurkiezer + "Automatische kleur"-vinkje). Laat je het vinkje aan, dan berekent
de kaart de kleur automatisch uit de naam (huidige gedrag). Kies je een kleur, dan
gebruikt de kaart die. Geen-contract-gebieden blijven grijs.

## Postcode-uitzonderingen

Het tabblad **Postcodes** beheert drie soorten uitzonderingen die boven de brede
gemeente-/plaatslogica gaan:

- **Exacte postcodes (PC6)** — bijv. 8401PA → "Geen zorggroep contract".
- **Postcode-ranges (PC4)** — bijv. 1398 t/m 1412 → RHOGO.
- **Locatie-postcodes** — woonplaats/gemeente-correctie voor een PC6.

Volgorde van voorrang: exacte PC6 → PC4-range → gewone gemeente-/plaatslogica.

## Publiceren naar GitHub

Met de knop **Publiceren** (rechtsboven, rol admin of super_admin) schrijft de admin
de database terug naar `zg-data/zorggroepen.json` en `zg-data/postcode_overrides.json`
(met automatische backup in `backups/`), maakt een git-commit van **alleen die twee
databestanden** en pusht naar de branch uit `ADMIN_PUBLISH_BRANCH` (standaard `main`).
Na de deploy van die branch werkt de live site bij.

- Een allowlist-check zorgt dat nooit iets anders dan de twee JSON-bestanden meegaat;
  de admin-code blijft buiten de commit.
- Lukt de push niet (bijv. geen GitHub-toegang), dan is de wijziging wel lokaal
  gecommit en zie je de foutmelding in de admin.
- Pushen vereist dat git op deze machine toegang heeft tot de repo (credential helper
  of token).

## Online hosten (Render + PostgreSQL)

De admin draait online als je een host met een continu proces + een blijvende
database gebruikt. SQLite/local werkt niet op Vercel (geen blijvend bestandssysteem).

**Stappen op [render.com](https://render.com):**

1. **New → Blueprint**, kies deze repo. Render leest `render.yaml` en maakt:
   - een **PostgreSQL**-database (`miguide-admin-db`), en
   - een **Web Service** (`miguide-admin`) die `uvicorn backend.app.main:app` draait.
   (Of handmatig: New → PostgreSQL, en New → Web Service met dezelfde build/start commands.)
2. Zet in het Render-dashboard de variabele **`SEED_ADMIN_PASSWORD`** (een sterk
   wachtwoord). De andere env-vars vult de blueprint in:
   - `DATABASE_URL` (automatisch uit de database)
   - `ADMIN_JWT_SECRET` (automatisch gegenereerd)
   - `ADMIN_COOKIE_SECURE=true`, `ADMIN_ALLOWED_ORIGINS` (je Vercel-domein),
     `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`.
3. Deploy. Bij de eerste start worden de data geseed (zorggroepen, verzekeraars,
   facturatie, postcodes) en wordt de **eerste super_admin** aangemaakt uit
   `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`.
4. Open `https://<jouw-service>.onrender.com/admin/` en log in. De admin-UI én API
   draaien same-origin, dus de veilige sessie-cookie werkt meteen.

**Let op:**
- De gratis Render-service "slaapt" na inactiviteit; de eerste aanvraag daarna duurt
  even (koude start).
- De **Publiceren-knop** (commit/push naar GitHub) is bedoeld voor lokaal gebruik;
  op de hosted omgeving heeft die geen git-toegang. De online admin schrijft gewoon
  naar de database.
- Wil je dat de publieke kaart (Vercel) live de online data leest, zet dan op de
  kaartpagina `window.MIGUIDE_ADMIN_API = "https://<jouw-service>.onrender.com"`.
  Anders blijft de kaart de `zg-data` JSON gebruiken (en kun je die met de
  Publiceren-knop lokaal bijwerken).

## Rollen

| Rol | Mag |
|-----|-----|
| `viewer` | alleen lezen |
| `editor` | zorggroepen, verzekeraars, facturatie en contracten beheren |
| `admin` | idem als editor (ruimte voor uitbreiding) |
| `super_admin` | alles, inclusief gebruikersbeheer |

## API-overzicht

```
POST   /api/auth/login            GET /api/auth/me           POST /api/auth/logout
GET    /api/public/zorggroepen    GET /api/public/version
GET    /api/public/zorgverzekeraars   GET /api/public/facturatiestromen
GET/POST/PUT/DELETE  /api/admin/zorggroepen[/{id}]
GET/POST/PUT/DELETE  /api/admin/zorgverzekeraars[/{id}]
GET/POST/PUT/DELETE  /api/admin/facturatiestromen[/{id}]
GET/POST/PUT/DELETE  /api/admin/contract-rules[/{id}]
GET/POST/PUT/DELETE  /api/admin/users[/{id}]          (alleen super_admin)
GET    /api/admin/audit-logs      GET /api/admin/stats
```

- Alle admin-endpoints vereisen een ingelogde gebruiker + rolcheck.
- Elke create/update/delete schrijft een audit log (zonder wachtwoorden).
- `DELETE` is standaard een soft-delete (`is_active=false`); `?hard=true` verwijdert echt.
- Na elke admin-save loopt de `data_version` op zodat de kaart de wijziging kan ophalen.

## Testchecklist (handmatig)

- [ ] Backend start zonder errors op http://127.0.0.1:8000.
- [ ] Adminpagina opent apart op /admin/.
- [ ] Seed-admin kan inloggen en uitloggen.
- [ ] Verkeerd wachtwoord geeft een nette foutmelding.
- [ ] Nieuwe zorggroep toevoegen en opslaan werkt.
- [ ] Zorggroep aanpassen wijzigt de kaartdata via de API (data-versie loopt op).
- [ ] Zorgverzekeraar toevoegen met alias werkt.
- [ ] Facturatiestroom/-module aanpassen werkt.
- [ ] Contractregel koppelt zorggroep + verzekeraar + facturatiestroom.
- [ ] Verwijderen/deactiveren vraagt eerst om bevestiging.
- [ ] History toont actie met gebruiker, tijdstip, oude en nieuwe waarde.
- [ ] Nieuwe gebruiker aanmaken en inloggen werkt (alleen super_admin beheert users).
- [ ] Gedeactiveerde gebruiker kan niet inloggen.
- [ ] Bestaande postcodezoeking en PDOK-kaart blijven werken.
- [ ] Met backend uit: kaart valt terug op zg-data/zorggroepen.json.
```
