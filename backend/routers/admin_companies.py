from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from admin_models import AdminCompany, AdminSubsidiary, AdminUser
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/companies", tags=["admin-companies"])


class CompanyCreate(BaseModel):
    name: str


class SubsidiaryCreate(BaseModel):
    name: str
    company_id: int


@router.get("")
async def get_companies(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    companies = db.query(AdminCompany).order_by(AdminCompany.id).all()
    result = []
    for c in companies:
        subs = db.query(AdminSubsidiary).filter(AdminSubsidiary.company_id == c.id).all()
        result.append({
            "id": c.id, "name": c.name,
            "subsidiaries": [{"id": s.id, "name": s.name} for s in subs],
            "created_at": str(c.created_at) if c.created_at else None,
        })
    return {"companies": result, "total": len(result)}


@router.post("", status_code=201)
async def create_company(data: CompanyCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    if db.query(AdminCompany).filter(AdminCompany.name == data.name).first():
        raise HTTPException(400, "이미 등록된 회사입니다.")
    company = AdminCompany(name=data.name)
    db.add(company)
    db.commit()
    db.refresh(company)
    return {"id": company.id, "name": company.name, "subsidiaries": []}


@router.post("/subsidiaries", status_code=201)
async def create_subsidiary(data: SubsidiaryCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    company = db.query(AdminCompany).filter(AdminCompany.id == data.company_id).first()
    if not company:
        raise HTTPException(404, "회사를 찾을 수 없습니다.")
    sub = AdminSubsidiary(name=data.name, company_id=data.company_id)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "name": sub.name, "company_id": sub.company_id, "company_name": company.name}


@router.get("/names")
async def get_company_names(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    user_companies = db.query(AdminUser.company).distinct().order_by(AdminUser.company).all()
    reg_companies = db.query(AdminCompany.name).order_by(AdminCompany.name).all()
    all_names = sorted(set([c[0] for c in user_companies] + [c[0] for c in reg_companies]))
    return {"names": all_names}
