from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from admin_models import AdminUser, AuditLog, UserPermission
from admin_auth import hash_password, get_current_admin
from email_service import send_welcome_email, send_permission_change_email

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class UserCreate(BaseModel):
    email: str
    name: str
    company: str
    group_id: Optional[int] = None
    role: str = "viewer"
    password: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
    group_id: Optional[int] = None
    role: Optional[str] = None
    status: Optional[str] = None
    trust_level: Optional[str] = None
    two_fa: Optional[bool] = None


def _fmt(u: AdminUser) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "company": u.company,
            "group_id": u.group_id, "role": u.role, "status": u.status,
            "trust_level": u.trust_level, "two_fa": u.two_fa,
            "password_expiry": str(u.password_expiry) if u.password_expiry else None,
            "last_login": str(u.last_login) if u.last_login else None,
            "created_at": str(u.created_at) if u.created_at else None}


@router.get("")
async def list_users(search: Optional[str] = None, company: Optional[str] = None,
                     role: Optional[str] = None, status: Optional[str] = None,
                     db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    q = db.query(AdminUser)
    if search:
        q = q.filter(or_(AdminUser.name.ilike(f"%{search}%"), AdminUser.email.ilike(f"%{search}%")))
    if company: q = q.filter(AdminUser.company == company)
    if role:    q = q.filter(AdminUser.role == role)
    if status:  q = q.filter(AdminUser.status == status)
    users = q.order_by(AdminUser.id).all()
    return {"users": [_fmt(u) for u in users], "total": len(users)}


@router.post("", status_code=201)
async def create_user(data: UserCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    if db.query(AdminUser).filter(AdminUser.email == data.email).first():
        raise HTTPException(400, "이미 등록된 이메일입니다.")
    user = AdminUser(email=data.email, name=data.name, company=data.company, group_id=data.group_id,
                     role=data.role, status="active",
                     hashed_password=hash_password(data.password) if data.password else None,
                     password_expiry=datetime.utcnow() + timedelta(days=365))
    db.add(user)
    db.add(AuditLog(actor=current_user.name, action_type="사용자 생성",
                    detail=f"{data.name} ({data.email}) 사용자 생성", target=data.name))
    db.commit()
    db.refresh(user)
    db.add(UserPermission(user_id=user.id))
    db.commit()
    send_welcome_email(data.email, data.name, data.password or "temp1234!")
    return _fmt(user)


@router.get("/{user_id}")
async def get_user(user_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    u = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not u: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    return _fmt(u)


@router.put("/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    u = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not u: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    old_role, old_status = u.role, u.status
    update = data.model_dump(exclude_unset=True)
    new_role = update.get("role", u.role)
    email = update.get("email", u.email)
    if new_role in ("admin", "manager") and not email.endswith("@pwc.com"):
        raise HTTPException(400, "PwC 역할은 @pwc.com 도메인 계정만 설정 가능합니다.")
    for k, v in update.items(): setattr(u, k, v)
    db.add(AuditLog(actor=current_user.name, action_type="사용자 수정",
                    detail=f"{u.name} 사용자 정보 수정", target=u.name))
    db.commit(); db.refresh(u)
    changes = []
    if old_role != u.role:   changes.append(f"역할: {old_role} → {u.role}")
    if old_status != u.status: changes.append(f"상태: {old_status} → {u.status}")
    if changes: send_permission_change_email(u.email, u.name, ", ".join(changes))
    return _fmt(u)


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    u = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not u: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    name = u.name
    db.delete(u)
    db.add(AuditLog(actor=current_user.name, action_type="사용자 삭제", detail=f"{name} 사용자 삭제", target=name))
    db.commit()
    return {"message": f"'{name}'이(가) 삭제되었습니다."}


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    u = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not u: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    u.hashed_password = hash_password("temp1234!")
    u.password_expiry = datetime.utcnow() + timedelta(days=1)
    db.add(AuditLog(actor=current_user.name, action_type="비밀번호 초기화",
                    detail=f"{u.name} 비밀번호 초기화", target=u.name))
    db.commit()
    return {"message": f"'{u.name}' 비밀번호가 초기화되었습니다."}


@router.post("/{user_id}/toggle-status")
async def toggle_status(user_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    u = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not u: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    msg = "비활성화" if u.status == "active" else "활성화"
    u.status = "inactive" if u.status == "active" else "active"
    db.add(AuditLog(actor=current_user.name, action_type=f"사용자 {msg}",
                    detail=f"{u.name} {msg} 처리", target=u.name))
    db.commit()
    return {"message": f"'{u.name}'이(가) {msg}되었습니다.", "status": u.status}
