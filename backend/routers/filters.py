from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db

router = APIRouter()


@router.get("/months")
def get_months(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT DISTINCT year_month FROM je ORDER BY year_month DESC")
    ).fetchall()
    return [r[0] for r in rows]


@router.get("/active-companies")
def get_active_companies(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT DISTINCT company FROM reports WHERE is_active = 1 ORDER BY company"
    )).fetchall()
    return [r[0] for r in rows]


@router.get("/view-company")
def get_view_company(db: Session = Depends(get_db)):
    row = db.execute(text(
        "SELECT value FROM view_settings WHERE key = 'view_company'"
    )).fetchone()
    return {"company": row[0] if row else ""}


class ViewCompanyBody(BaseModel):
    company: str


@router.put("/view-company")
def set_view_company(body: ViewCompanyBody, db: Session = Depends(get_db)):
    db.execute(text(
        "UPDATE view_settings SET value = :v WHERE key = 'view_company'"
    ), {"v": body.company})
    db.commit()
    return {"company": body.company}
