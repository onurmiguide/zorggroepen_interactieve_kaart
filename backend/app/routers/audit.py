"""Audit/history endpoints voor de History-tab."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuditLog, User
from ..schemas import AuditLogOut
from ..security import require_editor
from ..services import rollback_service

router = APIRouter(prefix="/api/admin/audit-logs", tags=["admin:audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_editor),
    entity_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    actor_email: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[AuditLog]:
    query = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)
    if actor_email:
        query = query.where(AuditLog.actor_email.ilike(f"%{actor_email}%"))
    query = query.offset(offset).limit(limit)
    return list(db.scalars(query).all())


@router.post("/{log_id}/rollback")
def rollback_log(log_id: int, db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    log = db.get(AuditLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Logregel niet gevonden.")
    if not rollback_service.can_rollback(log):
        raise HTTPException(status_code=400, detail="Deze actie kan niet hersteld worden.")
    try:
        summary = rollback_service.rollback(db, actor=user, log=log)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"detail": summary}
