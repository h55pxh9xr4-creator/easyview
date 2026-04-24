import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from admin_models import AdminRole, AdminUser
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/roles", tags=["admin-roles"])


class RoleCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    permissions: list[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None


def _fmt(r: AdminRole) -> dict:
    return {
        "id": r.id, "name": r.name, "category": r.category,
        "description": r.description,
        "permissions": json.loads(r.permissions) if r.permissions else [],
        "created_at": str(r.created_at) if r.created_at else None,
    }


@router.get("")
async def get_roles(category: Optional[str] = None, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    query = db.query(AdminRole)
    if category:
        query = query.filter(AdminRole.category == category)
    roles = query.order_by(AdminRole.id).all()
    return {"roles": [_fmt(r) for r in roles], "total": len(roles)}


@router.post("", status_code=201)
async def create_role(data: RoleCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    role = AdminRole(name=data.name, category=data.category, description=data.description,
                     permissions=json.dumps(data.permissions, ensure_ascii=False))
    db.add(role)
    db.commit()
    db.refresh(role)
    return _fmt(role)


@router.put("/{role_id}")
async def update_role(role_id: int, data: RoleUpdate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    role = db.query(AdminRole).filter(AdminRole.id == role_id).first()
    if not role:
        raise HTTPException(404, "역할을 찾을 수 없습니다.")
    if data.name is not None: role.name = data.name
    if data.description is not None: role.description = data.description
    if data.permissions is not None: role.permissions = json.dumps(data.permissions, ensure_ascii=False)
    db.commit()
    db.refresh(role)
    return _fmt(role)


@router.delete("/{role_id}")
async def delete_role(role_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    role = db.query(AdminRole).filter(AdminRole.id == role_id).first()
    if not role:
        raise HTTPException(404, "역할을 찾을 수 없습니다.")
    db.delete(role)
    db.commit()
    return {"message": f"'{role.name}' 역할이 삭제되었습니다."}
