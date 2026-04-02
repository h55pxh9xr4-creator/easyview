from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter()


def _signed_sum(db, ym_filter: str, disclosure_acct: str, section: str = "PL") -> float:
    row = db.execute(text(f"""
        SELECT -ROUND(SUM(signed_amount), 0) FROM je
        WHERE section='{section}' AND disclosure_acct='{disclosure_acct}' AND {ym_filter}
    """)).fetchone()
    return float(row[0] or 0)


def _build_ym_filter(base_ym: str, period_type: str, year_offset: int = 0) -> str:
    year, month = base_ym.split("-")
    y = int(year) + year_offset
    if period_type == "monthly":
        return f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)='{month}'"
    return f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)<='{month}'"


def _calc_pl(db, ym_filter):
    rev   = _signed_sum(db, ym_filter, "매출액")
    cogs  = -_signed_sum(db, ym_filter, "매출원가")
    sga   = -_signed_sum(db, ym_filter, "판매비와관리비")
    oi    = _signed_sum(db, ym_filter, "기타수익")
    oe    = -_signed_sum(db, ym_filter, "기타비용")
    fi    = _signed_sum(db, ym_filter, "금융수익")
    fe    = -_signed_sum(db, ym_filter, "금융비용")
    tax   = -_signed_sum(db, ym_filter, "법인세비용")
    gross = rev - cogs
    op    = gross - sga + oi - oe
    net   = op + fi - fe + tax
    return {"revenue": rev, "cogs": cogs, "sga": sga,
            "other_income": oi, "other_expense": oe,
            "fin_income": fi, "fin_expense": fe, "tax": tax,
            "gross_profit": gross, "operating_income": op, "net_income": net}


@router.get("/summary")
def get_pl_summary(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)
    cur = _calc_pl(db, cur_filter)
    pri = _calc_pl(db, pri_filter)

    # 전월 매출 (월별 고정)
    year, month = base_ym.split("-")
    pm_month = int(month) - 1
    pm_year = int(year)
    if pm_month == 0:
        pm_month, pm_year = 12, pm_year - 1
    pm_filter = f"substr(year_month,1,4)='{pm_year}' AND substr(year_month,6,2)='{pm_month:02d}'"
    pm_rev = _signed_sum(db, pm_filter, "매출액")

    def pct(c, p): return round((c - p) / abs(p), 4) if p else 0.0

    return {
        "current": cur,
        "prior": pri,
        "prev_month_rev_diff": cur["revenue"] - pm_rev,
        "change": {k: pct(cur[k], pri[k]) for k in cur},
    }


@router.get("/trend")
def get_pl_trend(
    base_ym: str = Query(...),
    period_type: str = Query("monthly"),
    db: Session = Depends(get_db),
):
    """월별 PL 추이 (당기/전기)"""
    year = base_ym.split("-")[0]
    pri_year = str(int(year) - 1)
    month = base_ym.split("-")[1]

    rows = db.execute(text(f"""
        SELECT year_month,
            -ROUND(SUM(CASE WHEN disclosure_acct='매출액' THEN signed_amount ELSE 0 END),0) AS rev,
            ROUND(SUM(CASE WHEN disclosure_acct='매출원가' THEN signed_amount ELSE 0 END),0) AS cogs,
            ROUND(SUM(CASE WHEN disclosure_acct='판매비와관리비' THEN signed_amount ELSE 0 END),0) AS sga,
            -ROUND(SUM(CASE WHEN disclosure_acct='기타수익' THEN signed_amount ELSE 0 END),0) AS other_inc,
            ROUND(SUM(CASE WHEN disclosure_acct='기타비용' THEN signed_amount ELSE 0 END),0) AS other_exp,
            -ROUND(SUM(CASE WHEN disclosure_acct='금융수익' THEN signed_amount ELSE 0 END),0) AS fin_inc,
            ROUND(SUM(CASE WHEN disclosure_acct='금융비용' THEN signed_amount ELSE 0 END),0) AS fin_exp,
            ROUND(SUM(CASE WHEN disclosure_acct='법인세비용' THEN signed_amount ELSE 0 END),0) AS tax_exp
        FROM je WHERE section='PL'
        AND (substr(year_month,1,4)='{year}' OR substr(year_month,1,4)='{pri_year}')
        AND substr(year_month,6,2)<='{month}'
        GROUP BY year_month ORDER BY year_month
    """)).fetchall()

    result = []
    for r in rows:
        ym, rev, cogs, sga, other_inc, other_exp, fin_inc, fin_exp, tax_exp = r
        gross = rev - cogs
        op = gross - sga
        net = op + other_inc - other_exp + fin_inc - fin_exp - tax_exp
        result.append({
            "year_month": ym,
            "revenue": rev, "gross_profit": gross, "operating_income": op, "net_income": net,
            "is_current_year": ym.startswith(year),
        })
    return result


