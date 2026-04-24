from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
from admin_models import AdminUser, AuditLog
from admin_auth import verify_password, create_access_token, get_current_admin

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == req.email).first()
    if not user or not user.hashed_password or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    user.last_login = datetime.utcnow()
    db.add(AuditLog(actor=user.name, action_type="로그인", detail=f"{user.role} 로그인 성공", target="-", ip_address="0.0.0.0"))
    db.commit()
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    return {
        "access_token": token, "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name, "company": user.company,
                 "role": user.role, "group_id": user.group_id, "status": user.status,
                 "trust_level": user.trust_level, "two_fa": user.two_fa},
    }


@router.post("/logout")
async def logout():
    return {"message": "로그아웃되었습니다."}


@router.get("/me")
async def me(current_user: AdminUser = Depends(get_current_admin)):
    return {"id": current_user.id, "email": current_user.email, "name": current_user.name,
            "company": current_user.company, "role": current_user.role, "group_id": current_user.group_id,
            "status": current_user.status, "trust_level": current_user.trust_level, "two_fa": current_user.two_fa}
