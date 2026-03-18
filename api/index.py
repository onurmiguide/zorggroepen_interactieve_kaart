from __future__ import annotations

import importlib.util
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


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
