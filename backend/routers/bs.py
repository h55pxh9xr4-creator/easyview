from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from datetime import date as dt_date, timedelta

router = APIRouter()


def _ending_by_sum(db, year: str, month: str):
    """sum_acct별 기말잔액 반환: {sum_acct: float}"""
    rows = db.execute(text(f"""
        SELECT t.sum_acct,
               SUM((t.opening_signed + COALESCE(j.net,0)) *
                   CASE t.category WHEN '자산' THEN 1 ELSE -1 END) AS ending
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}'
            AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
        WHERE t.section='BS'
        GROUP BY t.sum_acct
    """)).fetchall()
    return {r[0]: float(r[1] or 0) for r in rows}


def _ending_by_cat(db, year: str, month: str):
    """category별 기말잔액"""
    rows = db.execute(text(f"""
        SELECT t.category,
               SUM((t.opening_signed + COALESCE(j.net,0)) *
                   CASE t.category WHEN '자산' THEN 1 ELSE -1 END) AS ending
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}'
            AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
        WHERE t.section='BS'
        GROUP BY t.category
    """)).fetchall()
    return {r[0]: float(r[1] or 0) for r in rows}


def _opening_by_cat(db):
    """기초잔액 category별 (tb_account.opening_signed 부호 적용)"""
    rows = db.execute(text("""
        SELECT category,
               SUM(opening_signed * CASE category WHEN '자산' THEN 1 ELSE -1 END)
        FROM tb_account WHERE section='BS'
        GROUP BY category
    """)).fetchall()
    return {r[0]: float(r[1] or 0) for r in rows}


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


@router.get("/kpi")
def get_bs_kpi(base_ym: str = Query(...), db: Session = Depends(get_db)):
    """자산/부채/자본 KPI — 기말/당기기초/당월기초"""
    year, month = base_ym.split("-")
    # 기말잔액
    ending = _ending_by_cat(db, year, month)
    # 당기기초 (year_start = tb_account.opening_signed 그대로)
    yr_start = _opening_by_cat(db)
    # 당월기초 = 전월말 기말
    pm = int(month) - 1
    py = int(year)
    if pm == 0:
        pm, py = 12, py - 1
    mo_start = _ending_by_cat(db, str(py), f"{pm:02d}")

    result = {}
    for cat in ["자산", "부채", "자본"]:
        end = ending.get(cat, 0)
        yrs = yr_start.get(cat, 0)
        mos = mo_start.get(cat, 0)
        result[cat] = {
            "ending": round(end),
            "yr_start": round(yrs),
            "yr_chg_pct": round((end - yrs) / abs(yrs), 4) if yrs else 0,
            "mo_start": round(mos),
            "mo_chg_pct": round((end - mos) / abs(mos), 4) if mos else 0,
        }
    return result


@router.get("/trend_detail")
def get_bs_trend_detail(base_ym: str = Query(...), db: Session = Depends(get_db)):
    """월별 유동자산/비유동자산/유동부채/비유동부채/자본 기말잔액 추이"""
    base_year = int(base_ym[:4])
    months = db.execute(text(f"""
        SELECT DISTINCT year_month FROM je WHERE section='BS'
        AND (substr(year_month,1,4)='{base_year-1}' OR
             (substr(year_month,1,4)='{base_year}' AND substr(year_month,6,2)<='{base_ym[5:]}'))
        ORDER BY year_month
    """)).fetchall()

    result = []
    for (ym,) in months:
        y, m = ym.split("-")
        s = _ending_by_sum(db, y, m)
        result.append({
            "year_month": ym,
            "유동자산":   round(s.get("유동자산",   0)),
            "비유동자산": round(s.get("비유동자산", 0)),
            "유동부채":   round(s.get("유동부채",   0)),
            "비유동부채": round(s.get("비유동부채", 0)),
            "자본":       round(s.get("자본",       0)),
        })
    return result


