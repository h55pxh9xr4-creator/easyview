from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter()


def _bs_ending(db, year: str, month: str) -> str:
    """기말잔액 계산용 서브쿼리 생성"""
    return f"""
        SELECT t.account_code, t.category, t.sum_acct, t.mgmt_acct,
               t.disclosure_acct, t.opening_signed, t.opening_balance,
               (t.opening_signed + COALESCE(je_c.net, 0)) *
                   CASE t.category WHEN '자산' THEN 1 ELSE -1 END AS ending,
               t.opening_balance AS opening
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS'
            AND substr(year_month,1,4)='{year}'
            AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) je_c ON t.account_code = je_c.account_code
    """


@router.get("/summary")
def get_bs_summary(
    base_ym: str = Query(...),
    bs_base: str = Query("year_start"),
    db: Session = Depends(get_db),
):
    year, month = base_ym.split("-")
    sq = _bs_ending(db, year, month)

    rows = db.execute(text(f"""
        SELECT category, sum_acct, SUM(ending) AS total_ending, SUM(opening) AS total_opening
        FROM ({sq}) sub
        GROUP BY category, sum_acct
        ORDER BY category, sum_acct
    """)).fetchall()

    result = []
    for r in rows:
        chg = round((r[2] - r[3]) / abs(r[3]), 4) if r[3] else 0.0
        result.append({
            "category": r[0], "sum_acct": r[1],
            "ending": float(r[2] or 0), "opening": float(r[3] or 0), "change_pct": chg,
        })
    return result


@router.get("/trend")
def get_bs_trend(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """BS 월별 추이 — 자산/부채/자본 기말잔액"""
    year = base_ym.split("-")[0]
    month = base_ym.split("-")[1]

    months = db.execute(text(f"""
        SELECT DISTINCT year_month FROM je
        WHERE section='BS' AND substr(year_month,1,4)='{year}'
        AND substr(year_month,6,2)<='{month}'
        ORDER BY year_month
    """)).fetchall()

    result = []
    for (ym,) in months:
        y, m = ym.split("-")
        rows = db.execute(text(f"""
            SELECT category,
                SUM((t.opening_signed + COALESCE(j.net,0)) *
                    CASE t.category WHEN '자산' THEN 1 ELSE -1 END) AS ending
            FROM tb_account t
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{y}'
                AND substr(year_month,6,2)<='{m}'
                GROUP BY account_code
            ) j ON t.account_code=j.account_code
            GROUP BY t.category
        """)).fetchall()
        row = {"year_month": ym}
        for r in rows:
            row[r[0]] = float(r[1] or 0)
        result.append(row)
    return result


@router.get("/account")
def get_bs_account(
    base_ym: str = Query(...),
    bs_base: str = Query("year_start"),
    category: str = Query(None),
    db: Session = Depends(get_db),
):
    """BS 계정분석 — 합산계정 > 관리계정 > 계정과목 드릴다운"""
    year, month = base_ym.split("-")
    sq = _bs_ending(db, year, month)
    where = f"WHERE sub.category='{category}'" if category else ""

    rows = db.execute(text(f"""
        SELECT sub.category, sub.sum_acct, sub.mgmt_acct,
               sub.disclosure_acct,
               SUM(sub.ending) AS ending, SUM(sub.opening) AS opening
        FROM ({sq}) sub
        {where}
        GROUP BY sub.category, sub.sum_acct, sub.mgmt_acct, sub.disclosure_acct
        ORDER BY sub.category, sub.sum_acct, sub.ending DESC
    """)).fetchall()

    result = []
    for r in rows:
        end, opn = float(r[4] or 0), float(r[5] or 0)
        chg = round((end - opn) / abs(opn), 4) if opn else 0.0
        result.append({
            "category": r[0], "sum_acct": r[1], "mgmt_acct": r[2],
            "disclosure_acct": r[3], "ending": end, "opening": opn, "change_pct": chg,
        })
    return result
