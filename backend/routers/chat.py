"""김삼일 AI 챗봇 — OpenAI SDK + Function Calling (PwC GenAI Shared Service)"""

import os
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from openai import OpenAI
from database import get_db

router = APIRouter()

# ── PwC GenAI Client (lazy init) ──────────────────────────────
_client = None

def get_client():
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            base_url=os.getenv("OPENAI_BASE_URL", "https://genai-sharedservice-americas.pwcinternal.com"),
        )
    return _client

def get_model():
    return os.getenv("CHAT_MODEL", "openai.gpt-4o")

# ── 김삼일 시스템 프롬프트 ─────────────────────────────────────
SYSTEM_PROMPT = """당신은 삼일회계법인 소속 매니저 '김삼일'입니다.
EasyView 재무분석 플랫폼의 AI 어시스턴트 역할을 합니다.

## 성격 및 말투
- 전문적이면서도 친근한 말투 (존댓말 사용)
- 회계/재무 전문 지식을 바탕으로 인사이트 제공
- 숫자를 말할 때 천 단위 쉼표와 단위(원, %) 표기
- 핵심을 먼저 말하고 부연설명을 덧붙이는 스타일
- 답변은 간결하게, 필요시 bullet point 활용

## 역할
- 사용자가 보고 있는 리포트 페이지의 데이터를 분석하여 인사이트 제공
- PL(손익), BS(재무상태), 전표분석, 시나리오 분석 관련 질문에 답변
- 이상 징후 발견 시 적극적으로 알려주기
- 재무비율, 증감 원인, 거래처 변동 등을 설명

## 주의사항
- 확실하지 않은 정보는 추측이라고 명시
- 데이터 없이 답변할 수 없는 경우 솔직하게 안내
- 개인정보나 민감 정보는 언급하지 않음
"""

# ── Tool 정의 (Function Calling) ──────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_kpi",
            "description": "매출액, 영업이익, 자산, 부채 KPI 지표를 조회합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "period_type": {"type": "string", "enum": ["monthly", "cumulative"]},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pl_summary",
            "description": "손익계산서(PL) 요약 — 매출액, 매출원가, 판관비, 영업이익, 당기순이익의 당기/전기/증감률",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "period_type": {"type": "string", "enum": ["monthly", "cumulative"]},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pl_sales_top",
            "description": "매출 거래처별 순위 — 당기/전기 매출액과 증감",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "period_type": {"type": "string", "enum": ["monthly", "cumulative"]},
                    "top_n": {"type": "integer", "description": "상위 N개 (기본 10)"},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_bs_summary",
            "description": "재무상태표(BS) 요약 — 자산/부채/자본 항목별 기말/기초 잔액과 증감률",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_bs_ratios",
            "description": "재무비율 추이 — 유동비율, 당좌비율, 부채비율",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scenario_count",
            "description": "시나리오 분석 건수 — SC1~SC6 이상 전표 건수 조회",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scenario_detail",
            "description": "특정 시나리오의 이상 전표 상세 내역 조회 (SC1: 중복전표, SC2: 현금→부채, SC3: 주말현금, SC4: 고액현금, SC5: 비용+현금, SC6: 희소거래처)",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "scenario_num": {"type": "integer", "description": "시나리오 번호 (1~6)"},
                },
                "required": ["base_ym", "scenario_num"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_indicators",
            "description": "재무 지표 — 매출총이익률, 영업이익률, 순이익률, 유동비율, 부채비율",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "period_type": {"type": "string", "enum": ["monthly", "cumulative"]},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pl_items",
            "description": "손익항목 상세 — 공시용계정별(매출액, 매출원가, 판관비 등) 당기/전기/증감률",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "period_type": {"type": "string", "enum": ["monthly", "cumulative"]},
                },
                "required": ["base_ym"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_top3_changes",
            "description": "Top3 증감 — 매출 거래처, 비용 계정, 자산 계정, 부채 계정 증감 Top3",
            "parameters": {
                "type": "object",
                "properties": {
                    "base_ym": {"type": "string", "description": "기준 연월 (YYYY-MM)"},
                    "period_type": {"type": "string", "enum": ["monthly", "cumulative"]},
                },
                "required": ["base_ym"],
            },
        },
    },
]


