"""Serialisatiehelpers die ORM-objecten omzetten naar response-dicts."""
from __future__ import annotations

import json

from ..models import ContractRule, Zorgverzekeraar


def parse_aliases(raw: str) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            return [str(v) for v in value]
    except (ValueError, TypeError):
        pass
    return []


def zorgverzekeraar_out(zv: Zorgverzekeraar) -> dict:
    return {
        "id": zv.id,
        "name": zv.name,
        "concern_key": zv.concern_key,
        "aliases": parse_aliases(zv.aliases),
        "is_active": zv.is_active,
        "created_at": zv.created_at,
        "updated_at": zv.updated_at,
    }


def contract_rule_out(rule: ContractRule) -> dict:
    return {
        "id": rule.id,
        "zorggroep_id": rule.zorggroep_id,
        "zorgverzekeraar_id": rule.zorgverzekeraar_id,
        "facturatiestroom_id": rule.facturatiestroom_id,
        "contract_status": rule.contract_status,
        "notes": rule.notes,
        "valid_from": rule.valid_from,
        "valid_to": rule.valid_to,
        "is_active": rule.is_active,
        "zorggroep_name": rule.zorggroep.name if rule.zorggroep else None,
        "zorgverzekeraar_name": rule.zorgverzekeraar.name if rule.zorgverzekeraar else None,
        "facturatiestroom_label": rule.facturatiestroom.label if rule.facturatiestroom else None,
        "created_at": rule.created_at,
        "updated_at": rule.updated_at,
    }
