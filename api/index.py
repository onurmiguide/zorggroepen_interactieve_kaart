from __future__ import annotations

import importlib.util
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


ROOT_DIR = Path(__file__).resolve().parent.parent
SERVICE_PATH = ROOT_DIR / "losse-verwijzing-tool" / "backend" / "service.py"


def load_service_module():
    spec = importlib.util.spec_from_file_location("losse_verwijzing_service", SERVICE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Kan service module niet laden vanaf {SERVICE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


service = load_service_module()


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
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/schema")
def schema() -> dict:
    return service.load_schema()


@app.post("/process-referral")
async def process_referral(file: UploadFile = File(...)) -> dict:
    try:
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Leeg bestand ontvangen.")
        return service.process_upload(payload, file.filename or "verwijzing", file.content_type)
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Verwerking mislukt: {error}") from error


@app.post("/process-referral-text")
def process_referral_text(payload: ReferralTextRequest) -> dict:
    try:
        if not str(payload.raw_text or "").strip():
            raise HTTPException(status_code=400, detail="Lege documenttekst ontvangen.")
        schema = service.load_schema()
        return service.build_output(
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
