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


@router.get("/sales/kpi")
def get_pl_sales_kpi(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)
    year, month = base_ym.split("-")
    pm = int(month) - 1
    py = int(year)
    if pm == 0:
        pm, py = 12, py - 1
    pm_filter = f"substr(year_month,1,4)='{py}' AND substr(year_month,6,2)='{pm:02d}'"

    cur_rev = _signed_sum(db, cur_filter, "매출액")
    pri_rev = _signed_sum(db, pri_filter, "매출액")
    pm_rev = _signed_sum(db, pm_filter, "매출액")

    def count_cp(f):
        r = db.execute(text(f"""
            SELECT COUNT(DISTINCT counterparty) FROM je
            WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL AND {f}
        """)).scalar()
        return int(r or 0)

    cur_cnt = count_cp(cur_filter)
    pri_cnt = count_cp(pri_filter)
    pm_cnt = count_cp(pm_filter)

    return {
        "revenue": {
            "current": cur_rev,
            "prior": pri_rev,
            "change": cur_rev - pri_rev,
            "change_pct": round((cur_rev - pri_rev) / abs(pri_rev), 4) if pri_rev else 0,
            "vs_prev_month": cur_rev - pm_rev,
        },
        "counterparty_count": {
            "current": cur_cnt,
            "prior": pri_cnt,
            "change": cur_cnt - pri_cnt,
            "change_pct": round((cur_cnt - pri_cnt) / abs(pri_cnt), 4) if pri_cnt else 0,
            "vs_prev_month": cur_cnt - pm_cnt,
        },
    }


@router.get("/sales/trend")
def get_pl_sales_trend(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    year = base_ym.split("-")[0]
    pri_year = str(int(year) - 1)
    rows = db.execute(text("""
        SELECT substr(year_month,6,2) AS mo,
               -ROUND(SUM(CASE WHEN substr(year_month,1,4)=:yr THEN signed_amount ELSE 0 END),0) AS cur,
               -ROUND(SUM(CASE WHEN substr(year_month,1,4)=:pr THEN signed_amount ELSE 0 END),0) AS pri
        FROM je WHERE disclosure_acct='매출액'
          AND (substr(year_month,1,4)=:yr OR substr(year_month,1,4)=:pr)
        GROUP BY mo ORDER BY mo
    """), {"yr": year, "pr": pri_year}).fetchall()
    return [{"month": int(r[0]), "current": float(r[1] or 0), "prior": float(r[2] or 0)} for r in rows]


@router.get("/sales/top_donut")
def get_pl_sales_top_donut(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    top_n: int = Query(10),
    db: Session = Depends(get_db),
):
    cur_filter = _build_ym_filter(base_ym, period_type)
    rows = db.execute(text(f"""
        SELECT counterparty, -ROUND(SUM(signed_amount),0) AS cur
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL AND {cur_filter}
        GROUP BY counterparty ORDER BY cur DESC
    """)).fetchall()

    all_rows = [{"counterparty": r[0], "amount": float(r[1] or 0)} for r in rows]
    total = sum(r["amount"] for r in all_rows)
    top = all_rows[:top_n]
    top_total = sum(r["amount"] for r in top)
    other = total - top_total

    result = [
        {"counterparty": r["counterparty"], "amount": r["amount"],
         "pct": round(r["amount"] / total * 100, 2) if total else 0}
        for r in top
    ]
    if other > 0:
        result.append({"counterparty": "기타", "amount": other,
                        "pct": round(other / total * 100, 2) if total else 0})
    return {"items": result, "top_total": top_total,
            "top_pct": round(top_total / total * 100, 2) if total else 0}


@router.get("/sales/bar_race")
def get_pl_sales_bar_race(
    base_ym: str = Query(...),
    top_n: int = Query(15),
    db: Session = Depends(get_db),
):
    """월별 거래처 매출 순위 경쟁용 데이터 (Bar Race 차트)"""
    year = base_ym.split("-")[0]
    # 해당 연도 전체 거래처 월별 매출 집계
    rows = db.execute(text("""
        SELECT substr(year_month,6,2) AS mo,
               counterparty,
               -ROUND(SUM(signed_amount),0) AS amount
        FROM je
        WHERE disclosure_acct='매출액'
          AND counterparty IS NOT NULL
          AND substr(year_month,1,4)=:yr
        GROUP BY mo, counterparty
        ORDER BY mo, amount DESC
    """), {"yr": year}).fetchall()

    # 전체 등장 거래처 중 연간 합산 기준 top_n만 추출
    totals: dict = {}
    for r in rows:
        totals[r[1]] = totals.get(r[1], 0) + float(r[2] or 0)
    top_cps = set(sorted(totals, key=lambda x: -totals[x])[:top_n])

    months = sorted(set(r[0] for r in rows))
    data = [
        {"month": int(r[0]), "counterparty": r[1], "amount": float(r[2] or 0)}
        for r in rows if r[1] in top_cps
    ]
    return {"year": year, "months": [int(m) for m in months], "data": data}


@router.get("/sales/top_change")
def get_pl_sales_top_change(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    top_n: int = Query(10),
    db: Session = Depends(get_db),
):
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)
    rows = db.execute(text(f"""
        SELECT counterparty,
               -ROUND(SUM(CASE WHEN {cur_filter} THEN signed_amount ELSE 0 END),0) AS cur,
               -ROUND(SUM(CASE WHEN {pri_filter} THEN signed_amount ELSE 0 END),0) AS pri
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL
        GROUP BY counterparty
    """)).fetchall()

    items = [{"counterparty": r[0], "current": float(r[1] or 0), "prior": float(r[2] or 0),
              "change": float(r[1] or 0) - float(r[2] or 0)} for r in rows]
    increased = sorted([x for x in items if x["change"] > 0], key=lambda x: -x["change"])[:top_n]
    decreased = sorted([x for x in items if x["change"] < 0], key=lambda x: x["change"])[:top_n]
    return {"increased": increased, "decreased": decreased}


