from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ._shared import get_allowed_origins, service


app = FastAPI(title="Losse verwijzing upload", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/")
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