@router.get("/waterfall")
def get_pl_waterfall(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """손익 Waterfall — 월별 손익 분해 (월별 고정)"""
    year, month = base_ym.split("-")

    rows = db.execute(text(f"""
        SELECT year_month,
            -ROUND(SUM(CASE WHEN disclosure_acct='매출액' THEN signed_amount ELSE 0 END),0) AS rev,
            ROUND(SUM(CASE WHEN disclosure_acct='매출원가' THEN signed_amount ELSE 0 END),0) AS cogs,
            ROUND(SUM(CASE WHEN disclosure_acct='판매비와관리비' THEN signed_amount ELSE 0 END),0) AS sga,
            -ROUND(SUM(CASE WHEN disclosure_acct IN ('기타수익','금융수익') THEN signed_amount ELSE 0 END),0) AS other_inc,
            ROUND(SUM(CASE WHEN disclosure_acct IN ('기타비용','금융비용','법인세비용') THEN signed_amount ELSE 0 END),0) AS other_exp
        FROM je WHERE section='PL'
        AND substr(year_month,1,4)='{year}'
        AND substr(year_month,6,2)<='{month}'
        GROUP BY year_month ORDER BY year_month
    """)).fetchall()

    result = []
    for r in rows:
        ym, rev, cogs, sga, other_inc, other_exp = r
        gross = rev - cogs
        op    = gross - sga
        other = other_inc - other_exp
        net   = op + other
        result.append({
            "year_month":       ym,
            "revenue":          float(rev   or 0),
            "cogs":             float(cogs  or 0),
            "sga":              float(sga   or 0),
            "gross_profit":     float(gross or 0),
            "other_net":        float(other or 0),
            "operating_income": float(op    or 0),
            "net_income":       float(net   or 0),
        })
    return result


@router.get("/trend_by_account")
def get_pl_trend_by_account(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    """계정별 월별 추이 — 미니차트용 (공시용계정 포함)"""
    year, month = base_ym.split("-")
    pri_year = str(int(year) - 1)

    PL_ORDER = ["매출액", "매출원가", "판매비와관리비", "기타수익", "기타비용", "금융수익", "금융비용", "법인세비용"]

    rows = db.execute(text(f"""
        SELECT mgmt_acct,
               disclosure_acct,
               year_month,
               -ROUND(SUM(signed_amount), 0) AS net
        FROM je
        WHERE section='PL'
          AND (substr(year_month,1,4)='{year}' OR substr(year_month,1,4)='{pri_year}')
          AND substr(year_month,6,2)<='{month}'
          AND mgmt_acct IS NOT NULL
        GROUP BY mgmt_acct, disclosure_acct, year_month
        ORDER BY mgmt_acct, year_month
    """)).fetchall()

    from collections import defaultdict
    result: dict = defaultdict(lambda: {"disclosure_acct": "", "cur": {}, "pri": {}})
    for r in rows:
        acct, disc, ym, net = r[0], r[1], r[2], float(r[3] or 0)
        result[acct]["disclosure_acct"] = disc or ""
        if ym.startswith(year):
            result[acct]["cur"][ym] = net
        else:
            result[acct]["pri"][ym] = net

    items = [{"mgmt_acct": k, **v} for k, v in result.items()]
    # PL_ORDER 기준으로 정렬
    order_map = {d: i for i, d in enumerate(PL_ORDER)}
    items.sort(key=lambda x: order_map.get(x["disclosure_acct"], 99))
    return items


@router.get("/account_detail")
def get_pl_account_detail(
    base_ym: str = Query(...),
    mgmt_acct: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    """계정 클릭 시 — 거래처별 증감 + 당기/전기 기표 내역"""
    year, month = base_ym.split("-")
    pri_year = str(int(year) - 1)

    if period_type == "monthly":
        cur_where = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
        pri_where = f"substr(year_month,1,4)='{pri_year}' AND substr(year_month,6,2)='{month}'"
    else:
        cur_where = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
        pri_where = f"substr(year_month,1,4)='{pri_year}' AND substr(year_month,6,2)<='{month}'"

    # 거래처별 증감
    cp_rows = db.execute(text(f"""
        SELECT counterparty,
               -SUM(CASE WHEN {cur_where} THEN signed_amount ELSE 0 END) AS cur,
               -SUM(CASE WHEN {pri_where} THEN signed_amount ELSE 0 END) AS pri
        FROM je
        WHERE mgmt_acct=:acct AND counterparty IS NOT NULL
        GROUP BY counterparty
        ORDER BY ABS(cur) DESC
        LIMIT 10
    """), {"acct": mgmt_acct}).fetchall()

    counterparty = [
        {"name": r[0], "cur": float(r[1] or 0), "pri": float(r[2] or 0), "change": float(r[1] or 0) - float(r[2] or 0)}
        for r in cp_rows
    ]

    # 당기 기표 내역
    cur_vouchers = db.execute(text(f"""
        SELECT date, voucher_no, counterparty, description, amount, dr_cr
        FROM je
        WHERE mgmt_acct=:acct AND {cur_where}
        ORDER BY date DESC LIMIT 50
    """), {"acct": mgmt_acct}).fetchall()

    # 전기 기표 내역
    pri_vouchers = db.execute(text(f"""
        SELECT date, voucher_no, counterparty, description, amount, dr_cr
        FROM je
        WHERE mgmt_acct=:acct AND {pri_where}
        ORDER BY date DESC LIMIT 50
    """), {"acct": mgmt_acct}).fetchall()

    def vrow(r):
        return {"date": r[0], "voucher_no": r[1], "counterparty": r[2],
                "description": r[3], "amount": float(r[4] or 0), "dr_cr": r[5]}

    return {
        "mgmt_acct": mgmt_acct,
        "counterparty": counterparty,
        "cur_vouchers": [vrow(r) for r in cur_vouchers],
        "pri_vouchers": [vrow(r) for r in pri_vouchers],
    }


@router.get("/account")
def get_pl_account(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    """PL 계정분석 — 공시용계정 > 관리계정 > 계정과목 드릴다운"""
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)

    rows = db.execute(text(f"""
        SELECT
            disclosure_acct, mgmt_acct, account_name, category,
            -ROUND(SUM(CASE WHEN {cur_filter} THEN signed_amount ELSE 0 END),0) AS cur,
            -ROUND(SUM(CASE WHEN {pri_filter} THEN signed_amount ELSE 0 END),0) AS pri
        FROM je WHERE section='PL'
        GROUP BY disclosure_acct, mgmt_acct, account_name, category
        ORDER BY disclosure_acct, mgmt_acct, account_name
    """)).fetchall()

    result = []
    for r in rows:
        cls = r[3]
        sign = 1 if cls == "수익" else -1
        cur = float(r[4] or 0) * sign
        pri = float(r[5] or 0) * sign
        chg = round((cur - pri) / abs(pri), 4) if pri else 0.0
        result.append({
            "disclosure_acct": r[0], "mgmt_acct": r[1], "account_name": r[2],
            "category": cls, "current": cur, "prior": pri, "change_pct": chg,
        })
    return result


@router.get("/sales")
def get_pl_sales(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    top_n: int = Query(20),
    db: Session = Depends(get_db),
):
    """매출분석 — 거래처별 매출액 당기/전기"""
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)

    rows = db.execute(text(f"""
        SELECT counterparty,
            -ROUND(SUM(CASE WHEN {cur_filter} THEN signed_amount ELSE 0 END),0) AS cur,
            -ROUND(SUM(CASE WHEN {pri_filter} THEN signed_amount ELSE 0 END),0) AS pri
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL
        GROUP BY counterparty
        ORDER BY cur DESC LIMIT {top_n}
    """)).fetchall()

    return [{"counterparty": r[0], "current": float(r[1] or 0), "prior": float(r[2] or 0),
             "change": float(r[1] or 0) - float(r[2] or 0)} for r in rows]


@router.get("/items")
def get_pl_items(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    """손익항목 상세 (공시용계정별 당기/전기/증감)"""
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)

    ORDER = ["매출액", "매출원가", "판매비와관리비", "기타수익", "기타비용",
             "금융수익", "금융비용", "법인세비용"]

    rows = db.execute(text(f"""
        SELECT disclosure_acct, category,
            -ROUND(SUM(CASE WHEN {cur_filter} THEN signed_amount ELSE 0 END),0) AS cur,
            -ROUND(SUM(CASE WHEN {pri_filter} THEN signed_amount ELSE 0 END),0) AS pri
        FROM je WHERE section='PL'
        GROUP BY disclosure_acct, category
    """)).fetchall()

    lookup = {r[0]: (r[1], float(r[2] or 0), float(r[3] or 0)) for r in rows}
    result = []
    for acct in ORDER:
        if acct not in lookup:
            continue
        cls, cur, pri = lookup[acct]
        sign = 1 if cls == "수익" else -1
        cur *= sign
        pri *= sign
        chg = round((cur - pri) / abs(pri), 4) if pri else 0.0
        result.append({"account": acct, "current": cur, "prior": pri, "change_pct": chg})
    return result
