# Losse verwijzing verwerken

Deze tool verwerkt inkomende verwijzingen van huisartsen naar gestructureerde data.

Huidige opzet:
- frontend: `index.html`, `style.css`, `script.js`
- backend: Python `FastAPI` in `backend/`
- output: reviewformulier + JSON export

Wat de backend nu doet:
- bestandstype bepalen (`pdf` of `image`)
- tekst-PDF direct uitlezen
- OCR fallback voor scans/foto's
- label-gebaseerde extractie naar velden
- validatieberichten teruggeven aan de frontend

Belangrijke backendbestanden:
- `backend/app.py`
- `backend/service.py`
- `backend/requirements.txt`

## Starten

1. Installeer Python dependencies:

```bash
cd losse-verwijzing-tool
python -m pip install -r backend/requirements.txt
```

2. Zorg dat `Tesseract OCR` lokaal is geinstalleerd als je OCR wilt gebruiken.

Optioneel:
- zet env var `TESSERACT_CMD` naar het pad van `tesseract.exe`

Voorbeeld Windows:

```powershell
$env:TESSERACT_CMD="C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
```

3. Start de backend:

```bash
cd losse-verwijzing-tool
python -m uvicorn backend.app:app --reload --port 8001
```

4. Start de frontend zoals nu al gebeurt, bijvoorbeeld met VS Code Live Server op:

```text
http://127.0.0.1:5500/losse-verwijzing-tool/index.html
```

De frontend verwacht standaard de backend op:

```text
http://127.0.0.1:8001
```

Voor AI-aanvulling via ApiFreeLLM:

- zet environment variable `APIFREELLM_API_KEY`
- lokaal in je shell of in je deployplatform
- op Vercel via `Project Settings > Environment Variables`

## API

- `GET /api/health`
- `GET /api/schema`
- `POST /api/process-referral`
- `POST /api/process-referral-text`

`POST /api/process-referral` verwacht `multipart/form-data` met veld:
- `file`

Response bevat:
- `raw_text`
- `output`
- `validation`
- `source_badge`
- `confidence_badge`

## Opmerking

De reviewflow en handmatige correctie blijven frontend-side. Alleen documentverwerking en initiële extractie/validatie draaien nu via Python.
