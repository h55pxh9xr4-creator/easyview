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
    """SC1: 동일금액 중복 전표 (레거시)"""
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


@router.get("/1/exceptions")
def sc1_exceptions(
    date_from: str = Query(...),
    date_to: str = Query(...),
    min_amount: float = Query(0),
    max_amount: float = Query(9999999999999),
    db: Session = Depends(get_db),
):
    """SC1: 예외 그룹 (연월·계정·금액 기준 중복 집계)"""
    rows = db.execute(text(f"""
        SELECT year_month, account_name, amount,
               SUM(CASE WHEN dr_cr='차변' THEN 1 ELSE 0 END) AS dr_cnt,
               SUM(CASE WHEN dr_cr='대변' THEN 1 ELSE 0 END) AS cr_cnt,
               COUNT(*) AS total_cnt
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND amount >= {min_amount} AND amount <= {max_amount}
        GROUP BY year_month, account_name, amount
        HAVING total_cnt >= 2
        ORDER BY amount DESC, year_month
    """)).fetchall()
    return [{"year_month": r[0], "account_name": r[1], "amount": float(r[2] or 0),
             "dr_cnt": int(r[3]), "cr_cnt": int(r[4]), "total_cnt": int(r[5])}
            for r in rows]


@router.get("/1/extract")
def sc1_extract(
    date_from: str = Query(...),
    date_to: str = Query(...),
    year_month: str = Query(...),
    account_name: str = Query(...),
    amount: float = Query(...),
    db: Session = Depends(get_db),
):
    """SC1: 선택 그룹의 전표 추출 내역 (계정·거래처별 집계)"""
    an = account_name.replace("'", "''")
    rows = db.execute(text(f"""
        SELECT year_month, account_name, counterparty,
               ROUND(SUM(CASE WHEN dr_cr='차변' THEN amount ELSE 0 END), 0) AS dr,
               ROUND(SUM(CASE WHEN dr_cr='대변' THEN amount ELSE 0 END), 0) AS cr
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND year_month='{year_month}' AND account_name='{an}' AND amount={amount}
        GROUP BY year_month, account_name, counterparty
        ORDER BY (dr + cr) DESC
    """)).fetchall()
    return [{"year_month": r[0], "account_name": r[1], "counterparty": r[2],
             "dr": float(r[3] or 0), "cr": float(r[4] or 0)} for r in rows]


@router.get("/1/lines")
def sc1_lines(
    date_from: str = Query(...),
    date_to: str = Query(...),
    year_month: str = Query(...),
    account_name: str = Query(...),
    amount: float = Query(...),
    db: Session = Depends(get_db),
):
    """SC1: 선택 그룹의 전표 상세 라인"""
    an = account_name.replace("'", "''")
    rows = db.execute(text(f"""
        SELECT date, voucher_no, account_name, counterparty, description, dr_cr, amount
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND year_month='{year_month}' AND account_name='{an}' AND amount={amount}
        ORDER BY date, voucher_no
    """)).fetchall()
    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4], "dr_cr": r[5],
             "amount": float(r[6] or 0)} for r in rows]


@router.get("/2/exceptions")
def sc2_exceptions(
    date_from: str = Query(...),
    date_to: str = Query(...),
    min_amount: float = Query(0),
    max_amount: float = Query(9999999999999),
    db: Session = Depends(get_db),
):
    """SC2: 예외 그룹 (연월·금액 기준, 현금대변+부채대변 동시 존재)"""
    rows = db.execute(text(f"""
        SELECT year_month, amount, COUNT(DISTINCT voucher_no) AS vch_cnt
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND amount >= {min_amount} AND amount <= {max_amount}
        GROUP BY year_month, amount
        HAVING SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
           AND SUM(CASE WHEN category='부채' AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
        ORDER BY amount DESC, year_month
    """)).fetchall()
    return [{"year_month": r[0], "amount": float(r[1] or 0), "vch_cnt": int(r[2])}
            for r in rows]


@router.get("/2/extract")
def sc2_extract(
    date_from: str = Query(...),
    date_to: str = Query(...),
    year_month: str = Query(...),
    amount: float = Query(...),
    db: Session = Depends(get_db),
):
    """SC2: 선택 그룹의 전표 추출 내역"""
    rows = db.execute(text(f"""
        SELECT date,
               CASE WHEN is_cash=1 AND dr_cr='대변' THEN '현금지급' ELSE '부채인식' END AS type,
               voucher_no, account_name, counterparty, amount
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND year_month='{year_month}' AND amount={amount}
          AND ((is_cash=1 AND dr_cr='대변') OR (category='부채' AND dr_cr='대변'))
        ORDER BY date, type DESC
    """)).fetchall()
    return [{"date": str(r[0]), "type": r[1], "voucher_no": r[2],
             "account_name": r[3], "counterparty": r[4], "amount": float(r[5] or 0)}
            for r in rows]


