from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import Optional

router = APIRouter()

# ── 공통 헬퍼 ──────────────────────────────────────────────────

def _ym_filter(base_ym: str, period_type: str) -> str:
    year, month = base_ym.split("-")
    if period_type == "monthly":
        return f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
    return f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"

def _acct_filter(disc_accts: Optional[str]) -> str:
    if not disc_accts:
        return ""
    accts = [f"'{a.strip()}'" for a in disc_accts.split(",") if a.strip()]
    return f" AND disclosure_acct IN ({','.join(accts)})" if accts else ""

def _date_filter(date: Optional[str]) -> str:
    return f" AND date='{date}'" if date else ""


# ── 기존 엔드포인트 ─────────────────────────────────────────────

@router.get("/analysis")
def get_vch_analysis(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    """전표분석내역 — 계정별/거래처별 집계"""
    where = _ym_filter(base_ym, period_type)
    rows = db.execute(text(f"""
        SELECT
            disclosure_acct, mgmt_acct, dr_cr,
            COUNT(DISTINCT voucher_no) AS voucher_cnt,
            COUNT(*) AS line_cnt,
            ROUND(SUM(amount), 0) AS total_amount
        FROM je
        WHERE {where}
        GROUP BY disclosure_acct, mgmt_acct, dr_cr
        ORDER BY total_amount DESC
        LIMIT 200
    """)).fetchall()

    return [{"disclosure_acct": r[0], "mgmt_acct": r[1], "dr_cr": r[2],
             "voucher_cnt": r[3], "line_cnt": r[4], "total_amount": float(r[5] or 0)}
            for r in rows]


def _search_where(
    keyword: Optional[str] = None,
    disc_acct: Optional[str] = None,
    counterparty: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    dr_cr: Optional[str] = None,
) -> str:
    conditions = ["1=1"]
    if keyword:
        kw = keyword.replace("'", "''")
        conditions.append(f"(description LIKE '%{kw}%' OR counterparty LIKE '%{kw}%' OR voucher_no LIKE '%{kw}%')")
    if disc_acct:
        da = disc_acct.replace("'", "''")
        conditions.append(f"disclosure_acct='{da}'")
    if counterparty:
        cp = counterparty.replace("'", "''")
        conditions.append(f"counterparty LIKE '%{cp}%'")
    if date_from:
        conditions.append(f"date >= '{date_from}'")
    if date_to:
        conditions.append(f"date <= '{date_to}'")
    if dr_cr:
        conditions.append(f"dr_cr='{dr_cr}'")
    return " AND ".join(conditions)


@router.get("/search")
def search_vch(
    keyword: Optional[str] = Query(None),
    disc_acct: Optional[str] = Query(None),
    counterparty: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    dr_cr: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(50),
    db: Session = Depends(get_db),
):
    """전표검색"""
    where = _search_where(keyword, disc_acct, counterparty, date_from, date_to, dr_cr)
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


@router.get("/voucher_detail")
def get_voucher_detail(
    voucher_no: str = Query(...),
    db: Session = Depends(get_db),
):
    """전표번호 기준 전체 라인 조회"""
    rows = db.execute(text("""
        SELECT date, voucher_no, account_name, disclosure_acct, mgmt_acct,
               counterparty, description, dr_cr, amount
        FROM je
        WHERE voucher_no = :vno
        ORDER BY dr_cr DESC, amount DESC
    """), {"vno": voucher_no}).fetchall()
    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "disclosure_acct": r[3], "mgmt_acct": r[4], "counterparty": r[5],
             "description": r[6], "dr_cr": r[7], "amount": float(r[8] or 0)}
            for r in rows]


