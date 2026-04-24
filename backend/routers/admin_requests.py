from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from database import get_db
from admin_models import UserAddRequest, AdminUser, AuditLog
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/user-requests", tags=["admin-requests"])


class RequestCreate(BaseModel):
    target_name: str
    target_email: str
    reason: Optional[str] = None


def _fmt(r: UserAddRequest, requester_name: str, reviewer_name: Optional[str]) -> dict:
    return {
        "id": r.id, "requester_id": r.requester_id, "requester_name": requester_name,
        "target_name": r.target_name, "target_email": r.target_email,
        "reason": r.reason, "status": r.status,
        "reviewer_id": r.reviewer_id, "reviewer_name": reviewer_name,
        "created_at": str(r.created_at) if r.created_at else None,
    }


@router.get("")
async def get_requests(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_admin),
):
    query = db.query(UserAddRequest)
    if status:
        query = query.filter(UserAddRequest.status == status)
    if search:
        query = query.filter(or_(
            UserAddRequest.target_name.ilike(f"%{search}%"),
            UserAddRequest.target_email.ilike(f"%{search}%"),
        ))
    reqs = query.order_by(UserAddRequest.id.desc()).all()
    result = []
    for r in reqs:
        requester = db.query(AdminUser).filter(AdminUser.id == r.requester_id).first()
        reviewer = db.query(AdminUser).filter(AdminUser.id == r.reviewer_id).first() if r.reviewer_id else None
        result.append(_fmt(r, requester.name if requester else "알 수 없음", reviewer.name if reviewer else None))
    return {"requests": result, "total": len(result)}


@router.post("", status_code=201)
async def create_request(data: RequestCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    req = UserAddRequest(requester_id=current_user.id, target_name=data.target_name,
                         target_email=data.target_email, reason=data.reason)
    db.add(req)
    db.add(AuditLog(actor=current_user.name, action_type="사용자 추가 요청",
                    detail=f"{data.target_name} ({data.target_email}) 사용자 추가 요청", target=data.target_name))
    db.commit()
    db.refresh(req)
    return _fmt(req, current_user.name, None)


@router.put("/{request_id}/approve")
async def approve_request(request_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    req = db.query(UserAddRequest).filter(UserAddRequest.id == request_id).first()
    if not req: raise HTTPException(404, "요청을 찾을 수 없습니다.")
    if req.status != "pending": raise HTTPException(400, "대기 중인 요청만 승인할 수 있습니다.")
    req.status = "approved"
    req.reviewer_id = current_user.id
    db.add(AuditLog(actor=current_user.name, action_type="요청 승인",
                    detail=f"{req.target_name} 사용자 추가 요청 승인", target=req.target_name))
    db.commit()
    return {"message": f"'{req.target_name}' 사용자 추가 요청이 승인되었습니다."}


@router.put("/{request_id}/reject")
async def reject_request(request_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    req = db.query(UserAddRequest).filter(UserAddRequest.id == request_id).first()
    if not req: raise HTTPException(404, "요청을 찾을 수 없습니다.")
    if req.status != "pending": raise HTTPException(400, "대기 중인 요청만 반려할 수 있습니다.")
    req.status = "rejected"
    req.reviewer_id = current_user.id
    db.add(AuditLog(actor=current_user.name, action_type="요청 반려",
                    detail=f"{req.target_name} 사용자 추가 요청 반려", target=req.target_name))
    db.commit()
    return {"message": f"'{req.target_name}' 사용자 추가 요청이 반려되었습니다."}