@router.get("/2/lines")
def sc2_lines(
    date_from: str = Query(...),
    date_to: str = Query(...),
    year_month: str = Query(...),
    amount: float = Query(...),
    db: Session = Depends(get_db),
):
    """SC2: 선택 그룹의 전표 상세 라인 (해당 전표번호 전체)"""
    rows = db.execute(text(f"""
        SELECT date, voucher_no, account_name, counterparty, description, dr_cr, amount
        FROM je
        WHERE voucher_no IN (
            SELECT DISTINCT voucher_no FROM je
            WHERE date >= '{date_from}' AND date <= '{date_to}'
              AND year_month='{year_month}' AND amount={amount}
              AND ((is_cash=1 AND dr_cr='대변') OR (category='부채' AND dr_cr='대변'))
        )
        ORDER BY date, voucher_no, dr_cr DESC
    """)).fetchall()
    return [{"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4], "dr_cr": r[5],
             "amount": float(r[6] or 0)} for r in rows]


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


@router.get("/3/summary")
def sc3_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC3: 주말 현금지급 일별 집계 (차트용)"""
    rows = db.execute(text(f"""
        SELECT date, COUNT(*) AS cnt, SUM(amount) AS total_amount
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND is_weekend=1 AND is_cash=1 AND dr_cr='대변'
        GROUP BY date
        ORDER BY date
    """)).fetchall()
    return [{"date": str(r[0]), "cnt": int(r[1]), "total_amount": float(r[2] or 0)}
            for r in rows]


@router.get("/3/extract")
def sc3_extract(
    date_from: str = Query(...),
    date_to: str = Query(...),
    selected_date: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC3: 선택 날짜의 전표 추출 내역"""
    rows = db.execute(text(f"""
        SELECT voucher_no, account_name, counterparty,
               SUM(amount) AS total_amount
        FROM je
        WHERE date >= '{date_from}' AND date <= '{date_to}'
          AND date = '{selected_date}'
          AND is_weekend=1 AND is_cash=1 AND dr_cr='대변'
        GROUP BY voucher_no, account_name, counterparty
        ORDER BY total_amount DESC
    """)).fetchall()
    return [{"voucher_no": r[0], "account_name": r[1], "counterparty": r[2],
             "total_amount": float(r[3] or 0)}
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


@router.get("/4/summary")
def sc4_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    min_amount: float = Query(20_000_000),
    max_amount: float = Query(15_000_000_000),
    db: Session = Depends(get_db),
):
    """SC4: 고액 현금지급 일별 집계 (차트용)"""
    rows = db.execute(text(f"""
        SELECT j.date,
               COUNT(DISTINCT j.voucher_no) AS cnt,
               SUM(j.amount)               AS total_amount
        FROM je j
        WHERE j.is_cash=1 AND j.dr_cr='대변'
          AND j.amount >= {min_amount} AND j.amount <= {max_amount}
          AND j.date >= '{date_from}' AND j.date <= '{date_to}'
        GROUP BY j.date
        ORDER BY j.date
    """)).fetchall()

    return [{"date": str(r[0]), "cnt": int(r[1]), "total_amount": float(r[2] or 0)}
            for r in rows]


