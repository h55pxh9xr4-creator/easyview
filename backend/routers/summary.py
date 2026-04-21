from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter()


def _je_sum_ym(db, base_ym: str, period_type: str, disclosure_acct: str, section: str = "PL") -> float:
    """base_ym을 직접 받아 금액 합계 반환"""
    year, month = base_ym.split("-")
    if period_type == "monthly":
        where = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
    else:
        where = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
    row = db.execute(text(f"""
        SELECT -ROUND(SUM(signed_amount), 0)
        FROM je
        WHERE section='{section}' AND disclosure_acct='{disclosure_acct}'
        AND {where}
    """)).fetchone()
    return float(row[0] or 0)


def _je_sum(db, base_ym: str, period_type: str, disclosure_acct: str,
            section: str = "PL", year_offset: int = 0) -> float:
    year, month = base_ym.split("-")
    y = int(year) + year_offset
    if period_type == "monthly":
        where = f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)='{month}'"
    else:
        where = f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)<='{month}'"
    row = db.execute(text(f"""
        SELECT -ROUND(SUM(signed_amount), 0)
        FROM je
        WHERE section='{section}' AND disclosure_acct='{disclosure_acct}'
        AND {where}
    """)).fetchone()
    return float(row[0] or 0)


def _prior_ym_pt(base_ym: str, period_type: str, compare_target: str) -> tuple[str, str]:
    """compare_target에 따른 비교기준 연월·기간타입 반환"""
    year, month = int(base_ym.split("-")[0]), int(base_ym.split("-")[1])
    if compare_target == "prev_year_cum":
        return f"{year - 1}-{month:02d}", "cumulative"
    elif compare_target == "prev_year_month":
        return f"{year - 1}-{month:02d}", "monthly"
    elif compare_target == "prev_month":
        pm, py = month - 1, year
        if pm == 0:
            pm, py = 12, year - 1
        return f"{py}-{pm:02d}", "monthly"
    elif compare_target == "prev_month_cum":
        # 전년도 전월까지 누적: 2024.01~08
        pm, py = month - 1, year - 1
        if pm == 0:
            pm, py = 12, py - 1
        return f"{py}-{pm:02d}", "cumulative"
    return f"{year - 1}-{month:02d}", "cumulative"


def _vs_label(compare_target: str, period_type: str = "cumulative") -> str:
    return {
        "prev_year_cum":   "vs 전년누적",
        "prev_year_month": "vs 전년동월",
        "prev_month":      "vs 전월",
        "prev_month_cum":  "vs 전월누적",
    }.get(compare_target, "vs 전기")


def _bs_vs_label(bs_base: str) -> str:
    return "vs 기초" if bs_base == "year_start" else "vs 월초"


def _bs_prior_ym(base_ym: str, bs_base: str) -> str | None:
    """bs_base == month_start 일 때 전월 연월 반환, year_start 이면 None(opening_balance 사용)"""
    if bs_base == "year_start":
        return None
    year, month = int(base_ym.split("-")[0]), int(base_ym.split("-")[1])
    pm, py = month - 1, year
    if pm == 0:
        pm, py = 12, year - 1
    return f"{py}-{pm:02d}"


