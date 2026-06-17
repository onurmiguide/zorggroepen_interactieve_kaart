"""Publiceer-endpoint: schrijft de database naar de zg-data JSON-bestanden en
(optioneel) commit + push naar GitHub. Vereist rol admin of hoger."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import require_admin
from ..services import audit_service, publish_service

router = APIRouter(prefix="/api/admin/publish", tags=["admin:publish"])


@router.get("/preview")
def preview(db: Session = Depends(get_db), user: User = Depends(require_admin)) -> dict:
    """Toon hoe de JSON eruit zou zien, zonder te schrijven of te pushen."""
    return {
        "zorggroepen": publish_service.build_zorggroepen_json(db),
        "postcode_overrides": publish_service.build_postcode_overrides_json(db),
    }


@router.post("")
def do_publish(
    push: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
) -> dict:
    result = publish_service.publish(db, actor=user, do_push=push)
    audit_service.record(
        db,
        actor=user,
        action="publish",
        entity_type="publish",
        entity_id=result.get("backup", ""),
        new={"pushed": result.get("pushed"), "branch": result.get("branch"), "ok": result.get("ok")},
    )
    return result
