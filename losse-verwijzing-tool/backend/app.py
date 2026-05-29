from __future__ import annotations

import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .service import build_output, call_glm_ocr, load_schema, process_upload


DEFAULT_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "https://zorgtool-miguide.vercel.app",
    "https://zorggroepen-interactieve-kaart.vercel.app",
]


def get_allowed_origins() -> list[str]:
    raw = os.getenv("REFERRAL_ALLOWED_ORIGINS", "").strip()
    if not raw:
        return DEFAULT_ALLOWED_ORIGINS
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


class ReferralTextRequest(BaseModel):
    raw_text: str
    filename: str = "verwijzing"
    source_type: str = "unknown"
    extraction_method: str = "browser_text"
    page_count: int = 1
    ocr_used: bool = False


class GlmOcrRequest(BaseModel):
    image: str
    prompt: str | None = None
    model: str = "zai-org/GLM-OCR"
    context: str = "referral-document"


app = FastAPI(title="Losse verwijzing backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/schema")
def schema() -> dict:
    return load_schema()


@app.post("/api/process-referral")
async def process_referral(file: UploadFile = File(...)) -> dict:
    try:
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Leeg bestand ontvangen.")
        return process_upload(payload, file.filename or "verwijzing", file.content_type)
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Verwerking mislukt: {error}") from error


@app.post("/api/process-referral-text")
def process_referral_text(payload: ReferralTextRequest) -> dict:
    try:
        if not str(payload.raw_text or "").strip():
            raise HTTPException(status_code=400, detail="Lege documenttekst ontvangen.")
        schema = load_schema()
        return build_output(
            schema=schema,
            filename=payload.filename or "verwijzing",
            source_type=payload.source_type or "unknown",
            extraction_method=payload.extraction_method or "browser_text",
            raw_text=payload.raw_text,
            page_count=payload.page_count or 1,
            ocr_used=bool(payload.ocr_used),
        )
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Verwerking mislukt: {error}") from error


@app.post("/api/glm-ocr")
def glm_ocr(payload: GlmOcrRequest) -> dict[str, str]:
    try:
        if not str(payload.image or "").strip():
            raise HTTPException(status_code=400, detail="Geen image data ontvangen.")
        return {"text": call_glm_ocr(payload.image, payload.prompt)}
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"GLM-OCR verwerking mislukt: {error}") from error