@router.get("/kpi")
def get_kpi(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    compare_target: str = Query("prev_year_cum"),
    bs_base: str = Query("year_start"),
    db: Session = Depends(get_db),
):
    prior_ym, prior_pt = _prior_ym_pt(base_ym, period_type, compare_target)
    vs = _vs_label(compare_target)

    def cur(acct): return _je_sum_ym(db, base_ym, period_type, acct)
    def pri(acct): return _je_sum_ym(db, prior_ym, prior_pt, acct)

    rev_c  = cur("매출액");   rev_p  = pri("매출액")
    cogs_c = -cur("매출원가"); cogs_p = -pri("매출원가")
    sga_c  = -cur("판매비와관리비"); sga_p = -pri("판매비와관리비")
    oth_r_c = cur("기타수익"); oth_r_p = pri("기타수익")
    oth_e_c = -cur("기타비용"); oth_e_p = -pri("기타비용")
    fin_r_c = cur("금융수익"); fin_r_p = pri("금융수익")
    fin_e_c = -cur("금융비용"); fin_e_p = -pri("금융비용")
    tax_c  = -cur("법인세비용"); tax_p = -pri("법인세비용")

    op_c = rev_c + cogs_c + sga_c + oth_r_c + oth_e_c
    op_p = rev_p + cogs_p + sga_p + oth_r_p + oth_e_p
    net_c = op_c + fin_r_c + fin_e_c + tax_c
    net_p = op_p + fin_r_p + fin_e_p + tax_p

    def pct(c, p): return round((c - p) / abs(p), 4) if p else 0.0

    # BS KPI
    year, month = base_ym.split("-")
    prior_bs_ym = _bs_prior_ym(base_ym, bs_base)
    bs_vs = _bs_vs_label(bs_base)

    # 기말잔액
    bs_end = db.execute(text(f"""
        SELECT
            SUM(CASE WHEN t.category='자산' THEN  (t.opening_signed + COALESCE(je.net,0)) ELSE 0 END),
            SUM(CASE WHEN t.category='부채' THEN -(t.opening_signed + COALESCE(je.net,0)) ELSE 0 END)
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) je ON t.account_code=je.account_code
    """)).fetchone()
    asset_end = float(bs_end[0] or 0)
    liab_end  = float(bs_end[1] or 0)

    if prior_bs_ym is None:
        # year_start: opening_balance
        bs_open = db.execute(text("""
            SELECT
                SUM(CASE WHEN category='자산' THEN opening_balance ELSE 0 END),
                SUM(CASE WHEN category='부채' THEN opening_balance ELSE 0 END)
            FROM tb_account
        """)).fetchone()
        asset_open = float(bs_open[0] or 0)
        liab_open  = float(bs_open[1] or 0)
    else:
        py, pm = prior_bs_ym.split("-")
        bs_prior = db.execute(text(f"""
            SELECT
                SUM(CASE WHEN t.category='자산' THEN  (t.opening_signed + COALESCE(je.net,0)) ELSE 0 END),
                SUM(CASE WHEN t.category='부채' THEN -(t.opening_signed + COALESCE(je.net,0)) ELSE 0 END)
            FROM tb_account t
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{py}' AND substr(year_month,6,2)<='{pm}'
                GROUP BY account_code
            ) je ON t.account_code=je.account_code
        """)).fetchone()
        asset_open = float(bs_prior[0] or 0)
        liab_open  = float(bs_prior[1] or 0)

    return {
        "revenue":          {"value": rev_c,  "prior": rev_p,  "change_pct": pct(rev_c, rev_p),   "vs": vs},
        "operating_income": {"value": op_c,   "prior": op_p,   "change_pct": pct(op_c, op_p),     "vs": vs},
        "asset":            {"value": asset_end, "prior": asset_open, "change_pct": pct(asset_end, asset_open), "vs": bs_vs},
        "liability":        {"value": liab_end,  "prior": liab_open,  "change_pct": pct(liab_end, liab_open),  "vs": bs_vs},
    }


