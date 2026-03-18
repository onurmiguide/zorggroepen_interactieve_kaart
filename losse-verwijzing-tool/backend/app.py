from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .service import build_output, load_schema, process_upload


class ReferralTextRequest(BaseModel):
    raw_text: str
    filename: str = "verwijzing"
    source_type: str = "unknown"
    extraction_method: str = "browser_text"
    page_count: int = 1
    ocr_used: bool = False


app = FastAPI(title="Losse verwijzing backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
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
