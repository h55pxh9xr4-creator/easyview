from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import Optional

router = APIRouter()


def _period_filter(base_ym: str, period_type: str) -> tuple[str, str]:
    """기준연월과 기간타입으로 year, month 반환"""
    year, month = base_ym.split("-")
    return year, month


def _je_sum(db, base_ym: str, period_type: str, disclosure_acct: str,
            section: str = "PL", year_offset: int = 0) -> float:
    """특정 공시용계정의 금액합계(반) = -SUM(signed_amount) 계산"""
    year, month = base_ym.split("-")
    y = int(year) + year_offset

    if period_type == "monthly":
        where = f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)='{month}'"
    else:  # cumulative
        where = f"substr(year_month,1,4)='{y}' AND substr(year_month,6,2)<='{month}'"

    row = db.execute(text(f"""
        SELECT -ROUND(SUM(signed_amount), 0)
        FROM je
        WHERE section='{section}' AND disclosure_acct='{disclosure_acct}'
        AND {where}
    """)).fetchone()
    return float(row[0] or 0)


@router.get("/kpi")
def get_kpi(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    compare_target: str = Query("prev_year_cum"),
    bs_base: str = Query("year_start"),
    db: Session = Depends(get_db),
):
    # PL KPI
    rev_cur = _je_sum(db, base_ym, period_type, "매출액")
    rev_pri = _je_sum(db, base_ym, period_type, "매출액", year_offset=-1)
    cogs_cur = -_je_sum(db, base_ym, period_type, "매출원가")      # 비용: 부호 반전
    판관비_cur = -_je_sum(db, base_ym, period_type, "판매비와관리비")
    기타수익_cur = _je_sum(db, base_ym, period_type, "기타수익")
    기타비용_cur = -_je_sum(db, base_ym, period_type, "기타비용")
    금융수익_cur = _je_sum(db, base_ym, period_type, "금융수익")
    금융비용_cur = -_je_sum(db, base_ym, period_type, "금융비용")
    법인세_cur = -_je_sum(db, base_ym, period_type, "법인세비용")

    op_inc_cur = rev_cur - cogs_cur - 판관비_cur + 기타수익_cur - 기타비용_cur
    net_inc_cur = op_inc_cur + 금융수익_cur - 금융비용_cur + 법인세_cur

    cogs_pri = -_je_sum(db, base_ym, period_type, "매출원가", year_offset=-1)
    판관비_pri = -_je_sum(db, base_ym, period_type, "판매비와관리비", year_offset=-1)
    기타수익_pri = _je_sum(db, base_ym, period_type, "기타수익", year_offset=-1)
    기타비용_pri = -_je_sum(db, base_ym, period_type, "기타비용", year_offset=-1)
    금융수익_pri = _je_sum(db, base_ym, period_type, "금융수익", year_offset=-1)
    금융비용_pri = -_je_sum(db, base_ym, period_type, "금융비용", year_offset=-1)
    법인세_pri = -_je_sum(db, base_ym, period_type, "법인세비용", year_offset=-1)

    op_inc_pri = rev_pri - cogs_pri - 판관비_pri + 기타수익_pri - 기타비용_pri
    net_inc_pri = op_inc_pri + 금융수익_pri - 금융비용_pri + 법인세_pri

    # BS KPI (자산/부채 기말잔액)
    year = base_ym.split("-")[0]
    month = base_ym.split("-")[1]
    bs_row = db.execute(text(f"""
        SELECT
            SUM(CASE WHEN t.category='자산' THEN (t.opening_signed + COALESCE(je_cum.net,0))
                     ELSE 0 END) AS 자산기말,
            SUM(CASE WHEN t.category='부채' THEN -(t.opening_signed + COALESCE(je_cum.net,0))
                     ELSE 0 END) AS 부채기말,
            SUM(CASE WHEN t.category='자산' THEN t.opening_balance ELSE 0 END) AS 자산기초,
            SUM(CASE WHEN t.category='부채' THEN t.opening_balance ELSE 0 END) AS 부채기초
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net
            FROM je
            WHERE section='BS'
            AND substr(year_month,1,4)='{year}'
            AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) je_cum ON t.account_code = je_cum.account_code
    """)).fetchone()

    asset_end = float(bs_row[0] or 0)
    liab_end = float(bs_row[1] or 0)
    asset_open = float(bs_row[2] or 0)
    liab_open = float(bs_row[3] or 0)

    def pct(cur, pri):
        if pri == 0:
            return 0.0
        return round((cur - pri) / abs(pri), 4)

    return {
        "revenue":          {"value": rev_cur,    "prior": rev_pri,    "change_pct": pct(rev_cur, rev_pri),    "vs": "vs 전기"},
        "operating_income": {"value": op_inc_cur, "prior": op_inc_pri, "change_pct": pct(op_inc_cur, op_inc_pri), "vs": "vs 전기"},
        "asset":            {"value": asset_end,  "prior": asset_open, "change_pct": pct(asset_end, asset_open),  "vs": "vs 기초"},
        "liability":        {"value": liab_end,   "prior": liab_open,  "change_pct": pct(liab_end, liab_open),   "vs": "vs 기초"},
    }