# ── Tool 실행 함수 ────────────────────────────────────────────
def execute_tool(name: str, args: dict, db: Session) -> str:
    base_ym = args.get("base_ym", "2025-09")
    period_type = args.get("period_type", "cumulative")
    year, month = base_ym.split("-")

    try:
        if name == "get_kpi":
            return _get_kpi(db, base_ym, period_type)
        elif name == "get_pl_summary":
            return _get_pl_summary(db, base_ym, period_type)
        elif name == "get_pl_sales_top":
            top_n = args.get("top_n", 10)
            return _get_pl_sales_top(db, base_ym, period_type, top_n)
        elif name == "get_bs_summary":
            return _get_bs_summary(db, base_ym)
        elif name == "get_bs_ratios":
            return _get_bs_ratios(db, base_ym)
        elif name == "get_scenario_count":
            return _get_scenario_count(db, base_ym)
        elif name == "get_scenario_detail":
            sc_num = args.get("scenario_num", 1)
            return _get_scenario_detail(db, base_ym, sc_num)
        elif name == "get_indicators":
            return _get_indicators(db, base_ym, period_type)
        elif name == "get_pl_items":
            return _get_pl_items(db, base_ym, period_type)
        elif name == "get_top3_changes":
            return _get_top3_changes(db, base_ym, period_type)
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── 데이터 조회 헬퍼 ──────────────────────────────────────────
def _je_sum(db, base_ym, period_type, disclosure_acct):
    year, month = base_ym.split("-")
    if period_type == "monthly":
        where = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
    else:
        where = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
    row = db.execute(text(f"""
        SELECT -ROUND(SUM(signed_amount), 0)
        FROM je WHERE section='PL' AND disclosure_acct='{disclosure_acct}' AND {where}
    """)).fetchone()
    return float(row[0] or 0)


def _prior_ym(base_ym, period_type):
    year, month = int(base_ym.split("-")[0]), int(base_ym.split("-")[1])
    return f"{year - 1}-{month:02d}", "cumulative" if period_type == "cumulative" else "monthly"


def _get_kpi(db, base_ym, period_type):
    prior_ym, prior_pt = _prior_ym(base_ym, period_type)
    rev_c = _je_sum(db, base_ym, period_type, "매출액")
    rev_p = _je_sum(db, prior_ym, prior_pt, "매출액")
    cogs_c = -_je_sum(db, base_ym, period_type, "매출원가")
    sga_c = -_je_sum(db, base_ym, period_type, "판매비와관리비")
    cogs_p = -_je_sum(db, prior_ym, prior_pt, "매출원가")
    sga_p = -_je_sum(db, prior_ym, prior_pt, "판매비와관리비")
    oth_r_c = _je_sum(db, base_ym, period_type, "기타수익")
    oth_e_c = -_je_sum(db, base_ym, period_type, "기타비용")
    oth_r_p = _je_sum(db, prior_ym, prior_pt, "기타수익")
    oth_e_p = -_je_sum(db, prior_ym, prior_pt, "기타비용")
    op_c = rev_c + cogs_c + sga_c + oth_r_c + oth_e_c
    op_p = rev_p + cogs_p + sga_p + oth_r_p + oth_e_p

    def pct(c, p): return round((c - p) / abs(p), 4) if p else 0.0

    return json.dumps({
        "매출액": {"당기": rev_c, "전기": rev_p, "증감률": f"{pct(rev_c, rev_p) * 100:.1f}%"},
        "영업이익": {"당기": op_c, "전기": op_p, "증감률": f"{pct(op_c, op_p) * 100:.1f}%"},
    }, ensure_ascii=False)


def _get_pl_summary(db, base_ym, period_type):
    prior_ym, prior_pt = _prior_ym(base_ym, period_type)
    accounts = ["매출액", "매출원가", "판매비와관리비", "기타수익", "기타비용", "금융수익", "금융비용", "법인세비용"]
    result = {}
    for acct in accounts:
        c = _je_sum(db, base_ym, period_type, acct)
        p = _je_sum(db, prior_ym, prior_pt, acct)
        sign = 1 if acct in ("매출액", "기타수익", "금융수익") else -1
        result[acct] = {"당기": c * sign, "전기": p * sign}

    net_c = sum(v["당기"] for v in result.values())
    net_p = sum(v["전기"] for v in result.values())
    result["당기순이익"] = {"당기": net_c, "전기": net_p}
    return json.dumps(result, ensure_ascii=False)