@router.get("/ratios")
def get_bs_ratios(base_ym: str = Query(...), db: Session = Depends(get_db)):
    """월별 유동비율/당좌비율/부채비율"""
    base_year = int(base_ym[:4])
    months = db.execute(text(f"""
        SELECT DISTINCT year_month FROM je WHERE section='BS'
        AND (substr(year_month,1,4)='{base_year-1}' OR
             (substr(year_month,1,4)='{base_year}' AND substr(year_month,6,2)<='{base_ym[5:]}'))
        ORDER BY year_month
    """)).fetchall()

    # 재고자산 관련 mgmt_acct
    INVENTORY = ("제품","원재료","재공품")

    result = []
    for (ym,) in months:
        y, m = ym.split("-")
        s = _ending_by_sum(db, y, m)
        cat = _ending_by_cat(db, y, m)

        # 재고자산 합계
        inv_rows = db.execute(text(f"""
            SELECT SUM((t.opening_signed + COALESCE(j.net,0)) *
                       CASE t.category WHEN '자산' THEN 1 ELSE -1 END)
            FROM tb_account t
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{y}'
                AND substr(year_month,6,2)<='{m}'
                GROUP BY account_code
            ) j ON t.account_code=j.account_code
            WHERE t.mgmt_acct IN ({','.join(f"'{x}'" for x in INVENTORY)})
        """)).scalar()
        inventory = float(inv_rows or 0)

        cur_a = s.get("유동자산", 0)
        cur_l = s.get("유동부채", 0)
        total_l = cat.get("부채", 0)
        equity  = cat.get("자본", 0)
        quick_a = cur_a - inventory

        result.append({
            "year_month": ym,
            "유동비율": round(cur_a / cur_l * 100, 1) if cur_l else 0,
            "당좌비율": round(quick_a / cur_l * 100, 1) if cur_l else 0,
            "부채비율": round(total_l / equity * 100, 1) if equity else 0,
        })
    return result


@router.get("/activity")
def get_bs_activity(base_ym: str = Query(...), db: Session = Depends(get_db)):
    """매출채권/재고자산 회전일수 — 현재값 + 월별 추이"""
    base_year = int(base_ym[:4])
    months = db.execute(text(f"""
        SELECT DISTINCT year_month FROM je WHERE section='BS'
        AND (substr(year_month,1,4)='{base_year-1}' OR
             (substr(year_month,1,4)='{base_year}' AND substr(year_month,6,2)<='{base_ym[5:]}'))
        ORDER BY year_month
    """)).fetchall()

    RECV_ACCT   = "매출채권"
    INV_ACCTS   = ("제품","원재료","재공품")
    COGS_ACCTS  = ("제조원가","매출원가")

    trend = []
    for (ym,) in months:
        y, m = ym.split("-")
        # 매출채권 기말
        recv = db.execute(text(f"""
            SELECT SUM((t.opening_signed + COALESCE(j.net,0)) *
                       CASE t.category WHEN '자산' THEN 1 ELSE -1 END)
            FROM tb_account t
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{y}'
                AND substr(year_month,6,2)<='{m}' GROUP BY account_code
            ) j ON t.account_code=j.account_code
            WHERE t.mgmt_acct='{RECV_ACCT}'
        """)).scalar() or 0
        # 재고자산 기말
        inv = db.execute(text(f"""
            SELECT SUM((t.opening_signed + COALESCE(j.net,0)) *
                       CASE t.category WHEN '자산' THEN 1 ELSE -1 END)
            FROM tb_account t
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{y}'
                AND substr(year_month,6,2)<='{m}' GROUP BY account_code
            ) j ON t.account_code=j.account_code
            WHERE t.mgmt_acct IN ({','.join(f"'{x}'" for x in INV_ACCTS)})
        """)).scalar() or 0
        # 누적 매출액 / 매출원가
        rev = db.execute(text(f"""
            SELECT -ROUND(SUM(signed_amount),0) FROM je
            WHERE disclosure_acct='매출액' AND section='PL'
            AND substr(year_month,1,4)='{y}' AND substr(year_month,6,2)<='{m}'
        """)).scalar() or 0
        cogs = db.execute(text(f"""
            SELECT -ROUND(SUM(signed_amount),0) FROM je
            WHERE disclosure_acct IN ({','.join(f"'{x}'" for x in COGS_ACCTS)}) AND section='PL'
            AND substr(year_month,1,4)='{y}' AND substr(year_month,6,2)<='{m}'
        """)).scalar() or 0

        days = int(m)  # 누적 월수 → 일수
        daily_rev  = float(rev)  / (days * 30.4) if rev  else 0
        daily_cogs = float(cogs) / (days * 30.4) if cogs else 0
        recv_days = round(float(recv) / daily_rev,  1) if daily_rev  else 0
        inv_days  = round(float(inv)  / daily_cogs, 1) if daily_cogs else 0

        trend.append({
            "year_month": ym,
            "매출채권회전일수": recv_days,
            "재고자산회전일수": inv_days,
            "avg_recv": round(float(recv)),
            "avg_inv":  round(float(inv)),
            "daily_rev":  round(daily_rev),
            "daily_cogs": round(daily_cogs),
        })

    current = trend[-1] if trend else {}
    return {"current": current, "trend": trend}


