from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ._shared import service


class GlmOcrRequest(BaseModel):
    image: str
    prompt: str | None = None
    model: str = "zai-org/GLM-OCR"
    context: str = "referral-document"


app = FastAPI(title="Losse verwijzing GLM-OCR", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/")
def glm_ocr(payload: GlmOcrRequest) -> dict[str, str]:
    try:
        if not str(payload.image or "").strip():
            raise HTTPException(status_code=400, detail="Geen image data ontvangen.")
        return {"text": service.call_glm_ocr(payload.image, payload.prompt)}
    except HTTPException:
        raise
    except RuntimeError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"GLM-OCR verwerking mislukt: {error}") from error