def _get_pl_sales_top(db, base_ym, period_type, top_n):
    year, month = base_ym.split("-")
    pri_year = str(int(year) - 1)
    if period_type == "monthly":
        cur_f = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
        pri_f = f"substr(year_month,1,4)='{pri_year}' AND substr(year_month,6,2)='{month}'"
    else:
        cur_f = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
        pri_f = f"substr(year_month,1,4)='{pri_year}' AND substr(year_month,6,2)<='{month}'"

    rows = db.execute(text(f"""
        SELECT counterparty,
            -ROUND(SUM(CASE WHEN {cur_f} THEN signed_amount ELSE 0 END),0) AS cur,
            -ROUND(SUM(CASE WHEN {pri_f} THEN signed_amount ELSE 0 END),0) AS pri
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL
        GROUP BY counterparty ORDER BY cur DESC LIMIT {top_n}
    """)).fetchall()

    result = [{"거래처": r[0], "당기매출": float(r[1] or 0), "전기매출": float(r[2] or 0),
               "증감": float(r[1] or 0) - float(r[2] or 0)} for r in rows]
    return json.dumps(result, ensure_ascii=False)


def _get_bs_summary(db, base_ym):
    year, month = base_ym.split("-")
    rows = db.execute(text(f"""
        SELECT t.category, t.sum_acct,
            SUM((t.opening_signed + COALESCE(j.net,0)) *
                CASE t.category WHEN '자산' THEN 1 ELSE -1 END) AS ending,
            SUM(t.opening_balance) AS opening
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
        GROUP BY t.category, t.sum_acct ORDER BY t.category, t.sum_acct
    """)).fetchall()

    result = [{"분류": r[0], "항목": r[1], "기말잔액": round(float(r[2] or 0)),
               "기초잔액": round(float(r[3] or 0))} for r in rows]
    return json.dumps(result, ensure_ascii=False)


def _get_bs_ratios(db, base_ym):
    year, month = base_ym.split("-")
    rows = db.execute(text(f"""
        SELECT t.sum_acct,
            SUM((t.opening_signed + COALESCE(j.net,0)) *
                CASE t.category WHEN '자산' THEN 1 ELSE -1 END) AS ending
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
        GROUP BY t.sum_acct
    """)).fetchall()

    sums = {r[0]: float(r[1] or 0) for r in rows}
    cur_a = sums.get("유동자산", 0)
    cur_l = sums.get("유동부채", 0)
    cat = db.execute(text(f"""
        SELECT t.category,
            SUM((t.opening_signed + COALESCE(j.net,0)) *
                CASE t.category WHEN '자산' THEN 1 ELSE -1 END) AS ending
        FROM tb_account t
        LEFT JOIN (
            SELECT account_code, SUM(signed_amount) AS net FROM je
            WHERE section='BS' AND substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'
            GROUP BY account_code
        ) j ON t.account_code=j.account_code
        GROUP BY t.category
    """)).fetchall()
    cats = {r[0]: float(r[1] or 0) for r in cat}
    total_l = cats.get("부채", 0)
    equity = cats.get("자본", 0)

    return json.dumps({
        "유동비율": f"{cur_a / cur_l * 100:.1f}%" if cur_l else "N/A",
        "부채비율": f"{total_l / equity * 100:.1f}%" if equity else "N/A",
    }, ensure_ascii=False)


def _get_scenario_count(db, base_ym):
    ym = base_ym
    sc1 = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT year_month, account_code, dr_cr, amount, COUNT(*) AS cnt
            FROM je WHERE year_month='{ym}'
            GROUP BY year_month, account_code, dr_cr, amount HAVING cnt >= 2
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

    return json.dumps({
        "SC1_동일금액중복": int(sc1),
        "SC3_주말현금지급": int(sc3),
        "SC4_고액현금지급": int(sc4),
        "기준월": ym,
    }, ensure_ascii=False)


