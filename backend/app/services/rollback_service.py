"""Rollback: zet een entiteit terug naar de waarde uit een audit-logregel."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ..models import (
    AuditLog,
    ContractRule,
    Facturatiestroom,
    LocationPostcodeOverride,
    PostcodeOverride,
    PostcodeRangeOverride,
    User,
    Zorggroep,
    ZorggroepLocation,
    Zorgverzekeraar,
)
from . import audit_service
from .import_seed import set_data_version

ENTITY_MODELS = {
    "zorggroep": Zorggroep,
    "zorgverzekeraar": Zorgverzekeraar,
    "facturatiestroom": Facturatiestroom,
    "contract_rule": ContractRule,
    "postcode_override": PostcodeOverride,
    "location_override": LocationPostcodeOverride,
    "range_override": PostcodeRangeOverride,
    "user": User,
}

# Kolommen die nooit hersteld worden.
SKIP_COLS = {"id", "created_at", "updated_at", "password_hash"}


def _apply(obj, data: dict) -> None:
    for col in obj.__table__.columns:
        if col.name in SKIP_COLS:
            continue
        if col.name in data:
            setattr(obj, col.name, data[col.name])


def _restore_locations(obj: Zorggroep, data: dict) -> None:
    """Zet de plaatsen (locations) van een zorggroep terug uit de snapshot."""
    if not isinstance(data.get("locations"), list):
        return
    obj.locations.clear()
    for loc in data["locations"]:
        if not isinstance(loc, dict):
            continue
        city = str(loc.get("city_name") or "").strip()
        if not city:
            continue
        obj.locations.append(
            ZorggroepLocation(
                city_name=city,
                gemeente_name=str(loc.get("gemeente_name") or "").strip(),
                notes=str(loc.get("notes") or "").strip(),
            )
        )


def can_rollback(log: AuditLog) -> bool:
    return log.entity_type in ENTITY_MODELS and log.action in ("create", "update", "delete")


def rollback(db: Session, *, actor, log: AuditLog) -> str:
    model = ENTITY_MODELS.get(log.entity_type)
    if model is None or not can_rollback(log):
        raise ValueError("Herstellen wordt niet ondersteund voor deze regel.")

    old = json.loads(log.old_value_json or "{}")
    new = json.loads(log.new_value_json or "{}")
    entity_id = int(log.entity_id) if str(log.entity_id).isdigit() else None

    if log.action == "create":
        # Een 'create' terugdraaien betekent: de aangemaakte record verwijderen.
        obj = db.get(model, entity_id) if entity_id is not None else None
        if obj is None:
            raise ValueError("Record bestaat niet meer; niets te herstellen.")
        db.delete(obj)
        summary = "Aanmaak teruggedraaid (record verwijderd)."
    else:  # update of delete
        if not old:
            raise ValueError("Geen eerdere waarde beschikbaar om naar te herstellen.")
        obj = db.get(model, entity_id) if entity_id is not None else None
        if obj is None:
            obj = model()
            _apply(obj, old)
            if log.entity_type == "zorggroep":
                _restore_locations(obj, old)
            db.add(obj)
            summary = "Record opnieuw aangemaakt vanuit de back-up (incl. plaatsen)." if log.entity_type == "zorggroep" else "Record opnieuw aangemaakt vanuit de back-up."
        else:
            _apply(obj, old)
            if log.entity_type == "zorggroep":
                db.flush()
                _restore_locations(obj, old)
            summary = "Record hersteld naar de vorige waarde."

    db.commit()
    audit_service.record(
        db,
        actor=actor,
        action="rollback",
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        old=new,
        new=old,
    )
    set_data_version(db)
    return summary