@router.get("/pl_table")
def get_pl_table(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    accounts = [
        ("매출액",         "수익"), ("매출원가",       "비용"),
        ("판매비와관리비",  "비용"), ("기타수익",       "수익"),
        ("기타비용",        "비용"), ("금융수익",       "수익"),
        ("금융비용",        "비용"), ("법인세비용",     "비용"),
    ]
    rows = []
    for acct, cls in accounts:
        sign = 1 if cls == "수익" else -1
        cur = _je_sum(db, base_ym, period_type, acct) * sign
        pri = _je_sum(db, base_ym, period_type, acct, year_offset=-1) * sign
        chg = round((cur - pri) / abs(pri), 4) if pri != 0 else 0.0
        rows.append({"account": acct, "current": cur, "prior": pri, "change_pct": chg, "is_subtotal": False})

    # 당기손익 합산
    net_cur = sum(r["current"] * (1 if r["account"] in {"매출액","기타수익","금융수익"} else -1)
                  if False else r["current"] for r in rows)
    net_pri = sum(r["prior"] for r in rows)
    rows.append({"account": "당기손익", "current": net_cur, "prior": net_pri,
                 "change_pct": round((net_cur-net_pri)/abs(net_pri),4) if net_pri else 0,
                 "is_subtotal": True})
    return rows


@router.get("/bs_table")
def get_bs_table(
    base_ym: str = Query(...),
    bs_base: str = Query("year_start"),
    db: Session = Depends(get_db),
):
    year, month = base_ym.split("-")
    rows = db.execute(text(f"""
        SELECT
            t.category, t.sum_acct,
            (t.opening_signed + COALESCE(je_cum.net,0)) *
                CASE t.category WHEN '자산' THEN 1 ELSE -1 END AS ending,
            t.opening_balance AS opening,
            t.opening_signed
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net
            FROM je WHERE section='BS'
            AND substr(year_month,1,4)='{year}'
            AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) je_cum ON t.account_code = je_cum.account_code
        ORDER BY t.category, t.sum_acct
    """)).fetchall()

    # 합산계정별 집계
    from collections import defaultdict
    by_sum = defaultdict(lambda: {"ending": 0, "opening": 0, "category": ""})
    for r in rows:
        key = r[1]  # sum_acct
        by_sum[key]["ending"] += float(r[2] or 0)
        by_sum[key]["opening"] += float(r[3] or 0)
        by_sum[key]["category"] = r[0]

    # 대분류(자산/부채/자본) 집계
    by_cat = defaultdict(lambda: {"ending": 0, "opening": 0})
    for key, v in by_sum.items():
        by_cat[v["category"]]["ending"] += v["ending"]
        by_cat[v["category"]]["opening"] += v["opening"]

    result = []
    for cat in ["자산", "부채", "자본"]:
        c = by_cat[cat]
        chg = round((c["ending"]-c["opening"])/abs(c["opening"]), 4) if c["opening"] else 0
        result.append({"account": cat, "current": c["ending"], "prior": c["opening"],
                       "change_pct": chg, "indent": 0})
        for key, v in by_sum.items():
            if v["category"] == cat:
                chg2 = round((v["ending"]-v["opening"])/abs(v["opening"]), 4) if v["opening"] else 0
                result.append({"account": key, "current": v["ending"], "prior": v["opening"],
                                "change_pct": chg2, "indent": 1})
    return result


@router.get("/indicators")
def get_indicators(
    base_ym: str = Query(...),
    period_type: str = Query("cumulative"),
    db: Session = Depends(get_db),
):
    rev = _je_sum(db, base_ym, period_type, "매출액")
    cogs = -_je_sum(db, base_ym, period_type, "매출원가")
    판관비 = -_je_sum(db, base_ym, period_type, "판매비와관리비")
    기타수익 = _je_sum(db, base_ym, period_type, "기타수익")
    기타비용 = -_je_sum(db, base_ym, period_type, "기타비용")
    금융수익 = _je_sum(db, base_ym, period_type, "금융수익")
    금융비용 = -_je_sum(db, base_ym, period_type, "금융비용")
    법인세 = -_je_sum(db, base_ym, period_type, "법인세비용")

    gross = rev - cogs
    op_inc = gross - 판관비 + 기타수익 - 기타비용
    net_inc = op_inc + 금융수익 - 금융비용 + 법인세

    year, month = base_ym.split("-")
    bs = db.execute(text(f"""
        SELECT
            SUM(CASE WHEN t.sum_acct='유동자산' THEN (t.opening_signed+COALESCE(j.net,0)) ELSE 0 END) AS 유동자산,
            SUM(CASE WHEN t.sum_acct='유동부채' THEN -(t.opening_signed+COALESCE(j.net,0)) ELSE 0 END) AS 유동부채,
            SUM(CASE WHEN t.category='부채' THEN -(t.opening_signed+COALESCE(j.net,0)) ELSE 0 END) AS 부채,
            SUM(CASE WHEN t.category='자본' THEN -(t.opening_signed+COALESCE(j.net,0)) ELSE 0 END) AS 자본
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
    """)).fetchone()

    유동자산 = float(bs[0] or 0)
    유동부채 = float(bs[1] or 0)
    부채 = float(bs[2] or 0)
    자본 = float(bs[3] or 0)

    def safe_div(a, b): return round(a / b, 4) if b else 0.0

    return {
        "pl": {
            "gross_profit_margin": safe_div(gross, rev),
            "operating_margin":    safe_div(op_inc, rev),
            "net_margin":          safe_div(net_inc, rev),
        },
        "bs": {
            "current_ratio":  safe_div(유동자산, 유동부채),
            "debt_ratio":     safe_div(부채, 자본),
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
        ym_filter = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
        ym_filter_pri = f"substr(year_month,1,4)='{int(year)-1}' AND substr(year_month,6,2)='{month}'"
    else:
        ym_filter = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
        ym_filter_pri = f"substr(year_month,1,4)='{int(year)-1}' AND substr(year_month,6,2)<='{month}'"

    # 매출 거래처 Top3 (전기 대비 증감 상위)
    rev_top3 = db.execute(text(f"""
        SELECT counterparty,
               SUM(CASE WHEN {ym_filter} THEN -signed_amount ELSE 0 END) AS cur,
               SUM(CASE WHEN {ym_filter_pri} THEN -signed_amount ELSE 0 END) AS pri
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL
        GROUP BY counterparty
        ORDER BY (SUM(CASE WHEN {ym_filter} THEN -signed_amount ELSE 0 END)
                - SUM(CASE WHEN {ym_filter_pri} THEN -signed_amount ELSE 0 END)) DESC
        LIMIT 3
    """)).fetchall()

    # 비용 계정 Top3 (전기 대비 증감 상위)
    cost_top3 = db.execute(text(f"""
        SELECT mgmt_acct,
               SUM(CASE WHEN {ym_filter} THEN signed_amount ELSE 0 END) AS cur,
               SUM(CASE WHEN {ym_filter_pri} THEN signed_amount ELSE 0 END) AS pri
        FROM je WHERE section='PL' AND category='비용' AND mgmt_acct IS NOT NULL
        GROUP BY mgmt_acct
        ORDER BY (SUM(CASE WHEN {ym_filter} THEN signed_amount ELSE 0 END)
                - SUM(CASE WHEN {ym_filter_pri} THEN signed_amount ELSE 0 END)) DESC
        LIMIT 3
    """)).fetchall()

    # BS 자산/부채 증감 Top3
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

    def to_top3(rows, value_col_idx=1, prior_col_idx=2):
        items = [{"name": r[0], "value": float(r[value_col_idx] or 0),
                  "change": float(r[value_col_idx] or 0) - float(r[prior_col_idx] or 0)}
                 for r in rows]
        max_val = max((i["change"] for i in items), default=1)
        return [{"rank": i+1, "name": v["name"],
                 "value": v["change"],
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
    year, month = base_ym.split("-")
    ym = base_ym

    # SC1: 동일연월+계정코드+차대+금액 조합 2회 이상
    sc1 = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT year_month, account_code, dr_cr, amount, COUNT(*) AS cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY year_month, account_code, dr_cr, amount
            HAVING cnt >= 2
        )
    """)).scalar() or 0

    # SC2: 동일연월+금액에서 현금대변 + 부채대변(월말) 동시 존재
    sc2 = db.execute(text(f"""
        SELECT COUNT(DISTINCT amount) FROM (
            SELECT amount,
                SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) AS cash_cnt,
                SUM(CASE WHEN category='부채' AND dr_cr='대변' THEN 1 ELSE 0 END) AS debt_cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY amount
            HAVING cash_cnt>0 AND debt_cnt>0
        )
    """)).scalar() or 0

    # SC3: 주말 + 현금 대변
    sc3 = db.execute(text(f"""
        SELECT COUNT(DISTINCT voucher_no) FROM je
        WHERE year_month='{ym}' AND is_weekend=1 AND is_cash=1 AND dr_cr='대변'
    """)).scalar() or 0

    # SC4: 현금 대변 + 금액 >= 1,000,000
    sc4 = db.execute(text(f"""
        SELECT COUNT(DISTINCT voucher_no) FROM je
        WHERE year_month='{ym}' AND is_cash=1 AND dr_cr='대변' AND amount >= 1000000
    """)).scalar() or 0

    # SC5: 동일전표 내 비용차변 + 현금대변
    sc5 = db.execute(text(f"""
        SELECT COUNT(DISTINCT voucher_no) FROM (
            SELECT voucher_no,
                SUM(CASE WHEN category='비용' AND dr_cr='차변' THEN 1 ELSE 0 END) AS cost_cnt,
                SUM(CASE WHEN is_cash=1 AND dr_cr='대변' THEN 1 ELSE 0 END) AS cash_cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY voucher_no
            HAVING cost_cnt>0 AND cash_cnt>0
        )
    """)).scalar() or 0

    # SC6: 전체 기간 거래처 전표건수 <= 10
    sc6 = db.execute(text(f"""
        SELECT COUNT(DISTINCT counterparty) FROM (
            SELECT counterparty, COUNT(DISTINCT voucher_no) AS cnt
            FROM je WHERE counterparty IS NOT NULL
            GROUP BY counterparty HAVING cnt <= 10
        )
    """)).scalar() or 0

    return {"sc1": int(sc1), "sc2": int(sc2), "sc3": int(sc3),
            "sc4": int(sc4), "sc5": int(sc5), "sc6": int(sc6)}