@router.get("/sales/counterparty_list")
def get_pl_sales_counterparty_list(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    cur_filter = _build_ym_filter(base_ym, period_type)
    rows = db.execute(text(f"""
        SELECT counterparty, -ROUND(SUM(signed_amount),0) AS cur
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL AND {cur_filter}
        GROUP BY counterparty ORDER BY cur DESC
    """)).fetchall()
    return [r[0] for r in rows]


@router.get("/sales/counterparty_trend")
def get_pl_sales_counterparty_trend(
    base_ym: str = Query(...),
    cp1: str = Query(None),
    cp2: str = Query(None),
    db: Session = Depends(get_db),
):
    year = base_ym.split("-")[0]
    pri_year = str(int(year) - 1)
    results: dict = {}
    for label, cp in [("cp1", cp1), ("cp2", cp2)]:
        if not cp:
            results[label] = []
            results[f"{label}_prior"] = []
            continue
        rows = db.execute(text("""
            SELECT substr(year_month,6,2) AS mo,
                   -ROUND(SUM(CASE WHEN substr(year_month,1,4)=:yr  THEN signed_amount ELSE 0 END),0) AS cur,
                   -ROUND(SUM(CASE WHEN substr(year_month,1,4)=:pr  THEN signed_amount ELSE 0 END),0) AS pri
            FROM je WHERE disclosure_acct='매출액' AND counterparty=:cp
              AND (substr(year_month,1,4)=:yr OR substr(year_month,1,4)=:pr)
            GROUP BY mo ORDER BY mo
        """), {"cp": cp, "yr": year, "pr": pri_year}).fetchall()
        results[label]            = [{"month": int(r[0]), "amount": float(r[1] or 0)} for r in rows]
        results[f"{label}_prior"] = [{"month": int(r[0]), "amount": float(r[2] or 0)} for r in rows]
    return results


@router.get("/sales/vouchers")
def get_pl_sales_vouchers(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    cur_filter = _build_ym_filter(base_ym, period_type)
    pri_filter = _build_ym_filter(base_ym, period_type, year_offset=-1)

    def fetch(f):
        rows = db.execute(text(f"""
            SELECT date, voucher_no, counterparty, description, amount, dr_cr
            FROM je WHERE disclosure_acct='매출액' AND {f}
            ORDER BY date DESC, voucher_no LIMIT 500
        """)).fetchall()
        return [{"date": str(r[0]), "voucher_no": r[1], "counterparty": r[2],
                 "description": r[3], "amount": float(r[4] or 0), "dr_cr": r[5]} for r in rows]

    return {"current": fetch(cur_filter), "prior": fetch(pri_filter)}


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


@router.get("/items/table")
def get_pl_items_table(
    base_ym: str = Query(...),
    view_type: str = Query("quarter"),  # month | quarter | year
    level: str = Query("mgmt"),          # disclosure | mgmt | account
    db: Session = Depends(get_db),
):
    """손익계산서 테이블 — 월/분기/연도별 컬럼
    - disclosure: 공시용계정까지
    - mgmt: 공시용계정 + 관리계정 (기본)
    - account: 공시 + 관리 + 계정과목(account_name) 3단계
    """

    DISCLOSURE_ORDER = [
        "매출액", "제조원가", "매출원가", "판매비와관리비",
        "기타수익", "기타비용", "금융수익", "금융비용", "법인세비용",
    ]
    INCOME_ACCT = {"매출액", "기타수익", "금융수익"}
    SUBTOTALS = {
        "매출총이익":  (["매출액"], ["제조원가", "매출원가"]),
        "당기순이익": (["매출액", "기타수익", "금융수익"],
                      ["제조원가", "매출원가", "판매비와관리비",
                       "기타비용", "금융비용", "법인세비용"]),
    }

    base_year = int(base_ym[:4])

    # 컬럼 정의
    if view_type == "month":
        cols = [(base_year - 1, m) for m in range(1, 13)] + [(base_year, m) for m in range(1, 13)]
        col_filter = lambda y, m: f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)='{m:02d}'"
        col_label  = lambda y, m: f"{y % 100}/{m}월"
    elif view_type == "year":
        cols = [(base_year - 1, 0), (base_year, 0)]
        col_filter = lambda y, _: f"substr(year_month,1,4)='{y}'"
        col_label  = lambda y, _: f"{y}년"
    else:  # quarter
        cols = [(base_year - 1, q) for q in range(1, 5)] + [(base_year, q) for q in range(1, 5)]
        def col_filter(y, q):
            m1, m2, m3 = (q-1)*3+1, (q-1)*3+2, q*3
            return (f"substr(year_month,1,4)='{y}' AND "
                    f"substr(year_month,6,2) IN ('{m1:02d}','{m2:02d}','{m3:02d}')")
        col_label = lambda y, q: f"{y % 100}/Q{q}"

    col_labels = [col_label(y, p) for y, p in cols]

    # 원시 집계: disclosure_acct, mgmt_acct, (account_name), 컬럼별 합계
    case_parts = ", ".join(
        f"-ROUND(SUM(CASE WHEN {col_filter(y,p)} THEN signed_amount ELSE 0 END),0) AS c{i}"
        for i, (y, p) in enumerate(cols)
    )
    include_account = (level == "account")
    select_cols = "disclosure_acct, mgmt_acct"
    group_cols = "disclosure_acct, mgmt_acct"
    order_cols = "disclosure_acct, mgmt_acct"
    if include_account:
        select_cols += ", account_name"
        group_cols += ", account_name"
        order_cols += ", account_name"

    rows = db.execute(text(f"""
        SELECT {select_cols}, {case_parts}
        FROM je WHERE section='PL'
        GROUP BY {group_cols}
        ORDER BY {order_cols}
    """)).fetchall()

    # disclosure_acct → sign
    sign_map = {}
    for r in rows:
        da = r[0]
        if da not in sign_map:
            sign_map[da] = 1 if da in INCOME_ACCT else -1

    # 집계: {disclosure_acct: {mgmt_acct: {account_name: [col값...]}}}
    from collections import defaultdict
    da_mgmt_acct: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0.0] * len(cols))))
    da_mgmt: dict = defaultdict(lambda: defaultdict(lambda: [0.0] * len(cols)))
    da_total: dict = defaultdict(lambda: [0.0] * len(cols))

    val_start = 3 if include_account else 2
    for r in rows:
        da, ma = r[0], r[1]
        an = r[2] if include_account else None
        sgn = sign_map.get(da, -1)
        for i in range(len(cols)):
            val = float(r[val_start + i] or 0) * sgn
            if include_account:
                da_mgmt_acct[da][ma][an][i] += val
            da_mgmt[da][ma][i] += val
            da_total[da][i]    += val

    # 소계 계산
    def subtotal_vals(add_accts, sub_accts):
        result = [0.0] * len(cols)
        for da in add_accts:
            for i in range(len(cols)):
                result[i] += da_total.get(da, [0.0]*len(cols))[i]
        for da in sub_accts:
            for i in range(len(cols)):
                result[i] -= da_total.get(da, [0.0]*len(cols))[i]
        return result

    # 결과 조립
    result_rows = []
    for da in DISCLOSURE_ORDER:
        if da not in da_total:
            continue
        # 소계 헤더 삽입 위치
        if da == "기타수익":
            result_rows.append({"type": "subtotal", "label": "매출총이익",
                                 "values": subtotal_vals(["매출액"], ["제조원가", "매출원가"])})
        if da == "법인세비용":
            result_rows.append({"type": "subtotal", "label": "영업이익",
                                 "values": subtotal_vals(
                                     ["매출액", "기타수익"],
                                     ["제조원가", "매출원가", "판매비와관리비", "기타비용"])})

        result_rows.append({"type": "disclosure", "label": da,
                             "values": [round(v) for v in da_total[da]]})
        if level == "disclosure":
            continue  # 공시용계정만 요청 시 하위 생략
        for ma, vals in sorted(da_mgmt[da].items()):
            result_rows.append({"type": "mgmt", "label": ma,
                                 "values": [round(v) for v in vals]})
            if include_account:
                # 관리계정 하위의 계정과목(account_name) 행 삽입
                for an, avals in sorted(da_mgmt_acct[da][ma].items()):
                    result_rows.append({"type": "account", "label": an or "(미지정)",
                                         "values": [round(v) for v in avals]})

    # 맨 마지막 당기순이익
    result_rows.append({"type": "subtotal", "label": "당기순이익",
                         "values": [round(v) for v in subtotal_vals(
                             ["매출액", "기타수익", "금융수익"],
                             ["제조원가", "매출원가", "판매비와관리비",
                              "기타비용", "금융비용", "법인세비용"])]})

    return {"columns": col_labels, "rows": result_rows}
