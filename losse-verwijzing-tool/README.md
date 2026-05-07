# Losse verwijzing verwerken

Deze tool verwerkt inkomende verwijzingen van huisartsen naar gestructureerde data.

Huidige opzet:
- frontend: `index.html`, `style.css`, `script.js`
- backend: Python `FastAPI` in `backend/`
- output: reviewformulier + JSON export
- OCR: PDF-tekst direct waar mogelijk, daarna GLM-OCR als configureerbare provider, daarna Tesseract fallback

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

## GLM-OCR

De frontend is voorbereid op het Hugging Face model:

```text
zai-org/GLM-OCR
```

Omdat dit model niet als losse browser-library draait, heeft de tool een eigen HTTP endpoint nodig. Dat kan bijvoorbeeld een Hugging Face Space, serverless proxy, of eigen backend zijn die `zai-org/GLM-OCR` aanroept.

Stel in `index.html` deze waarden in:

```html
<script>
  window.REFERRAL_OCR_PROVIDER = "glm-ocr";
  window.GLM_OCR_ENDPOINT = "https://jouw-site.vercel.app/api/glm-ocr";
</script>
```

De tool zet dit standaard al op `/api/glm-ocr` voor Vercel en op `http://127.0.0.1:8001/api/glm-ocr` voor lokaal gebruik.

Zet daarna in Vercel of lokaal een van deze environment variables:

```text
GLM_OCR_API_TOKEN=hf_...
```

Alternatieve namen die ook werken:

```text
HUGGINGFACE_API_TOKEN=hf_...
HF_TOKEN=hf_...
```

Let op: zet een echte Hugging Face token niet hardcoded in publieke frontend-code. De meegeleverde `/api/glm-ocr` proxy houdt de token server-side.

De proxy roept standaard `https://router.huggingface.co/v1/chat/completions` aan met `model: "zai-org/GLM-OCR"` en een `image_url` data URL.

Voor een eigen simpele OCR proxy stuurt de frontend per pagina/afbeelding JSON naar die endpoint:

```json
{
  "model": "zai-org/GLM-OCR",
  "image": "data:image/png;base64,...",
  "prompt": "Extract all readable text from this Dutch medical referral document. Return only plain text.",
  "context": "pdf-page-1"
}
```

De endpoint mag plain text teruggeven, of JSON met een van deze velden:

```json
{ "text": "gevonden tekst" }
```

Ook OpenAI-compatible responses met `choices[0].message.content` worden ondersteund.

Als `GLM_OCR_ENDPOINT` leeg is of faalt, gebruikt de tool automatisch Tesseract.js in de browser zodat lokale verwerking blijft werken.

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