def _get_scenario_detail(db, base_ym, sc_num):
    ym = base_ym
    if sc_num == 1:
        rows = db.execute(text(f"""
            SELECT j.date, j.voucher_no, j.account_name, j.counterparty, j.amount, j.dr_cr
            FROM je j INNER JOIN (
                SELECT year_month, account_code, dr_cr, amount, COUNT(*) AS cnt
                FROM je WHERE year_month='{ym}'
                GROUP BY year_month, account_code, dr_cr, amount HAVING cnt >= 2
            ) dup ON j.year_month=dup.year_month AND j.account_code=dup.account_code
                AND j.dr_cr=dup.dr_cr AND j.amount=dup.amount
            ORDER BY j.amount DESC LIMIT 20
        """)).fetchall()
    elif sc_num == 3:
        rows = db.execute(text(f"""
            SELECT date, voucher_no, account_name, counterparty, amount, dr_cr
            FROM je WHERE year_month='{ym}' AND is_weekend=1 AND is_cash=1 AND dr_cr='대변'
            ORDER BY date LIMIT 20
        """)).fetchall()
    elif sc_num == 4:
        rows = db.execute(text(f"""
            SELECT date, voucher_no, account_name, counterparty, amount, dr_cr
            FROM je WHERE year_month='{ym}' AND is_cash=1 AND dr_cr='대변' AND amount >= 1000000
            ORDER BY amount DESC LIMIT 20
        """)).fetchall()
    else:
        return json.dumps({"message": f"SC{sc_num} 상세 조회는 아직 지원하지 않습니다."}, ensure_ascii=False)

    result = [{"일자": str(r[0]), "전표번호": r[1], "계정과목": r[2],
               "거래처": r[3], "금액": float(r[4] or 0), "차대": r[5]} for r in rows]
    return json.dumps(result[:20], ensure_ascii=False)


def _get_indicators(db, base_ym, period_type):
    rev = _je_sum(db, base_ym, period_type, "매출액")
    cogs = -_je_sum(db, base_ym, period_type, "매출원가")
    sga = -_je_sum(db, base_ym, period_type, "판매비와관리비")
    oth_r = _je_sum(db, base_ym, period_type, "기타수익")
    oth_e = -_je_sum(db, base_ym, period_type, "기타비용")
    fin_r = _je_sum(db, base_ym, period_type, "금융수익")
    fin_e = -_je_sum(db, base_ym, period_type, "금융비용")
    tax = -_je_sum(db, base_ym, period_type, "법인세비용")

    gross = rev + cogs
    op = gross + sga + oth_r + oth_e
    net = op + fin_r + fin_e + tax

    def safe_pct(a, b): return f"{a / b * 100:.1f}%" if b else "N/A"

    return json.dumps({
        "매출총이익률": safe_pct(gross, rev),
        "영업이익률": safe_pct(op, rev),
        "순이익률": safe_pct(net, rev),
    }, ensure_ascii=False)


def _get_pl_items(db, base_ym, period_type):
    prior_ym, prior_pt = _prior_ym(base_ym, period_type)
    ORDER = ["매출액", "매출원가", "판매비와관리비", "기타수익", "기타비용", "금융수익", "금융비용", "법인세비용"]
    result = []
    for acct in ORDER:
        c = _je_sum(db, base_ym, period_type, acct)
        p = _je_sum(db, prior_ym, prior_pt, acct)
        sign = 1 if acct in ("매출액", "기타수익", "금융수익") else -1
        cur, pri = c * sign, p * sign
        chg = round((cur - pri) / abs(pri) * 100, 1) if pri else 0.0
        result.append({"항목": acct, "당기": cur, "전기": pri, "증감률": f"{chg}%"})
    return json.dumps(result, ensure_ascii=False)