@router.get("/disclosure_detail")
def get_bs_disclosure_detail(
    base_ym: str = Query(...),
    disclosure_acct: str = Query(...),
    db: Session = Depends(get_db),
):
    """공시용계정 클릭 상세 — 계정과목 테이블 + 월별추이 + 거래처 증감 + 전표"""
    year, month = base_ym.split("-")
    base_year = int(year)
    sq = _bs_ending(db, year, month)

    da = disclosure_acct.replace("'", "''")   # 단순 SQL 이스케이프

    # ── 계정과목 상세 ──
    items = db.execute(text(f"""
        SELECT mgmt_acct, account_name, SUM(ending) AS ending, SUM(opening) AS opening
        FROM ({sq}) sub
        WHERE disclosure_acct = '{da}'
        GROUP BY mgmt_acct, account_name
        ORDER BY ABS(ending) DESC
    """)).fetchall()

    # ── 월별 잔액 추이 ──
    months = db.execute(text(f"""
        SELECT DISTINCT year_month FROM je WHERE section='BS'
        AND (substr(year_month,1,4)='{base_year-1}' OR
             (substr(year_month,1,4)='{base_year}' AND substr(year_month,6,2)<='{month}'))
        ORDER BY year_month
    """)).fetchall()

    monthly_trend = []
    for (ym,) in months:
        y, m = ym.split("-")
        val = db.execute(text(f"""
            SELECT SUM((t.opening_signed + COALESCE(j.net, 0)) *
                       CASE t.category WHEN '자산' THEN 1 ELSE -1 END)
            FROM tb_account t
            LEFT JOIN (
                SELECT account_code, SUM(signed_amount) AS net FROM je
                WHERE section='BS' AND substr(year_month,1,4)='{y}'
                AND substr(year_month,6,2)<='{m}' GROUP BY account_code
            ) j ON t.account_code = j.account_code
            WHERE t.section='BS' AND t.disclosure_acct = '{da}'
        """)).scalar() or 0
        monthly_trend.append({"year_month": ym, "ending": round(float(val))})

    # ── 거래처별 증감 (당기 누적) ──
    cp_rows = db.execute(text(f"""
        SELECT counterparty,
               SUM(CASE WHEN dr_cr='차변' THEN amount ELSE 0 END) AS dr,
               SUM(CASE WHEN dr_cr='대변' THEN amount ELSE 0 END) AS cr,
               SUM(signed_amount) AS net
        FROM je
        WHERE section='BS' AND disclosure_acct='{da}'
        AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
        GROUP BY counterparty ORDER BY ABS(net) DESC LIMIT 20
    """)).fetchall()

    # ── 당기 전표 ──
    vouchers = db.execute(text(f"""
        SELECT date, voucher_no, account_name, counterparty, description, dr_cr, amount
        FROM je
        WHERE section='BS' AND disclosure_acct='{da}'
        AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
        ORDER BY date DESC, voucher_no, record_id LIMIT 500
    """)).fetchall()

    return {
        "account_items": [
            {"mgmt_acct": r[0], "account_name": r[1],
             "ending": float(r[2] or 0), "opening": float(r[3] or 0)}
            for r in items
        ],
        "monthly_trend": monthly_trend,
        "counterparty_changes": [
            {"name": r[0] or "(없음)", "dr": float(r[1]), "cr": float(r[2]), "net": float(r[3])}
            for r in cp_rows
        ],
        "vouchers": [
            {"date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
             "counterparty": r[3], "description": r[4], "dr_cr": r[5], "amount": float(r[6])}
            for r in vouchers
        ],
    }