@router.get("/4/extract")
def sc4_extract(
    date_from: str = Query(...),
    date_to: str = Query(...),
    selected_date: str = Query(...),
    min_amount: float = Query(20_000_000),
    max_amount: float = Query(15_000_000_000),
    db: Session = Depends(get_db),
):
    """SC4: 선택 일자 전표 추출"""
    rows = db.execute(text(f"""
        SELECT j.voucher_no, j.account_name, j.counterparty,
               SUM(j.amount) AS total_amount
        FROM je j
        WHERE j.is_cash=1 AND j.dr_cr='대변'
          AND j.amount >= {min_amount} AND j.amount <= {max_amount}
          AND j.date >= '{date_from}' AND j.date <= '{date_to}'
          AND j.date = '{selected_date}'
        GROUP BY j.voucher_no, j.account_name, j.counterparty
        ORDER BY total_amount DESC
    """)).fetchall()

    return [{"voucher_no": r[0], "account_name": r[1],
             "counterparty": r[2], "total_amount": float(r[3] or 0)}
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


@router.get("/5/summary")
def sc5_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC5: 비용+현금 동시 전표 일별 집계 (차트용)"""
    rows = db.execute(text(f"""
        SELECT j.date,
               COUNT(DISTINCT j.voucher_no)                                          AS cnt,
               SUM(CASE WHEN j.category='비용' AND j.dr_cr='차변' THEN j.amount ELSE 0 END) AS total_expense,
               SUM(CASE WHEN j.is_cash=1      AND j.dr_cr='대변' THEN j.amount ELSE 0 END) AS total_cash
        FROM je j
        INNER JOIN (
            SELECT voucher_no
            FROM je
            WHERE date >= '{date_from}' AND date <= '{date_to}'
            GROUP BY voucher_no
            HAVING SUM(CASE WHEN category='비용' AND dr_cr='차변' THEN 1 ELSE 0 END) > 0
               AND SUM(CASE WHEN is_cash=1      AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
        ) sc ON j.voucher_no = sc.voucher_no
        WHERE j.date >= '{date_from}' AND j.date <= '{date_to}'
        GROUP BY j.date
        ORDER BY j.date
    """)).fetchall()

    return [{"date": str(r[0]), "cnt": int(r[1]),
             "total_expense": float(r[2] or 0), "total_cash": float(r[3] or 0)}
            for r in rows]


@router.get("/5/extract")
def sc5_extract(
    date_from: str = Query(...),
    date_to: str = Query(...),
    selected_date: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC5: 선택 일자 전표별 비용인식/현금지급 집계"""
    rows = db.execute(text(f"""
        SELECT j.voucher_no,
               SUM(CASE WHEN j.category='비용' AND j.dr_cr='차변' THEN j.amount ELSE 0 END) AS expense_amount,
               SUM(CASE WHEN j.is_cash=1      AND j.dr_cr='대변' THEN j.amount ELSE 0 END) AS cash_amount
        FROM je j
        INNER JOIN (
            SELECT voucher_no
            FROM je
            WHERE date >= '{date_from}' AND date <= '{date_to}'
            GROUP BY voucher_no
            HAVING SUM(CASE WHEN category='비용' AND dr_cr='차변' THEN 1 ELSE 0 END) > 0
               AND SUM(CASE WHEN is_cash=1      AND dr_cr='대변' THEN 1 ELSE 0 END) > 0
        ) sc ON j.voucher_no = sc.voucher_no
        WHERE j.date = '{selected_date}'
        GROUP BY j.voucher_no
        ORDER BY cash_amount DESC
    """)).fetchall()

    return [{"voucher_no": r[0], "expense_amount": float(r[1] or 0), "cash_amount": float(r[2] or 0)}
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


@router.get("/6/exceptions")
def sc6_exceptions(
    date_from: str = Query(...),
    date_to: str = Query(...),
    threshold: int = Query(10),
    db: Session = Depends(get_db),
):
    """SC6: 희소 거래처 목록 (전체 기간 기준 N건 이하)"""
    rows = db.execute(text(f"""
        SELECT j.counterparty, COUNT(DISTINCT j.voucher_no) AS vch_cnt
        FROM je j
        WHERE j.counterparty IS NOT NULL AND j.counterparty != ''
          AND j.date >= '{date_from}' AND j.date <= '{date_to}'
        GROUP BY j.counterparty
        HAVING vch_cnt <= {threshold}
        ORDER BY vch_cnt ASC, j.counterparty
    """)).fetchall()

    return [{"counterparty": r[0], "vch_cnt": int(r[1])} for r in rows]


@router.get("/6/extract")
def sc6_extract(
    date_from: str = Query(...),
    date_to: str = Query(...),
    counterparty: str = Query(...),
    db: Session = Depends(get_db),
):
    """SC6: 선택 거래처의 전표 목록"""
    rows = db.execute(text(f"""
        SELECT j.date, j.voucher_no,
               SUM(CASE WHEN j.dr_cr='차변' THEN j.amount ELSE 0 END) AS dr_amount,
               SUM(CASE WHEN j.dr_cr='대변' THEN j.amount ELSE 0 END) AS cr_amount
        FROM je j
        WHERE j.counterparty = :cp
          AND j.date >= '{date_from}' AND j.date <= '{date_to}'
        GROUP BY j.date, j.voucher_no
        ORDER BY j.date DESC, j.voucher_no
    """), {"cp": counterparty}).fetchall()

    return [{"date": str(r[0]), "voucher_no": r[1],
             "dr_amount": float(r[2] or 0), "cr_amount": float(r[3] or 0)}
            for r in rows]
