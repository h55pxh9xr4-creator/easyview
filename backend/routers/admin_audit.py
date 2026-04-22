from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from admin_models import AuditLog, AdminUser
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/audit-logs", tags=["admin-audit"])


@router.get("")
async def get_audit_logs(
    action_type: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    query = db.query(AuditLog)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    if actor:
        query = query.filter(AuditLog.actor == actor)
    if search:
        query = query.filter(
            AuditLog.detail.ilike(f"%{search}%") |
            AuditLog.actor.ilike(f"%{search}%") |
            AuditLog.target.ilike(f"%{search}%")
        )
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size).all()
    result = [{
        "id": log.id,
        "timestamp": str(log.timestamp) if log.timestamp else None,
        "actor": log.actor, "action_type": log.action_type,
        "detail": log.detail, "target": log.target,
        "ip_address": log.ip_address,
    } for log in logs]
    return {
        "logs": result, "total": total, "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/stats")
async def get_audit_stats(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    action_rows = db.query(AuditLog.action_type, func.count(AuditLog.id)).group_by(AuditLog.action_type).all()
    action_type_stats = [{"action_type": r[0], "count": r[1]} for r in sorted(action_rows, key=lambda x: -x[1])]

    actor_rows = db.query(AuditLog.actor, func.count(AuditLog.id)).group_by(AuditLog.actor).all()
    actor_stats = [{"actor": r[0], "count": r[1]} for r in sorted(actor_rows, key=lambda x: -x[1])]

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_rows = (
        db.query(cast(AuditLog.timestamp, Date), func.count(AuditLog.id))
        .filter(AuditLog.timestamp >= seven_days_ago)
        .group_by(cast(AuditLog.timestamp, Date))
        .order_by(cast(AuditLog.timestamp, Date))
        .all()
    )
    daily_stats = [{"date": str(r[0]), "count": r[1]} for r in daily_rows]
    total = db.query(func.count(AuditLog.id)).scalar()

    return {
        "action_type_stats": action_type_stats,
        "actor_stats": actor_stats,
        "daily_stats": daily_stats,
        "total_logs": total,
    }