@router.get("/search_disc_accts")
def get_search_disc_accts(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """전표검색 필터용 공시용계정 목록"""
    conditions = ["disclosure_acct IS NOT NULL", "disclosure_acct != ''"]
    if date_from:
        conditions.append(f"date >= '{date_from}'")
    if date_to:
        conditions.append(f"date <= '{date_to}'")
    where = " AND ".join(conditions)
    rows = db.execute(text(f"SELECT DISTINCT disclosure_acct FROM je WHERE {where} ORDER BY disclosure_acct")).fetchall()
    return [r[0] for r in rows]


@router.get("/counter_summary")
def get_counter_summary(
    keyword: Optional[str] = Query(None),
    disc_acct: Optional[str] = Query(None),
    counterparty: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    dr_cr: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """검색 결과 전표번호 기준 전체 계정 집계 (상대계정 선택용)"""
    where = _search_where(keyword, disc_acct, counterparty, date_from, date_to, dr_cr)
    rows = db.execute(text(f"""
        SELECT
            account_name, disclosure_acct,
            ROUND(SUM(CASE WHEN dr_cr='차변' THEN amount ELSE 0 END), 0) AS dr,
            ROUND(SUM(CASE WHEN dr_cr='대변' THEN amount ELSE 0 END), 0) AS cr
        FROM je
        WHERE voucher_no IN (SELECT DISTINCT voucher_no FROM je WHERE {where})
        GROUP BY account_name, disclosure_acct
        ORDER BY (dr + cr) DESC
    """)).fetchall()
    return [{"account_name": r[0], "disclosure_acct": r[1],
             "dr": float(r[2] or 0), "cr": float(r[3] or 0)} for r in rows]


@router.get("/counter_lines")
def get_counter_lines(
    keyword: Optional[str] = Query(None),
    disc_acct: Optional[str] = Query(None),
    counterparty: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    dr_cr: Optional[str] = Query(None),
    sel_accounts: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(100),
    db: Session = Depends(get_db),
):
    """선택 계정의 전표 상세 라인 (상대계정 테이블용)"""
    where = _search_where(keyword, disc_acct, counterparty, date_from, date_to, dr_cr)
    acct_filter = ""
    if sel_accounts:
        accts = [f"'{a.strip()}'" for a in sel_accounts.split("||") if a.strip()]
        if accts:
            acct_filter = f" AND account_name IN ({','.join(accts)})"

    offset = (page - 1) * page_size
    total = int(db.execute(text(f"""
        SELECT COUNT(*) FROM je
        WHERE voucher_no IN (SELECT DISTINCT voucher_no FROM je WHERE {where}){acct_filter}
    """)).scalar() or 0)
    rows = db.execute(text(f"""
        SELECT date, voucher_no, account_name, disclosure_acct, counterparty,
               description, dr_cr, amount
        FROM je
        WHERE voucher_no IN (SELECT DISTINCT voucher_no FROM je WHERE {where}){acct_filter}
        ORDER BY date DESC, voucher_no
        LIMIT {page_size} OFFSET {offset}
    """)).fetchall()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
                   "disclosure_acct": r[3], "counterparty": r[4], "description": r[5],
                   "dr_cr": r[6], "amount": float(r[7] or 0)} for r in rows]
    }


# ── 신규 엔드포인트 (전표분석내역 BI 페이지용) ────────────────────

