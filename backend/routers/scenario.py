from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter()


@router.get("/1/detail")
def sc1_detail(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC1: 동일금액 중복 전표"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no, j.account_name, j.counterparty,
               j.description, j.amount, j.dr_cr, cnt
        FROM je j
        INNER JOIN (
            SELECT year_month, account_code, dr_cr, amount, COUNT(*) AS cnt
            FROM je WHERE year_month='{base_ym}'
            GROUP BY year_month, account_code, dr_cr, amount
            HAVING cnt >= 2
        ) dup ON j.year_month=dup.year_month AND j.account_code=dup.account_code
            AND j.dr_cr=dup.dr_cr AND j.amount=dup.amount
        ORDER BY j.amount DESC, j.date
        LIMIT 500
    """)).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4],
             "amount": float(r[5] or 0), "dr_cr": r[6], "dup_count": r[7]}
            for r in rows]


@router.get("/2/detail")
def sc2_detail(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC2: 현금지급 後 부채인식 (동일 연월+금액)"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no, j.account_name, j.counterparty,
               j.description, j.amount, j.dr_cr,
               CASE WHEN j.is_cash=1 THEN '현금지급' ELSE '부채인식' END AS type
        FROM je j
        INNER JOIN (
            SELECT amount
            FROM je WHERE year_month='{base_ym}'
            GROUP BY amount
            HAVING SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
               AND SUM(CASE WHEN category='부채' AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
        ) dup ON j.amount=dup.amount
        WHERE j.year_month='{base_ym}'
          AND (j.is_cash=1 OR j.category='부채')
          AND j.dr_cr='대변'
        ORDER BY j.amount DESC, j.date
        LIMIT 500
    """)).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4],
             "amount": float(r[5] or 0), "dr_cr": r[6], "type": r[7]}
            for r in rows]


@router.get("/3/detail")
def sc3_detail(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC3: 주말 현금지급"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no, j.account_name, j.counterparty,
               j.description, j.amount, j.dr_cr
        FROM je j
        WHERE j.year_month='{base_ym}'
          AND j.is_weekend=1 AND j.is_cash=1 AND j.dr_cr='대변'
        ORDER BY j.date, j.voucher_no
        LIMIT 500
    """)).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4],
             "amount": float(r[5] or 0), "dr_cr": r[6]}
            for r in rows]


@router.get("/4/detail")
def sc4_detail(
    base_ym: str = Query(...),
    threshold: float = Query(1000000),
    db: Session = Depends(get_db),
):
    """SC4: 고액 현금지급 (기본 100만원 이상)"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no, j.account_name, j.counterparty,
               j.description, j.amount, j.dr_cr
        FROM je j
        WHERE j.year_month='{base_ym}'
          AND j.is_cash=1 AND j.dr_cr='대변' AND j.amount >= {threshold}
        ORDER BY j.amount DESC, j.date
        LIMIT 500
    """)).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4],
             "amount": float(r[5] or 0), "dr_cr": r[6]}
            for r in rows]


@router.get("/5/detail")
def sc5_detail(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC5: 비용인식과 동시에 현금지급 (동일 전표)"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no, j.account_name, j.counterparty,
               j.description, j.amount, j.dr_cr,
               CASE WHEN j.category='비용' AND j.dr_cr='차변' THEN '비용인식'
                    ELSE '현금지급' END AS type
        FROM je j
        INNER JOIN (
            SELECT voucher_no
            FROM je WHERE year_month='{base_ym}'
            GROUP BY voucher_no
            HAVING SUM(CASE WHEN category='비용' AND dr_cr='차변' THEN 1 ELSE 0 END) > 0
               AND SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
        ) sc ON j.voucher_no=sc.voucher_no
        WHERE j.year_month='{base_ym}'
        ORDER BY j.date, j.voucher_no
        LIMIT 500
    """)).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4],
             "amount": float(r[5] or 0), "dr_cr": r[6], "type": r[7]}
            for r in rows]


@router.get("/6/detail")
def sc6_detail(
    base_ym: str = Query(...),
    threshold: int = Query(10),
    db: Session = Depends(get_db),
):
    """SC6: Seldom Used Customer (전체 기간 N건 이하 거래처)"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no, j.account_name, j.counterparty,
               j.description, j.amount, j.dr_cr, freq.total_cnt
        FROM je j
        INNER JOIN (
            SELECT counterparty, COUNT(DISTINCT voucher_no) AS total_cnt
            FROM je WHERE counterparty IS NOT NULL
            GROUP BY counterparty HAVING total_cnt <= {threshold}
        ) freq ON j.counterparty=freq.counterparty
        WHERE j.year_month='{base_ym}'
        ORDER BY freq.total_cnt ASC, j.date
        LIMIT 500
    """)).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4],
             "amount": float(r[5] or 0), "dr_cr": r[6], "total_voucher_cnt": r[7]}
            for r in rows]
