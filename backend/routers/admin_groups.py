from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from database import get_db
from admin_models import AdminGroup, AdminUser, AuditLog
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/groups", tags=["admin-groups"])


class GroupCreate(BaseModel):
    name: str
    company: str
    default_role: str = "viewer"


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    default_role: Optional[str] = None


def _fmt(g: AdminGroup, member_count: int) -> dict:
    return {
        "id": g.id, "name": g.name, "company": g.company,
        "default_role": g.default_role, "report_count": g.report_count,
        "member_count": member_count,
        "created_at": str(g.created_at) if g.created_at else None,
    }


@router.get("")
async def get_groups(company: Optional[str] = None, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    query = db.query(AdminGroup)
    if company:
        query = query.filter(AdminGroup.company == company)
    groups = query.order_by(AdminGroup.id).all()
    result = []
    for g in groups:
        mc = db.query(func.count(AdminUser.id)).filter(AdminUser.group_id == g.id).scalar()
        result.append(_fmt(g, mc))
    return {"groups": result, "total": len(result)}


@router.post("", status_code=201)
async def create_group(data: GroupCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    g = AdminGroup(name=data.name, company=data.company, default_role=data.default_role)
    db.add(g)
    db.add(AuditLog(actor=current_user.name, action_type="그룹 생성", detail=f"{data.name} 그룹 생성", target=data.name))
    db.commit()
    db.refresh(g)
    return _fmt(g, 0)


@router.put("/{group_id}")
async def update_group(group_id: int, data: GroupUpdate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    g = db.query(AdminGroup).filter(AdminGroup.id == group_id).first()
    if not g:
        raise HTTPException(404, "그룹을 찾을 수 없습니다.")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    mc = db.query(func.count(AdminUser.id)).filter(AdminUser.group_id == g.id).scalar()
    return _fmt(g, mc)