@router.get("/disclosure_accts")
def get_disclosure_accts(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    """필터용 공시용계정 목록"""
    where = _ym_filter(base_ym, period_type)
    rows = db.execute(text(f"""
        SELECT DISTINCT disclosure_acct
        FROM je
        WHERE {where} AND disclosure_acct IS NOT NULL AND disclosure_acct != ''
        ORDER BY disclosure_acct
    """)).fetchall()
    return [r[0] for r in rows]


@router.get("/kpi")
def get_vch_kpi(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    disc_accts: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """전표 건수 + 차변/대변 합계"""
    where = _ym_filter(base_ym, period_type) + _acct_filter(disc_accts) + _date_filter(date)
    row = db.execute(text(f"""
        SELECT
            COUNT(DISTINCT voucher_no) AS total_cnt,
            ROUND(SUM(CASE WHEN dr_cr='차변' THEN amount ELSE 0 END), 0) AS dr_sum,
            ROUND(SUM(CASE WHEN dr_cr='대변' THEN amount ELSE 0 END), 0) AS cr_sum
        FROM je WHERE {where}
    """)).fetchone()
    return {"total_cnt": int(row[0] or 0), "dr_sum": float(row[1] or 0), "cr_sum": float(row[2] or 0)}


@router.get("/daily")
def get_vch_daily(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    disc_accts: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """일자별 전표 건수"""
    where = _ym_filter(base_ym, period_type) + _acct_filter(disc_accts)
    rows = db.execute(text(f"""
        SELECT date, COUNT(DISTINCT voucher_no) AS cnt
        FROM je WHERE {where}
        GROUP BY date ORDER BY date
    """)).fetchall()
    return [{"date": str(r[0]), "cnt": int(r[1])} for r in rows]


@router.get("/account_bar")
def get_vch_account_bar(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    disc_accts: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """계정과목별 전표 건수 (공시용계정 단위)"""
    where = _ym_filter(base_ym, period_type) + _acct_filter(disc_accts) + _date_filter(date)
    rows = db.execute(text(f"""
        SELECT disclosure_acct, COUNT(DISTINCT voucher_no) AS cnt
        FROM je WHERE {where} AND disclosure_acct IS NOT NULL
        GROUP BY disclosure_acct
        ORDER BY cnt DESC
        LIMIT 20
    """)).fetchall()
    return [{"disclosure_acct": r[0], "cnt": int(r[1])} for r in rows]


@router.get("/top_counterparty")
def get_vch_top_counterparty(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    disc_accts: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    top_n: int = Query(10),
    db: Session = Depends(get_db),
):
    """전표수 기준 상위 N 거래처"""
    where = _ym_filter(base_ym, period_type) + _acct_filter(disc_accts) + _date_filter(date)
    total_cnt = int(db.execute(text(
        f"SELECT COUNT(DISTINCT voucher_no) FROM je WHERE {where}"
    )).scalar() or 1)

    rows = db.execute(text(f"""
        SELECT counterparty, COUNT(DISTINCT voucher_no) AS cnt
        FROM je
        WHERE {where} AND counterparty IS NOT NULL AND counterparty != ''
        GROUP BY counterparty ORDER BY cnt DESC
        LIMIT {top_n}
    """)).fetchall()

    items = [{"name": r[0], "cnt": int(r[1]), "pct": round(int(r[1]) / total_cnt * 100, 2)} for r in rows]
    top_cnt = sum(i["cnt"] for i in items)
    other_cnt = total_cnt - top_cnt
    if other_cnt > 0:
        items.append({"name": "기타", "cnt": other_cnt, "pct": round(other_cnt / total_cnt * 100, 2)})
    return items


@router.get("/vouchers")
def get_vch_vouchers(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    disc_accts: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(100),
    db: Session = Depends(get_db),
):
    """기표내역 (계정 필터 + 날짜 필터 + 페이지네이션)"""
    where = _ym_filter(base_ym, period_type) + _acct_filter(disc_accts) + _date_filter(date)
    offset = (page - 1) * page_size
    total = int(db.execute(text(f"SELECT COUNT(*) FROM je WHERE {where}")).scalar() or 0)
    rows = db.execute(text(f"""
        SELECT date, voucher_no, account_name, counterparty, description,
               dr_cr, amount, disclosure_acct, mgmt_acct
        FROM je WHERE {where}
        ORDER BY date DESC, voucher_no
        LIMIT {page_size} OFFSET {offset}
    """)).fetchall()
    return {
        "total": total, "page": page, "page_size": page_size,
        "items": [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
                   "counterparty": r[3], "description": r[4], "dr_cr": r[5],
                   "amount": float(r[6] or 0), "disclosure_acct": r[7], "mgmt_acct": r[8]}
                  for r in rows]
    }
