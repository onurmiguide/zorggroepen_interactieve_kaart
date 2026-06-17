"""Admin CRUD voor contractregels (matrix zorggroep x verzekeraar x stroom)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ContractRule, Facturatiestroom, User, Zorggroep, Zorgverzekeraar
from ..schemas import ContractRuleCreate, ContractRuleOut, ContractRuleUpdate
from ..security import require_editor
from ..services import audit_service
from ..services.import_seed import set_data_version
from ._helpers import contract_rule_out

router = APIRouter(prefix="/api/admin/contract-rules", tags=["admin:contracten"])

ENTITY = "contract_rule"


def _get_or_404(db: Session, rule_id: int) -> ContractRule:
    rule = db.get(ContractRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Contractregel niet gevonden.")
    return rule


def _validate_fks(db: Session, zorggroep_id: int, zv_id: int | None, fs_id: int | None) -> None:
    if db.get(Zorggroep, zorggroep_id) is None:
        raise HTTPException(status_code=422, detail="Onbekende zorggroep.")
    if zv_id is not None and db.get(Zorgverzekeraar, zv_id) is None:
        raise HTTPException(status_code=422, detail="Onbekende zorgverzekeraar.")
    if fs_id is not None and db.get(Facturatiestroom, fs_id) is None:
        raise HTTPException(status_code=422, detail="Onbekende facturatiestroom.")


def _check_duplicate(db: Session, zorggroep_id: int, zv_id: int | None, fs_id: int | None, exclude_id: int | None = None) -> None:
    query = select(ContractRule).where(
        ContractRule.zorggroep_id == zorggroep_id,
        ContractRule.zorgverzekeraar_id.is_(zv_id) if zv_id is None else ContractRule.zorgverzekeraar_id == zv_id,
        ContractRule.facturatiestroom_id.is_(fs_id) if fs_id is None else ContractRule.facturatiestroom_id == fs_id,
    )
    if exclude_id is not None:
        query = query.where(ContractRule.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=409, detail="Deze combinatie bestaat al als contractregel.")


@router.get("", response_model=list[ContractRuleOut])
def list_rules(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> list[dict]:
    rows = db.scalars(select(ContractRule).order_by(ContractRule.id)).all()
    return [contract_rule_out(r) for r in rows]


@router.post("", response_model=ContractRuleOut, status_code=201)
def create_rule(payload: ContractRuleCreate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    _validate_fks(db, payload.zorggroep_id, payload.zorgverzekeraar_id, payload.facturatiestroom_id)
    _check_duplicate(db, payload.zorggroep_id, payload.zorgverzekeraar_id, payload.facturatiestroom_id)
    rule = ContractRule(
        zorggroep_id=payload.zorggroep_id,
        zorgverzekeraar_id=payload.zorgverzekeraar_id,
        facturatiestroom_id=payload.facturatiestroom_id,
        contract_status=payload.contract_status.strip() or "gecontracteerd",
        notes=payload.notes.strip(),
        valid_from=payload.valid_from.strip(),
        valid_to=payload.valid_to.strip(),
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    audit_service.record(db, actor=user, action=audit_service.ACTION_CREATE, entity_type=ENTITY, entity_id=rule.id, new=rule)
    set_data_version(db)
    return contract_rule_out(rule)


@router.put("/{rule_id}", response_model=ContractRuleOut)
def update_rule(rule_id: int, payload: ContractRuleUpdate, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    rule = _get_or_404(db, rule_id)
    before = audit_service.to_snapshot(rule)

    new_zg = payload.zorggroep_id if payload.zorggroep_id is not None else rule.zorggroep_id
    new_zv = payload.zorgverzekeraar_id if payload.zorgverzekeraar_id is not None else rule.zorgverzekeraar_id
    new_fs = payload.facturatiestroom_id if payload.facturatiestroom_id is not None else rule.facturatiestroom_id
    _validate_fks(db, new_zg, new_zv, new_fs)
    _check_duplicate(db, new_zg, new_zv, new_fs, exclude_id=rule.id)

    rule.zorggroep_id = new_zg
    rule.zorgverzekeraar_id = new_zv
    rule.facturatiestroom_id = new_fs
    if payload.contract_status is not None:
        rule.contract_status = payload.contract_status.strip() or "gecontracteerd"
    if payload.notes is not None:
        rule.notes = payload.notes.strip()
    if payload.valid_from is not None:
        rule.valid_from = payload.valid_from.strip()
    if payload.valid_to is not None:
        rule.valid_to = payload.valid_to.strip()
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    db.commit()
    db.refresh(rule)
    audit_service.record(db, actor=user, action=audit_service.ACTION_UPDATE, entity_type=ENTITY, entity_id=rule.id, old=before, new=rule)
    set_data_version(db)
    return contract_rule_out(rule)


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, hard: bool = True, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    rule = _get_or_404(db, rule_id)
    before = audit_service.to_snapshot(rule)
    if hard:
        db.delete(rule)
        db.commit()
        audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=rule_id, old=before)
        set_data_version(db)
        return {"detail": "Contractregel verwijderd."}
    rule.is_active = False
    db.commit()
    audit_service.record(db, actor=user, action=audit_service.ACTION_DELETE, entity_type=ENTITY, entity_id=rule.id, old=before, new=rule)
    set_data_version(db)
    return {"detail": "Contractregel gedeactiveerd."}
