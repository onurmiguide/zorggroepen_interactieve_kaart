"""Audit logging voor alle write-acties."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..models import AuditLog, User

# Acties.
ACTION_CREATE = "create"
ACTION_UPDATE = "update"
ACTION_DELETE = "delete"
ACTION_LOGIN = "login"
ACTION_LOGOUT = "logout"

# Velden die nooit in een audit log mogen belanden.
SENSITIVE_KEYS = {"password", "password_hash", "wachtwoord"}


def _default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def to_snapshot(obj: Any) -> dict[str, Any]:
    """Maak een veilige dict-snapshot van een ORM-object, dict of None.

    Voor objecten met een 'locations'-relatie (zorggroepen) worden de plaatsen
    meegenomen, zodat ook die via een rollback hersteld kunnen worden.
    """
    if obj is None:
        return {}
    if isinstance(obj, dict):
        data = dict(obj)
    elif hasattr(obj, "__table__"):
        data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        locations = getattr(obj, "locations", None)
        if isinstance(locations, (list, tuple)):
            data["locations"] = [
                {
                    "city_name": getattr(loc, "city_name", ""),
                    "gemeente_name": getattr(loc, "gemeente_name", ""),
                    "notes": getattr(loc, "notes", ""),
                }
                for loc in locations
            ]
    else:
        data = {k: v for k, v in vars(obj).items() if not k.startswith("_")}
    return {k: v for k, v in data.items() if k not in SENSITIVE_KEYS}


def _dump(snapshot: dict[str, Any]) -> str:
    if not snapshot:
        return ""
    return json.dumps(snapshot, ensure_ascii=False, default=_default)


def record(
    db: Session,
    *,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: Any = "",
    old: Any = None,
    new: Any = None,
    commit: bool = True,
) -> AuditLog:
    """Schrijf een audit log-regel. Wachtwoorden worden eruit gefilterd."""
    log = AuditLog(
        actor_user_id=getattr(actor, "id", None),
        actor_email=getattr(actor, "email", "") or "",
        actor_name=getattr(actor, "name", "") or "",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else "",
        old_value_json=_dump(to_snapshot(old)),
        new_value_json=_dump(to_snapshot(new)),
    )
    db.add(log)
    if commit:
        db.commit()
    return log
