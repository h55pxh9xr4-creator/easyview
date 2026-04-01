from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import Optional

router = APIRouter()


@router.get("/analysis")
def get_vch_analysis(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    """전표분석내역 — 계정별/거래처별 집계"""
    year, month = base_ym.split("-")
    if period_type == "monthly":
        ym_filter = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
    else:
        ym_filter = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"

    rows = db.execute(text(f"""
        SELECT
            disclosure_acct, mgmt_acct, dr_cr,
            COUNT(DISTINCT voucher_no) AS voucher_cnt,
            COUNT(*) AS line_cnt,
            ROUND(SUM(amount), 0) AS total_amount
        FROM je
        WHERE {ym_filter}
        GROUP BY disclosure_acct, mgmt_acct, dr_cr
        ORDER BY total_amount DESC
        LIMIT 200
    """)).fetchall()

    return [{"disclosure_acct": r[0], "mgmt_acct": r[1], "dr_cr": r[2],
             "voucher_cnt": r[3], "line_cnt": r[4], "total_amount": float(r[5] or 0)}
            for r in rows]


@router.get("/search")
def search_vch(
    keyword: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    counterparty: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    dr_cr: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(50),
    db: Session = Depends(get_db),
):
    """전표검색"""
    conditions = ["1=1"]
    if keyword:
        kw = keyword.replace("'", "''")
        conditions.append(f"(description LIKE '%{kw}%' OR counterparty LIKE '%{kw}%' OR voucher_no LIKE '%{kw}%')")
    if account:
        ac = account.replace("'", "''")
        conditions.append(f"(disclosure_acct LIKE '%{ac}%' OR mgmt_acct LIKE '%{ac}%' OR account_name LIKE '%{ac}%')")
    if counterparty:
        cp = counterparty.replace("'", "''")
        conditions.append(f"counterparty LIKE '%{cp}%'")
    if date_from:
        conditions.append(f"date >= '{date_from}'")
    if date_to:
        conditions.append(f"date <= '{date_to}'")
    if dr_cr:
        conditions.append(f"dr_cr='{dr_cr}'")

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    total = db.execute(text(f"SELECT COUNT(*) FROM je WHERE {where}")).scalar() or 0
    rows = db.execute(text(f"""
        SELECT date, voucher_no, dr_cr, amount, counterparty, description,
               account_name, disclosure_acct, mgmt_acct
        FROM je WHERE {where}
        ORDER BY date DESC, voucher_no
        LIMIT {page_size} OFFSET {offset}
    """)).fetchall()

    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [{"date": str(r[0]), "voucher_no": r[1], "dr_cr": r[2],
                   "amount": float(r[3] or 0), "counterparty": r[4],
                   "description": r[5], "account_name": r[6],
                   "disclosure_acct": r[7], "mgmt_acct": r[8]}
                  for r in rows]
    }