@router.get("/disclosures")
def get_bs_disclosures(db: Session = Depends(get_db)):
    """BS 공시용계정 목록"""
    rows = db.execute(text("""
        SELECT DISTINCT disclosure_acct FROM tb_account
        WHERE section='BS' AND disclosure_acct IS NOT NULL
        ORDER BY disclosure_acct
    """)).fetchall()
    return [r[0] for r in rows]


@router.get("/acct_names")
def get_bs_acct_names(
    disclosure_acct: str = Query(...),
    db: Session = Depends(get_db),
):
    """공시용계정별 계정과목(account_name) 목록"""
    rows = db.execute(text(f"""
        SELECT DISTINCT account_name FROM tb_account
        WHERE section='BS' AND disclosure_acct=:da
        ORDER BY account_name
    """), {"da": disclosure_acct}).fetchall()
    return [r[0] for r in rows]


@router.get("/daily_balance")
def get_bs_daily_balance(
    disclosure_acct: str = Query(...),
    account_name: str = Query(None),
    date_from: str = Query(...),   # YYYY-MM-DD
    date_to: str = Query(...),     # YYYY-MM-DD
    db: Session = Depends(get_db),
):
    """일별 잔액 추이 — 기초잔액 + 누적 전표"""
    acct_filter = "AND t.disclosure_acct=:da"
    acct_je     = "AND j.disclosure_acct=:da"
    params: dict = {"da": disclosure_acct, "df": date_from, "dt": date_to}
    if account_name:
        acct_filter += " AND t.account_name=:an"
        acct_je     += " AND j.account_name=:an"
        params["an"] = account_name

    # 기초잔액 (tb_account.opening_signed, 부호 이미 적용)
    opening_row = db.execute(text(f"""
        SELECT SUM(opening_signed) FROM tb_account t
        WHERE t.section='BS' {acct_filter}
    """), params).scalar() or 0.0

    # date_from 이전 누적 전표
    pre_row = db.execute(text(f"""
        SELECT COALESCE(SUM(j.signed_amount), 0) FROM je j
        WHERE j.section='BS' AND j.date < :df {acct_je}
    """), params).scalar() or 0.0

    balance_at_start = float(opening_row) + float(pre_row)

    # date_from ~ date_to 일별 순변동
    daily_rows = db.execute(text(f"""
        SELECT j.date, SUM(j.signed_amount) AS net
        FROM je j
        WHERE j.section='BS' AND j.date >= :df AND j.date <= :dt {acct_je}
        GROUP BY j.date ORDER BY j.date
    """), params).fetchall()

    daily_map = {str(r[0]): float(r[1]) for r in daily_rows}

    # 달력 날짜별 누적 잔액 생성
    result = []
    d = dt_date.fromisoformat(date_from)
    end = dt_date.fromisoformat(date_to)
    running = balance_at_start
    while d <= end:
        ds = d.isoformat()
        running += daily_map.get(ds, 0.0)
        result.append({"date": ds, "balance": round(running)})
        d += timedelta(days=1)
    return result