@router.get("/pl_table")
def get_pl_table(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    compare_target: str = Query("prev_year_cum"),
    db: Session = Depends(get_db),
):
    prior_ym, prior_pt = _prior_ym_pt(base_ym, period_type, compare_target)

    accounts = [
        ("매출액",         "수익"), ("매출원가",       "비용"),
        ("판매비와관리비",  "비용"), ("기타수익",       "수익"),
        ("기타비용",        "비용"), ("금융수익",       "수익"),
        ("금융비용",        "비용"), ("법인세비용",     "비용"),
    ]
    rows = []
    for acct, cls in accounts:
        sign = 1 if cls == "수익" else -1
        cur = _je_sum_ym(db, base_ym, period_type, acct) * sign
        pri = _je_sum_ym(db, prior_ym, prior_pt, acct) * sign
        chg = round((cur - pri) / abs(pri), 4) if pri != 0 else 0.0
        rows.append({"account": acct, "current": cur, "prior": pri, "change_pct": chg, "is_subtotal": False})

    net_cur = sum(r["current"] for r in rows)
    net_pri = sum(r["prior"] for r in rows)
    rows.append({"account": "당기손익", "current": net_cur, "prior": net_pri,
                 "change_pct": round((net_cur - net_pri) / abs(net_pri), 4) if net_pri else 0,
                 "is_subtotal": True})
    return rows


@router.get("/bs_table")
def get_bs_table(
    base_ym: str = Query(...),
    bs_base: str = Query("year_start"),
    db: Session = Depends(get_db),
):
    year, month = base_ym.split("-")
    prior_bs_ym = _bs_prior_ym(base_ym, bs_base)

    # 기말잔액 계산용 JE 누적
    end_join = f"""
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) je_cur ON t.account_code=je_cur.account_code
    """

    if prior_bs_ym is None:
        # year_start: opening_balance 사용
        rows = db.execute(text(f"""
            SELECT
                t.category, t.sum_acct,
                (t.opening_signed + COALESCE(je_cur.net,0)) *
                    CASE t.category WHEN '자산' THEN 1 ELSE -1 END AS ending,
                t.opening_balance AS opening
            FROM tb_account t
            {end_join}
            ORDER BY t.category, t.sum_acct
        """)).fetchall()
    else:
        py, pm = prior_bs_ym.split("-")
        rows = db.execute(text(f"""
            SELECT
                t.category, t.sum_acct,
                (t.opening_signed + COALESCE(je_cur.net,0)) *
                    CASE t.category WHEN '자산' THEN 1 ELSE -1 END AS ending,
                (t.opening_signed + COALESCE(je_pri.net,0)) *
                    CASE t.category WHEN '자산' THEN 1 ELSE -1 END AS opening
            FROM tb_account t
            {end_join}
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{py}' AND substr(year_month,6,2)<='{pm}'
                GROUP BY account_code
            ) je_pri ON t.account_code=je_pri.account_code
            ORDER BY t.category, t.sum_acct
        """)).fetchall()

    from collections import defaultdict
    by_sum = defaultdict(lambda: {"ending": 0.0, "opening": 0.0, "category": ""})
    for r in rows:
        key = r[1]
        by_sum[key]["ending"]   += float(r[2] or 0)
        by_sum[key]["opening"]  += float(r[3] or 0)
        by_sum[key]["category"] = r[0]

    by_cat = defaultdict(lambda: {"ending": 0.0, "opening": 0.0})
    for key, v in by_sum.items():
        by_cat[v["category"]]["ending"]  += v["ending"]
        by_cat[v["category"]]["opening"] += v["opening"]

    result = []
    for cat in ["자산", "부채", "자본"]:
        c = by_cat[cat]
        chg = round((c["ending"] - c["opening"]) / abs(c["opening"]), 4) if c["opening"] else 0
        result.append({"account": cat, "current": c["ending"], "prior": c["opening"],
                       "change_pct": chg, "indent": 0})
        for key, v in by_sum.items():
            if v["category"] == cat:
                chg2 = round((v["ending"] - v["opening"]) / abs(v["opening"]), 4) if v["opening"] else 0
                result.append({"account": key, "current": v["ending"], "prior": v["opening"],
                                "change_pct": chg2, "indent": 1})
    return result