def _get_top3_changes(db, base_ym, period_type):
    year, month = base_ym.split("-")
    if period_type == "monthly":
        cur_f = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)='{month}'"
        pri_f = f"substr(year_month,1,4)='{int(year)-1}' AND substr(year_month,6,2)='{month}'"
    else:
        cur_f = f"substr(year_month,1,4)='{year}' AND substr(year_month,6,2)<='{month}'"
        pri_f = f"substr(year_month,1,4)='{int(year)-1}' AND substr(year_month,6,2)<='{month}'"

    rev_top3 = db.execute(text(f"""
        SELECT counterparty,
            SUM(CASE WHEN {cur_f} THEN -signed_amount ELSE 0 END) AS cur,
            SUM(CASE WHEN {pri_f} THEN -signed_amount ELSE 0 END) AS pri
        FROM je WHERE disclosure_acct='매출액' AND counterparty IS NOT NULL
        GROUP BY counterparty
        ORDER BY (SUM(CASE WHEN {cur_f} THEN -signed_amount ELSE 0 END)
                - SUM(CASE WHEN {pri_f} THEN -signed_amount ELSE 0 END)) DESC
        LIMIT 3
    """)).fetchall()

    result = {"매출증가Top3": [{"거래처": r[0], "증감": round(float(r[1] or 0) - float(r[2] or 0))} for r in rev_top3]}
    return json.dumps(result, ensure_ascii=False)


# ── Request / Response ────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    base_ym: Optional[str] = "2025-09"
    period_type: Optional[str] = "cumulative"
    page: Optional[str] = None  # 현재 보고 있는 페이지 (summary, pl-sum, bs-sum 등)
    history: Optional[list] = None  # 이전 대화 기록


class ChatResponse(BaseModel):
    reply: str


# ── 엔드포인트 ────────────────────────────────────────────────
@router.post("/message", response_model=ChatResponse)
async def chat_message(req: ChatRequest, db: Session = Depends(get_db)):
    """김삼일 AI 채팅"""
    import traceback

    try:
        # 페이지 컨텍스트 메시지 구성
        page_context = ""
        if req.page:
            page_names = {
                "summary": "Summary 대시보드", "pl-sum": "PL 요약", "pl-trend": "PL 추이분석",
                "pl-acct": "PL 계정분석", "pl-sale": "매출분석", "pl-item": "손익항목",
                "bs-sum": "BS 요약", "bs-trend": "BS 추이분석", "bs-acct": "BS 계정분석",
                "vch-analysis": "전표분석", "vch-search": "전표검색",
                "sc-dup": "SC1 중복전표", "sc-cash-debt": "SC2 현금→부채",
                "sc-weekend": "SC3 주말현금", "sc-big-cash": "SC4 고액현금",
                "sc-cost-cash": "SC5 비용+현금", "sc-seldom": "SC6 희소거래처",
            }
            page_label = page_names.get(req.page, req.page)
            page_context = f"\n\n[현재 사용자가 보고 있는 페이지: {page_label}]\n[기준 연월: {req.base_ym}, 기간: {req.period_type}]"

        # 대화 기록 구성
        messages = [{"role": "system", "content": SYSTEM_PROMPT + page_context}]

        if req.history:
            for h in req.history[-10:]:
                role = h.get("role", "user") if isinstance(h, dict) else getattr(h, "role", "user")
                text = h.get("text", "") if isinstance(h, dict) else getattr(h, "text", "")
                messages.append({"role": role, "content": text})

        messages.append({"role": "user", "content": req.message})

        # 첫 번째 호출 — 모델이 tool 호출 여부 결정
        ai = get_client()
        model = get_model()

        response = ai.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=1500,
        )

        assistant_msg = response.choices[0].message

        # tool_calls가 있으면 실행 후 재호출
        if assistant_msg.tool_calls:
            messages.append(assistant_msg)

            for tool_call in assistant_msg.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)

                # base_ym 기본값 주입
                if "base_ym" not in fn_args:
                    fn_args["base_ym"] = req.base_ym
                if "period_type" not in fn_args:
                    fn_args["period_type"] = req.period_type

                result = execute_tool(fn_name, fn_args, db)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

            # 두 번째 호출 — tool 결과를 바탕으로 최종 답변
            final_response = ai.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
            )
            reply = final_response.choices[0].message.content
        else:
            reply = assistant_msg.content

        return ChatResponse(reply=reply or "죄송합니다, 응답을 생성하지 못했습니다.")

    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        traceback.print_exc()
        return ChatResponse(reply=f"오류가 발생했습니다: {str(e)}")
