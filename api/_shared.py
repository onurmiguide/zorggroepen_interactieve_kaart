from __future__ import annotations

import importlib.util
import os
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
SERVICE_PATH = ROOT_DIR / "losse-verwijzing-tool" / "backend" / "service.py"
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


def load_service_module():
    spec = importlib.util.spec_from_file_location("losse_verwijzing_service", SERVICE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Kan service module niet laden vanaf {SERVICE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


service = load_service_module()
