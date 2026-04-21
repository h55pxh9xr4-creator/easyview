from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter()


@router.get("/months")
def get_months(db: Session = Depends(get_db)):
    """사용 가능한 연월 목록 반환 (최신순)"""
    rows = db.execute(
        text("SELECT DISTINCT year_month FROM je ORDER BY year_month DESC")
    ).fetchall()
    return [r[0] for r in rows]
