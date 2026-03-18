from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ._shared import service


class ReferralTextRequest(BaseModel):
    raw_text: str
    filename: str = "verwijzing"
    source_type: str = "unknown"
    extraction_method: str = "browser_text"
    page_count: int = 1
    ocr_used: bool = False


app = FastAPI(title="Losse verwijzing tekstverwerking", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/")
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
