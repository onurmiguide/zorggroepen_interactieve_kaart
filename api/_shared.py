from __future__ import annotations

import importlib.util
from pathlib import Path


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
