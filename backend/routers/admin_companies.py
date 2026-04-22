from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from database import get_db
from admin_models import AdminCompany, AdminSubsidiary, AdminUser
from admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/companies", tags=["admin-companies"])


class CompanyCreate(BaseModel):
    name: str
    subsidiary_name: Optional[str] = None
    biz_start: Optional[date] = None
    biz_end: Optional[date] = None
    country: Optional[str] = None
    company_type: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    base_currency: Optional[str] = None
    base_period: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    subsidiary_name: Optional[str] = None
    biz_start: Optional[date] = None
    biz_end: Optional[date] = None
    country: Optional[str] = None
    company_type: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    base_currency: Optional[str] = None
    base_period: Optional[str] = None


class SubsidiaryCreate(BaseModel):
    name: str
    company_id: int


def company_to_dict(c: AdminCompany, subs: list) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "subsidiary_name": c.subsidiary_name,
        "biz_start": str(c.biz_start) if c.biz_start else None,
        "biz_end": str(c.biz_end) if c.biz_end else None,
        "country": c.country,
        "company_type": c.company_type,
        "contract_start": str(c.contract_start) if c.contract_start else None,
        "contract_end": str(c.contract_end) if c.contract_end else None,
        "base_currency": c.base_currency,
        "base_period": c.base_period,
        "subsidiaries": [{"id": s.id, "name": s.name} for s in subs],
        "created_at": str(c.created_at) if c.created_at else None,
    }


@router.get("/names")
async def get_company_names(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    user_companies = db.query(AdminUser.company).distinct().order_by(AdminUser.company).all()
    reg_companies = db.query(AdminCompany.name).order_by(AdminCompany.name).all()
    all_names = sorted(set([c[0] for c in user_companies] + [c[0] for c in reg_companies]))
    return {"names": all_names}


@router.get("")
async def get_companies(db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    companies = db.query(AdminCompany).order_by(AdminCompany.id).all()
    result = []
    for c in companies:
        subs = db.query(AdminSubsidiary).filter(AdminSubsidiary.company_id == c.id).all()
        result.append(company_to_dict(c, subs))
    return {"companies": result, "total": len(result)}


@router.get("/{company_id}")
async def get_company(company_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    c = db.query(AdminCompany).filter(AdminCompany.id == company_id).first()
    if not c:
        raise HTTPException(404, "회사를 찾을 수 없습니다.")
    subs = db.query(AdminSubsidiary).filter(AdminSubsidiary.company_id == c.id).all()
    return company_to_dict(c, subs)


@router.post("", status_code=201)
async def create_company(data: CompanyCreate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    if db.query(AdminCompany).filter(AdminCompany.name == data.name).first():
        raise HTTPException(400, "이미 등록된 회사입니다.")
    company = AdminCompany(**data.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company_to_dict(company, [])


@router.put("/{company_id}")
async def update_company(company_id: int, data: CompanyUpdate, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    c = db.query(AdminCompany).filter(AdminCompany.id == company_id).first()
    if not c:
        raise HTTPException(404, "회사를 찾을 수 없습니다.")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    subs = db.query(AdminSubsidiary).filter(AdminSubsidiary.company_id == c.id).all()
    return company_to_dict(c, subs)


@router.delete("/{company_id}")
async def delete_company(company_id: int, db: Session = Depends(get_db), current_user: AdminUser = Depends(get_current_admin)):
    c = db.query(AdminCompany).filter(AdminCompany.id == company_id).first()
    if not c:
        raise HTTPException(404, "회사를 찾을 수 없습니다.")
    db.query(AdminSubsidiary).filter(AdminSubsidiary.company_id == company_id).delete()
    db.delete(c)
    db.commit()
    return {"message": "삭제 완료"}


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
