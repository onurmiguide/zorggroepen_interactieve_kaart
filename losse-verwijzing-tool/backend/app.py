from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .service import load_schema, process_upload


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

