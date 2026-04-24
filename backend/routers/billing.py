"""청구 관리 (Billing) API.

- GET /api/billing/entries?status=&parent=&q=
- GET /api/billing/entries/{id}
- PATCH /api/billing/entries/{id}
- POST /api/billing/entries/{id}/complete
- POST /api/billing/entries/{id}/deposit
- GET /api/billing/master
- GET /api/billing/exceptions
- GET /api/billing/stats
- POST /api/billing/import  (로컬 엑셀 기반 재import 트리거)
"""
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from database import get_db
from billing_models import BillingEntry, BillingMaster, BillingException

router = APIRouter()


class EntryPatch(BaseModel):
    status: Optional[str] = None
    billing_date: Optional[date] = None
    invoice_date: Optional[date] = None
    deposit_date: Optional[date] = None
    memo: Optional[str] = None
    amount: Optional[float] = None
    is_completed: Optional[bool] = None


def _entry_dict(e: BillingEntry) -> dict:
    return {
        "id": e.id,
        "parent": e.parent,
        "subsidiary": e.subsidiary,
        "mgmt_no": e.mgmt_no,
        "assignee": e.assignee,
        "report_ym": e.report_ym,
        "delivery_ym": e.delivery_ym,
        "billing_date": e.billing_date.isoformat() if e.billing_date else None,
        "invoice_date": e.invoice_date.isoformat() if e.invoice_date else None,
        "status": e.status,
        "deposit_date": e.deposit_date.isoformat() if e.deposit_date else None,
        "memo": e.memo,
        "amount": e.amount,
        "invoice_request_day": e.invoice_request_day,
        "invoice_manager": e.invoice_manager,
        "manager_email": e.manager_email,
        "manager_phone": e.manager_phone,
        "is_completed": bool(e.is_completed),
        "transfer_at": e.transfer_at.isoformat() if e.transfer_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/entries")
def list_entries(
    status: Optional[str] = None,   # pending | completed | all (기본 all)
    parent: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(BillingEntry)
    if status == "pending":
        query = query.filter(BillingEntry.is_completed == False)
    elif status == "completed":
        query = query.filter(BillingEntry.is_completed == True)
    if parent:
        query = query.filter(BillingEntry.parent == parent)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            BillingEntry.parent.ilike(like),
            BillingEntry.subsidiary.ilike(like),
            BillingEntry.mgmt_no.ilike(like),
            BillingEntry.assignee.ilike(like),
            BillingEntry.invoice_manager.ilike(like),
        ))
    rows = query.order_by(BillingEntry.invoice_date.asc().nulls_last(), BillingEntry.id.desc()).limit(2000).all()
    return {"count": len(rows), "entries": [_entry_dict(r) for r in rows]}


@router.get("/entries/{entry_id}")
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    row = db.query(BillingEntry).filter(BillingEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    # 특이사항 동반 반환
    exceptions = []
    if row.parent:
        exs = db.query(BillingException).filter(BillingException.parent == row.parent).all()
        exceptions = [{"category": e.category, "note": e.note} for e in exs]
    return {**_entry_dict(row), "exceptions": exceptions}


@router.patch("/entries/{entry_id}")
def update_entry(entry_id: int, body: EntryPatch, db: Session = Depends(get_db)):
    row = db.query(BillingEntry).filter(BillingEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    if "is_completed" in data and data["is_completed"]:
        row.status = row.status or "완료"
        if row.transfer_at is None:
            row.transfer_at = date.today()
    db.commit()
    return _entry_dict(row)


@router.post("/entries/{entry_id}/complete")
def mark_complete(entry_id: int, db: Session = Depends(get_db)):
    row = db.query(BillingEntry).filter(BillingEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    row.is_completed = True
    row.status = "완료"
    if row.transfer_at is None:
        row.transfer_at = date.today()
    db.commit()
    return _entry_dict(row)


@router.post("/entries/{entry_id}/deposit")
def mark_deposit(entry_id: int, deposit_date_iso: Optional[str] = None, db: Session = Depends(get_db)):
    row = db.query(BillingEntry).filter(BillingEntry.id == entry_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Billing entry not found")
    d = None
    if deposit_date_iso:
        try:
            d = datetime.strptime(deposit_date_iso, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="deposit_date must be YYYY-MM-DD")
    row.deposit_date = d or date.today()
    db.commit()
    return _entry_dict(row)


@router.get("/master")
def list_master(db: Session = Depends(get_db)):
    rows = db.query(BillingMaster).order_by(BillingMaster.parent.asc().nulls_last()).all()
    return {
        "count": len(rows),
        "master": [
            {
                "id": m.id, "mgmt_no": m.mgmt_no, "company": m.company,
                "parent": m.parent, "amount": m.amount,
                "invoice_request_day": m.invoice_request_day,
                "invoice_manager": m.invoice_manager,
                "manager_email": m.manager_email,
                "manager_phone": m.manager_phone,
            }
            for m in rows
        ],
    }


@router.get("/exceptions")
def list_exceptions(db: Session = Depends(get_db)):
    rows = db.query(BillingException).order_by(BillingException.no.asc().nulls_last()).all()
    return {
        "count": len(rows),
        "exceptions": [
            {"id": e.id, "no": e.no, "category": e.category, "parent": e.parent, "note": e.note}
            for e in rows
        ],
    }


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total_pending = db.query(BillingEntry).filter(BillingEntry.is_completed == False).count()
    total_completed = db.query(BillingEntry).filter(BillingEntry.is_completed == True).count()
    # 이번 달 세금계산서 발행 예정
    today = date.today()
    first = today.replace(day=1)
    next_first = (first.replace(month=first.month + 1) if first.month < 12 else first.replace(year=first.year + 1, month=1))
    month_invoice = db.query(BillingEntry).filter(
        BillingEntry.is_completed == False,
        BillingEntry.invoice_date >= first,
        BillingEntry.invoice_date < next_first,
    ).count()
    # 총 대기 계약 금액
    total_amount = (
        db.query(BillingEntry.amount)
        .filter(BillingEntry.is_completed == False, BillingEntry.amount.isnot(None))
        .all()
    )
    pending_amount = sum(r[0] for r in total_amount if r[0] is not None)
    # 미입금 (완료됐지만 deposit 없음)
    unpaid = db.query(BillingEntry).filter(
        BillingEntry.is_completed == True,
        BillingEntry.deposit_date.is_(None),
    ).count()
    return {
        "pending": total_pending,
        "completed": total_completed,
        "month_invoice": month_invoice,
        "pending_amount": pending_amount,
        "unpaid": unpaid,
    }


@router.post("/import")
def import_from_xlsm():
    """로컬 Asset/Easy View 빌링현황.xlsm 재읽기 (관리자 편의용)."""
    try:
        from import_billing import import_billing
        result = import_billing()
        if not result:
            raise HTTPException(status_code=404, detail="엑셀 파일이 Asset/ 폴더에 없습니다.")
        return {"ok": True, **result}
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"import_billing 모듈 로드 실패: {e}")