@router.get("/indicators")
def get_indicators(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    compare_target: str = Query("prev_year_cum"),
    db: Session = Depends(get_db),
):
    def s(acct): return _je_sum_ym(db, base_ym, period_type, acct)

    rev   = s("매출액")
    cogs  = -s("매출원가")
    sga   = -s("판매비와관리비")
    oth_r = s("기타수익")
    oth_e = -s("기타비용")
    fin_r = s("금융수익")
    fin_e = -s("금융비용")
    tax   = -s("법인세비용")

    gross  = rev + cogs
    op_inc = gross + sga + oth_r + oth_e
    net_inc = op_inc + fin_r + fin_e + tax

    year, month = base_ym.split("-")
    bs = db.execute(text(f"""
        SELECT
            SUM(CASE WHEN t.sum_acct='유동자산' THEN  (t.opening_signed+COALESCE(j.net,0)) ELSE 0 END),
            SUM(CASE WHEN t.sum_acct='유동부채' THEN -(t.opening_signed+COALESCE(j.net,0)) ELSE 0 END),
            SUM(CASE WHEN t.category='부채'     THEN -(t.opening_signed+COALESCE(j.net,0)) ELSE 0 END),
            SUM(CASE WHEN t.category='자본'     THEN -(t.opening_signed+COALESCE(j.net,0)) ELSE 0 END)
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
    """)).fetchone()

    유동자산 = float(bs[0] or 0)
    유동부채 = float(bs[1] or 0)
    부채     = float(bs[2] or 0)
    자본     = float(bs[3] or 0)

    def safe_div(a, b): return round(a / b, 4) if b else 0.0

    return {
        "pl": {
            "gross_profit_margin": safe_div(gross,  rev),
            "operating_margin":    safe_div(op_inc, rev),
            "net_margin":          safe_div(net_inc, rev),
        },
        "bs": {
            "current_ratio": safe_div(유동자산, 유동부채),
            "debt_ratio":    safe_div(부채, 자본),
        }
    }