@router.get("/daily_detail")
def get_bs_daily_detail(
    disclosure_acct: str = Query(...),
    account_name: str = Query(None),
    date: str = Query(None),       # YYYY-MM-DD (특정 날짜 클릭 시)
    date_from: str = Query(None),  # YYYY-MM-DD (전체 기간 조회 시)
    date_to: str = Query(None),    # YYYY-MM-DD (전체 기간 조회 시)
    db: Session = Depends(get_db),
):
    """날짜 클릭 or 전체기간 상세 — 거래처 구성(차/대) + 상대계정 + 전표내역"""
    acct_filter = "disclosure_acct=:da"
    params: dict = {"da": disclosure_acct}

    if account_name:
        acct_filter += " AND account_name=:an"
        params["an"] = account_name

    # 날짜 범위 조건
    if date:
        date_cond = "date=:dt"
        params["dt"] = date
    elif date_from and date_to:
        date_cond = "date >= :df AND date <= :dt"
        params["df"] = date_from
        params["dt"] = date_to
    else:
        date_cond = "1=1"

    # ── 거래처 구성 (차변) ──
    cp_dr = db.execute(text(f"""
        SELECT counterparty, SUM(amount) AS total
        FROM je WHERE section='BS' AND {date_cond} AND dr_cr='차변' AND {acct_filter}
        GROUP BY counterparty ORDER BY total DESC LIMIT 20
    """), params).fetchall()

    # ── 거래처 구성 (대변) ──
    cp_cr = db.execute(text(f"""
        SELECT counterparty, SUM(amount) AS total
        FROM je WHERE section='BS' AND {date_cond} AND dr_cr='대변' AND {acct_filter}
        GROUP BY counterparty ORDER BY total DESC LIMIT 20
    """), params).fetchall()

    # ── 상대계정 ──
    counter_rows = db.execute(text(f"""
        SELECT j2.account_name, j2.disclosure_acct,
               SUM(CASE WHEN j2.dr_cr='차변' THEN j2.amount ELSE 0 END) AS dr,
               SUM(CASE WHEN j2.dr_cr='대변' THEN j2.amount ELSE 0 END) AS cr
        FROM je j2
        WHERE j2.section='BS' AND {date_cond}
          AND j2.voucher_no IN (
              SELECT DISTINCT voucher_no FROM je
              WHERE section='BS' AND {date_cond} AND {acct_filter}
          )
          AND NOT ({acct_filter})
        GROUP BY j2.account_name, j2.disclosure_acct
        ORDER BY (dr + cr) DESC
        LIMIT 30
    """), params).fetchall()

    # ── 전표 상세 ──
    vouchers = db.execute(text(f"""
        SELECT date, voucher_no, account_name, disclosure_acct,
               counterparty, description, dr_cr, amount
        FROM je
        WHERE section='BS' AND {date_cond} AND {acct_filter}
        ORDER BY date, voucher_no, record_id
        LIMIT 500
    """), params).fetchall()

    return {
        "counterparty_dr": [{"name": r[0] or "(없음)", "amount": float(r[1])} for r in cp_dr],
        "counterparty_cr": [{"name": r[0] or "(없음)", "amount": float(r[1])} for r in cp_cr],
        "counter_accounts": [
            {"account_name": r[0], "disclosure_acct": r[1], "dr": float(r[2]), "cr": float(r[3])}
            for r in counter_rows
        ],
        "vouchers": [
            {
                "date": str(r[0]), "voucher_no": r[1], "account_name": r[2],
                "disclosure_acct": r[3], "counterparty": r[4],
                "description": r[5], "dr_cr": r[6], "amount": float(r[7]),
            }
            for r in vouchers
        ],
    }