@router.get("/top3")
def get_top3(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    year, month = base_ym.split("-")
    if period_type == "monthly":
        ym_filter     = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
        ym_filter_pri = f"substr(year_month,1,4)='{int(year)-1}' AND substr(year_month,6,2)='{month}'"
    else:
        ym_filter     = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
        ym_filter_pri = f"substr(year_month,1,4)='{int(year)-1}' AND substr(year_month,6,2)<='{month}'"

    rev_top3 = db.execute(text(f"""
        SELECT counterparty,
               SUM(CASE WHEN {ym_filter}     THEN -signed_amount ELSE 0 END) AS cur,
               SUM(CASE WHEN {ym_filter_pri} THEN -signed_amount ELSE 0 END) AS pri
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL
        GROUP BY counterparty
        ORDER BY (SUM(CASE WHEN {ym_filter} THEN -signed_amount ELSE 0 END)
                - SUM(CASE WHEN {ym_filter_pri} THEN -signed_amount ELSE 0 END)) DESC
        LIMIT 3
    """)).fetchall()

    cost_top3 = db.execute(text(f"""
        SELECT mgmt_acct,
               SUM(CASE WHEN {ym_filter}     THEN signed_amount ELSE 0 END) AS cur,
               SUM(CASE WHEN {ym_filter_pri} THEN signed_amount ELSE 0 END) AS pri
        FROM je WHERE section='PL' AND category='비용' AND mgmt_acct IS NOT NULL
        GROUP BY mgmt_acct
        ORDER BY (SUM(CASE WHEN {ym_filter} THEN signed_amount ELSE 0 END)
                - SUM(CASE WHEN {ym_filter_pri} THEN signed_amount ELSE 0 END)) DESC
        LIMIT 3
    """)).fetchall()

    asset_top3 = db.execute(text(f"""
        SELECT t.mgmt_acct,
               (t.opening_signed + COALESCE(je_cur.net,0)) AS ending,
               t.opening_balance AS opening
        FROM tb_account t
        LEFT JOIN (SELECT account_code, SUM(signed_amount) AS net FROM je
                   WHERE section='BS' AND {ym_filter} GROUP BY account_code) je_cur
            ON t.account_code=je_cur.account_code
        WHERE t.category='자산'
        ORDER BY ((t.opening_signed + COALESCE(je_cur.net,0)) - t.opening_signed) DESC
        LIMIT 3
    """)).fetchall()

    liab_top3 = db.execute(text(f"""
        SELECT t.mgmt_acct,
               -(t.opening_signed + COALESCE(je_cur.net,0)) AS ending,
               t.opening_balance AS opening
        FROM tb_account t
        LEFT JOIN (SELECT account_code, SUM(signed_amount) AS net FROM je
                   WHERE section='BS' AND {ym_filter} GROUP BY account_code) je_cur
            ON t.account_code=je_cur.account_code
        WHERE t.category='부채'
        ORDER BY (-(t.opening_signed + COALESCE(je_cur.net,0)) - t.opening_balance) DESC
        LIMIT 3
    """)).fetchall()

    def to_top3(rows):
        items = [{"name": r[0], "value": float(r[1] or 0),
                  "change": float(r[1] or 0) - float(r[2] or 0)} for r in rows]
        max_val = max((i["change"] for i in items), default=1)
        return [{"rank": i + 1, "name": v["name"], "value": v["change"],
                 "bar_pct": round(v["change"] / max_val * 100, 1) if max_val else 0}
                for i, v in enumerate(items)]

    return {
        "revenue_counterparty": to_top3(rev_top3),
        "cost_account":         to_top3(cost_top3),
        "asset_account":        to_top3(asset_top3),
        "liability_account":    to_top3(liab_top3),
    }


@router.get("/scenario_count")
def get_scenario_count(
    base_ym: str = Query(...),
    db: Session = Depends(get_db),
):
    ym = base_ym

    sc1 = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT year_month, account_code, dr_cr, amount, COUNT(*) AS cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY year_month, account_code, dr_cr, amount HAVING cnt >= 2
        )
    """)).scalar() or 0

    sc2 = db.execute(text(f"""
        SELECT COUNT(DISTINCT amount) FROM (
            SELECT amount,
                SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) AS cash_cnt,
                SUM(CASE WHEN category='부채' AND dr_cr='대변' THEN 1 ELSE 0 END) AS debt_cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY amount HAVING cash_cnt>0 AND debt_cnt>0
        )
    """)).scalar() or 0

    sc3 = db.execute(text(f"""
        SELECT COUNT(DISTINCT voucher_no) FROM je
        WHERE year_month='{ym}' AND is_weekend=1 AND is_cash=1 AND dr_cr='대변'
    """)).scalar() or 0

    sc4 = db.execute(text(f"""
        SELECT COUNT(DISTINCT voucher_no) FROM je
        WHERE year_month='{ym}' AND is_cash=1 AND dr_cr='대변' AND amount >= 1000000
    """)).scalar() or 0

    sc5 = db.execute(text(f"""
        SELECT COUNT(DISTINCT voucher_no) FROM (
            SELECT voucher_no,
                SUM(CASE WHEN category='비용' AND dr_cr='차변' THEN 1 ELSE 0 END) AS cost_cnt,
                SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) AS cash_cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY voucher_no HAVING cost_cnt>0 AND cash_cnt>0
        )
    """)).scalar() or 0

    sc6 = db.execute(text(f"""
        SELECT COUNT(DISTINCT counterparty) FROM (
            SELECT counterparty, COUNT(DISTINCT voucher_no) AS cnt
            FROM je WHERE counterparty IS NOT NULL
            GROUP BY counterparty HAVING cnt <= 10
        )
    """)).scalar() or 0

    return {"sc1": int(sc1), "sc2": int(sc2), "sc3": int(sc3),
            "sc4": int(sc4), "sc5": int(sc5), "sc6": int(sc6)}
