"""김삼일 AI 챗봇 — OpenAI SDK + Function Calling (PwC GenAI Shared Service)"""

import os
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from openai import OpenAI
from database import get_db
from chat_models import ChatSession, ChatMessage as DBChatMessage, Faq, FaqFeedback

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
EasyView 재무분석 플랫폼의 AI 어시스턴트입니다.

## 성격 및 말투
- 전문적이면서도 친근한 말투 (존댓말 사용)
- 회계/재무 전문 지식을 바탕으로 인사이트 제공
- 숫자는 천 단위 쉼표와 단위(원, %) 표기
- 핵심을 먼저, 부연설명은 뒤에
- 답변은 간결하게, 필요시 bullet point 활용

## 역할
- 사용자가 보고 있는 페이지의 데이터를 분석하여 인사이트 제공
- PL/BS/전표/시나리오 분석 관련 질문에 답변
- 페이지 이동이나 설정 변경이 필요하면 action으로 제안
- 이상 징후 발견 시 적극적으로 알려주기

## 응답 형식 (중요)
답변은 반드시 JSON으로만 응답하세요 (다른 텍스트 없이):

{
  "reply": "답변 본문 (마크다운 가능, 줄바꿈은 \\n)",
  "actions": [
    {"type": "navigate", "label": "버튼 텍스트", "route": "/easyview/?page=...&sub=..."},
    {"type": "execute", "label": "버튼 텍스트", "handler": "applyTheme('dark')"}
  ],
  "suggestions": ["추가 질문 1", "추가 질문 2", "추가 질문 3"]
}

- actions: 사용자가 바로 클릭할 수 있는 버튼. 필요 없으면 빈 배열 []
- suggestions: 대화를 이어갈 수 있는 follow-up 질문 2~3개. 필요 없으면 빈 배열 []

## Action Route 가이드
- 리포트 페이지: /easyview/?page=report&sub={subkey}
  - sub: summary, pl-sum, pl-trend, pl-acct, pl-sale, pl-item,
         bs-sum, bs-trend, bs-acct, vch-analysis, vch-search,
         sc-dup, sc-cash, sc-wknd, sc-big, sc-sc5, sc-sc6
- 자료실: /easyview/?page=resource
- 문의게시판: /easyview/?page=inquiry
- 관리자: /easyview/?page=admin

## Action Handler 가이드
- applyTheme('dark') / applyTheme('light'): 테마 변경
- openCommentPanel(): 문의 작성 패널 열기
- scrollToTop(): 페이지 상단 이동

## 예시 1 — 다크모드 질문
질문: "다크모드 어떻게 바꿔?"
응답: {
  "reply": "다크모드는 설정에서 바꿀 수 있어요! 🌙 바로 켜드릴까요?",
  "actions": [
    {"type": "execute", "label": "지금 다크모드 켜기", "handler": "applyTheme('dark')"},
    {"type": "execute", "label": "라이트모드로 전환", "handler": "applyTheme('light')"}
  ],
  "suggestions": ["글자 크기도 바꿀 수 있어?", "사이드바 숨기는 법"]
}

## 예시 2 — 매출 분석
질문: "9월 매출 어때?"
응답: {
  "reply": "9월 매출은 **133,930백만원**으로 전년 대비 **▲17.3%** 증가했어요.\\n매출분석 페이지에서 거래처별 상세를 확인할 수 있어요.",
  "actions": [
    {"type": "navigate", "label": "매출분석 페이지로", "route": "/easyview/?page=report&sub=pl-sale"}
  ],
  "suggestions": ["어떤 거래처 덕분에 증가했어?", "전월 대비는 어때?", "영업이익도 같이 늘었나?"]
}

## 주의
- JSON 외의 텍스트를 출력하지 마세요
- actions/suggestions는 필요 없으면 빈 배열, 최대 3~4개까지만
- Function Calling이 필요하면 먼저 tool을 호출한 후, 그 결과로 최종 JSON 응답하세요

## ⚠️ 절대 금지 (중요!)
- **execute 타입 action은 사용자가 버튼을 클릭해야 실행됩니다.**
  당신이 직접 실행할 수 없으며, "활성화했습니다", "변경했습니다", "켰습니다",
  "바꿨습니다" 같은 **완료형 표현을 절대 사용하지 마세요**.
- 사용자가 "해줘", "켜줘", "바꿔줘" 라고 요청해도,
  → 답변은 반드시 "아래 버튼을 눌러주세요" 또는 "바로 켜드릴까요?" 형태로 제공
  → 그리고 execute 액션 버튼을 포함시키세요.
- 사용자가 "넵", "응", "해줘" 등으로 확인만 해도,
  → 여전히 실행은 사용자가 버튼을 눌러야 합니다.
  → "아래 [지금 켜기] 버튼을 눌러주세요 😊" + execute 버튼 제공.

## ❌ 잘못된 응답 예시
질문: "다크모드 켜줘"
나쁜 응답: {"reply": "다크모드를 켰습니다!", "actions": []}  ← 거짓말!

## ✅ 올바른 응답 예시
질문: "다크모드 켜줘"
좋은 응답: {
  "reply": "다크모드는 아래 버튼으로 바로 켤 수 있어요! 🌙",
  "actions": [
    {"type": "execute", "label": "🌙 지금 다크모드 켜기", "handler": "applyTheme('dark')"}
  ],
  "suggestions": ["라이트모드로 다시 바꾸려면?", "글자 크기도 바꿀 수 있어?"]
}
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
    page: Optional[str] = None
    history: Optional[list] = None
    attachments: Optional[list] = None
    session_id: Optional[int] = None  # 🆕 대화 세션 ID
    user_role: Optional[str] = "viewer"  # 🆕 사용자 역할 (admin/manager/viewer)
    user_name: Optional[str] = None  # 🆕 로그인 사용자명 (세션 저장용)


class ChatAction(BaseModel):
    type: str  # navigate | execute | quick_reply
    label: str
    route: Optional[str] = None  # navigate용
    handler: Optional[str] = None  # execute용 (applyTheme('dark') 등)
    payload: Optional[dict] = None  # 추가 데이터


class ChatResponse(BaseModel):
    reply: str
    actions: Optional[list[ChatAction]] = None  # 🆕 실행 가능한 액션들
    suggestions: Optional[list[str]] = None  # 🆕 Follow-up 질문 제안
    matched_faq_id: Optional[int] = None  # 🆕 FAQ에서 매칭된 경우
    session_id: Optional[int] = None


# ── FAQ 간단 매칭 (키워드 기반) ──────────────────────────────
def find_matching_faq(db: Session, message: str) -> Optional[Faq]:
    """사용자 메시지에서 FAQ 키워드 매칭. 간단한 키워드 오버랩 방식."""
    msg = message.strip().lower()
    if len(msg) < 2:
        return None

    # 모든 활성 FAQ 로드 (작은 규모일 때만 적합 — 규모 커지면 벡터 검색으로)
    faqs = db.query(Faq).filter(Faq.is_published == True).all()
    if not faqs:
        return None

    best_faq = None
    best_score = 0
    for faq in faqs:
        score = 0
        # 질문 텍스트와 일치
        q_lower = faq.question.lower()
        # 완전 포함
        if msg in q_lower or q_lower in msg:
            score += 10
        # 키워드 매칭
        if faq.keywords:
            for kw in faq.keywords.split(","):
                kw = kw.strip().lower()
                if kw and kw in msg:
                    score += 3
        # 단어 단위 공통 부분
        msg_words = set(re.findall(r"[\w가-힣]+", msg))
        q_words = set(re.findall(r"[\w가-힣]+", q_lower))
        overlap = len(msg_words & q_words)
        score += overlap

        if score > best_score:
            best_score = score
            best_faq = faq

    # 임계값 이상일 때만 매칭 (너무 낮으면 오답 가능)
    return best_faq if best_score >= 5 else None


# ── 세션 헬퍼 ──────────────────────────────────────────────────
def get_or_create_session(db: Session, req_session_id: Optional[int], user_name: Optional[str], first_msg: str, page: Optional[str]) -> ChatSession:
    if req_session_id:
        sess = db.query(ChatSession).filter(ChatSession.id == req_session_id).first()
        if sess:
            return sess
    # 신규 세션 — 제목은 첫 메시지에서 추출
    title = first_msg[:40].strip() + ("…" if len(first_msg) > 40 else "")
    sess = ChatSession(
        user_name=user_name or "anonymous",
        session_title=title,
        page_context=page,
        message_count=0,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess


def save_message(db: Session, session_id: int, role: str, content: str,
                 actions: Optional[list] = None, suggestions: Optional[list] = None,
                 current_page: Optional[str] = None, matched_faq_id: Optional[int] = None):
    msg = DBChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        actions_json=json.dumps(actions, ensure_ascii=False) if actions else None,
        suggestions_json=json.dumps(suggestions, ensure_ascii=False) if suggestions else None,
        current_page=current_page,
        matched_faq_id=matched_faq_id,
    )
    db.add(msg)
    # 세션 메시지 카운트 증가
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if sess:
        sess.message_count = (sess.message_count or 0) + 1
    db.commit()


# ── 엔드포인트 ────────────────────────────────────────────────
@router.post("/message", response_model=ChatResponse)
async def chat_message(req: ChatRequest, db: Session = Depends(get_db)):
    """김삼일 AI 채팅"""
    import traceback

    try:
        # 세션 확보 + 사용자 메시지 저장
        session = get_or_create_session(db, req.session_id, req.user_name, req.message, req.page)
        save_message(db, session.id, "user", req.message, current_page=req.page)

        # FAQ 매칭 우선 시도 (첨부가 없을 때만)
        if not req.attachments:
            faq = find_matching_faq(db, req.message)
            if faq:
                # FAQ 답변을 반환하고 GPT 호출 스킵
                faq.view_count = (faq.view_count or 0) + 1
                db.commit()
                actions = []
                if faq.action_route:
                    actions.append({"type": "navigate", "label": "바로가기", "route": faq.action_route})
                if faq.action_handler:
                    actions.append({"type": "execute", "label": "실행하기", "handler": faq.action_handler})
                reply_text = faq.answer
                suggestions_list = []

                save_message(db, session.id, "assistant", reply_text,
                             actions=actions, suggestions=suggestions_list,
                             matched_faq_id=faq.id)
                return ChatResponse(
                    reply=reply_text, actions=actions, suggestions=suggestions_list,
                    matched_faq_id=faq.id, session_id=session.id,
                )

        # 페이지 컨텍스트 메시지 구성 — 페이지별 맞춤 가이드
        page_context = _build_page_context(req.page, req.base_ym, req.period_type, req.user_role)

        # 첨부 데이터 (사용자가 'Add to Chat'으로 보낸 리포트 데이터)
        attachment_context = ""
        if req.attachments:
            lines = ["\n\n[사용자가 첨부한 리포트 데이터 — 이 항목을 우선적으로 참고해서 답변하세요]"]
            for i, att in enumerate(req.attachments, 1):
                label = att.get("label", "") if isinstance(att, dict) else ""
                summary = att.get("summary", "") if isinstance(att, dict) else ""
                source = att.get("source", "") if isinstance(att, dict) else ""
                lines.append(f"\n{i}. {label}" + (f" (출처: {source})" if source else ""))
                if summary:
                    lines.append(f"   데이터: {summary}")
            attachment_context = "\n".join(lines)

        # 대화 기록 구성
        messages = [{"role": "system", "content": SYSTEM_PROMPT + page_context + attachment_context}]

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

        # JSON 파싱 시도 — 실패 시 일반 텍스트로 처리
        parsed = _parse_ai_response(reply or "")

        # assistant 메시지 DB 저장
        save_message(db, session.id, "assistant", parsed["reply"],
                     actions=parsed["actions"], suggestions=parsed["suggestions"],
                     current_page=req.page)

        return ChatResponse(
            reply=parsed["reply"],
            actions=parsed["actions"],
            suggestions=parsed["suggestions"],
            session_id=session.id,
        )

    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        traceback.print_exc()
        return ChatResponse(reply=f"오류가 발생했습니다: {str(e)}", actions=[], suggestions=[])


def _parse_ai_response(raw: str) -> dict:
    """AI 응답에서 JSON 추출. 실패 시 전체를 reply로 간주."""
    if not raw:
        return {"reply": "죄송합니다, 응답을 생성하지 못했습니다.", "actions": [], "suggestions": []}

    # 코드블록 제거 (```json ... ```)
    txt = raw.strip()
    if txt.startswith("```"):
        lines = txt.split("\n")
        txt = "\n".join(lines[1:-1]) if len(lines) > 2 else txt.strip("`")

    try:
        data = json.loads(txt)
        if isinstance(data, dict) and "reply" in data:
            return {
                "reply": str(data.get("reply", "")),
                "actions": data.get("actions") if isinstance(data.get("actions"), list) else [],
                "suggestions": data.get("suggestions") if isinstance(data.get("suggestions"), list) else [],
            }
    except (json.JSONDecodeError, ValueError):
        pass

    # 파싱 실패 → 원문을 reply로
    return {"reply": raw, "actions": [], "suggestions": []}


# ── 페이지별 시스템 프롬프트 확장 ───────────────────────────────
PAGE_GUIDES = {
    "summary": {
        "label": "Summary 대시보드",
        "focus": "매출/영업이익/자산/부채의 전반적 현황. KPI 중심 답변.",
        "suggested_tools": "get_kpi, get_top3_changes, get_scenario_count",
    },
    "pl-sum": {
        "label": "PL 요약",
        "focus": "손익계산서 요약. 매출/원가/판관비/영업이익/순이익.",
        "suggested_tools": "get_pl_summary, get_indicators",
    },
    "pl-trend": {
        "label": "PL 추이분석",
        "focus": "월별 PL 추이. 계절성/증감 패턴 파악.",
        "suggested_tools": "get_pl_items",
    },
    "pl-acct": {
        "label": "PL 계정분석",
        "focus": "계정별 상세. 비용/수익 구조 분석.",
        "suggested_tools": "get_pl_items",
    },
    "pl-sale": {
        "label": "매출분석",
        "focus": "거래처별 매출. Top N, 증가/감소 거래처 파악.",
        "suggested_tools": "get_pl_sales_top, get_top3_changes",
    },
    "pl-item": {
        "label": "손익항목",
        "focus": "손익 항목별 당기/전기 상세 비교.",
        "suggested_tools": "get_pl_items",
    },
    "bs-sum": {
        "label": "BS 요약",
        "focus": "재무상태표 총괄. 자산/부채/자본.",
        "suggested_tools": "get_bs_summary, get_bs_ratios, get_indicators",
    },
    "bs-trend": {
        "label": "BS 추이분석",
        "focus": "재무상태 월별 추이. 재무비율 변화.",
        "suggested_tools": "get_bs_ratios",
    },
    "bs-acct": {
        "label": "BS 계정분석",
        "focus": "자산/부채 계정별 상세.",
        "suggested_tools": "get_bs_summary",
    },
    "vch-analysis": {
        "label": "전표분석",
        "focus": "전표 건수/패턴. 이상 패턴 탐지.",
        "suggested_tools": "get_scenario_count, get_scenario_detail",
    },
    "vch-search": {
        "label": "전표검색",
        "focus": "전표 세부 검색/조회 지원.",
        "suggested_tools": "",
    },
    "sc-dup": {
        "label": "SC1 중복전표",
        "focus": "동일금액 중복 전표 시나리오. 사용자의 검토를 도움.",
        "suggested_tools": "get_scenario_count, get_scenario_detail",
    },
    "sc-cash": {
        "label": "SC2 현금→부채",
        "focus": "현금 지급 후 부채 인식 패턴.",
        "suggested_tools": "get_scenario_detail",
    },
    "sc-wknd": {
        "label": "SC3 주말현금",
        "focus": "주말 현금 지급 건수/금액.",
        "suggested_tools": "get_scenario_count, get_scenario_detail",
    },
    "sc-big": {
        "label": "SC4 고액현금",
        "focus": "고액 현금 지급(100만원↑).",
        "suggested_tools": "get_scenario_detail",
    },
    "sc-sc5": {
        "label": "SC5 비용+현금",
        "focus": "비용인식 + 현금지급 동시 전표.",
        "suggested_tools": "get_scenario_detail",
    },
    "sc-sc6": {
        "label": "SC6 희소거래처",
        "focus": "빈도 적은 거래처.",
        "suggested_tools": "get_scenario_detail",
    },
    "resource": {
        "label": "자료실",
        "focus": "자료 요청/업로드 관리. 요청 코드, 담당자, 마감일.",
        "suggested_tools": "",
    },
    "inquiry": {
        "label": "문의게시판",
        "focus": "문의 작성 보조. 카테고리 선택 가이드. FAQ 참고.",
        "suggested_tools": "",
    },
    "admin": {
        "label": "관리자 페이지",
        "focus": "사용자/회사/리포트 관리. 관리자만 접근.",
        "suggested_tools": "",
    },
}


def _build_page_context(page: Optional[str], base_ym: Optional[str], period_type: Optional[str], user_role: Optional[str]) -> str:
    """페이지별 맞춤 프롬프트 추가 — AI가 컨텍스트를 더 잘 이해하도록."""
    if not page:
        return ""
    guide = PAGE_GUIDES.get(page)
    if not guide:
        return f"\n\n[현재 페이지: {page}][기준: {base_ym}, 기간: {period_type}]"

    parts = [
        f"\n\n━━━ 현재 페이지 컨텍스트 ━━━",
        f"📍 페이지: **{guide['label']}**",
        f"🎯 주요 관심사: {guide['focus']}",
    ]
    if guide.get("suggested_tools"):
        parts.append(f"🔧 추천 tool: {guide['suggested_tools']}")
    parts.append(f"📅 기준 연월: {base_ym} / 기간: {period_type}")
    if user_role:
        role_hint = {
            "admin": "관리자 권한 — 전체 관리 기능 안내 가능",
            "manager": "매니저 권한 — 데이터 분석/리포트 생성 가능",
            "viewer": "조회 전용 — 수정 관련 답변은 권한 안내 필요",
            "uploader": "자료 업로드 권한 — 자료실 위주 답변",
        }.get(user_role, user_role)
        parts.append(f"👤 사용자 역할: {role_hint}")
    parts.append("━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════
# 대화 세션 관리 API
# ═══════════════════════════════════════════════════════════════

@router.get("/sessions")
async def list_sessions(user_name: Optional[str] = None, limit: int = 20, db: Session = Depends(get_db)):
    """사용자의 대화 세션 목록 (최근순)"""
    q = db.query(ChatSession)
    if user_name:
        q = q.filter(ChatSession.user_name == user_name)
    sessions = q.order_by(ChatSession.last_active_at.desc()).limit(limit).all()
    return {
        "sessions": [
            {
                "id": s.id,
                "title": s.session_title,
                "page_context": s.page_context,
                "message_count": s.message_count,
                "started_at": str(s.started_at) if s.started_at else None,
                "last_active_at": str(s.last_active_at) if s.last_active_at else None,
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: int, db: Session = Depends(get_db)):
    """특정 세션의 메시지 조회"""
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    msgs = db.query(DBChatMessage).filter(DBChatMessage.session_id == session_id).order_by(DBChatMessage.id).all()
    return {
        "session": {
            "id": sess.id,
            "title": sess.session_title,
            "page_context": sess.page_context,
            "message_count": sess.message_count,
        },
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "actions": json.loads(m.actions_json) if m.actions_json else [],
                "suggestions": json.loads(m.suggestions_json) if m.suggestions_json else [],
                "matched_faq_id": m.matched_faq_id,
                "created_at": str(m.created_at) if m.created_at else None,
            }
            for m in msgs
        ],
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(sess)
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# FAQ 관리 API
# ═══════════════════════════════════════════════════════════════

class FaqCreate(BaseModel):
    category: str = "기타"
    question: str
    answer: str
    keywords: Optional[str] = None
    action_route: Optional[str] = None
    action_handler: Optional[str] = None
    priority: int = 0


class FaqUpdate(BaseModel):
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    keywords: Optional[str] = None
    action_route: Optional[str] = None
    action_handler: Optional[str] = None
    priority: Optional[int] = None
    is_published: Optional[bool] = None


@router.get("/faqs")
async def list_faqs(category: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    """FAQ 목록 — 공개된 것만, 우선순위 내림차순"""
    q = db.query(Faq).filter(Faq.is_published == True)
    if category:
        q = q.filter(Faq.category == category)
    if search:
        pattern = f"%{search}%"
        q = q.filter(or_(Faq.question.ilike(pattern), Faq.answer.ilike(pattern), Faq.keywords.ilike(pattern)))
    faqs = q.order_by(Faq.priority.desc(), Faq.id).all()

    # 카테고리 집계
    cat_rows = db.query(Faq.category, text("COUNT(*)")).filter(Faq.is_published == True).group_by(Faq.category).all()
    categories = [{"name": r[0], "count": int(r[1])} for r in cat_rows]

    return {
        "faqs": [
            {
                "id": f.id,
                "category": f.category,
                "question": f.question,
                "answer": f.answer,
                "keywords": f.keywords,
                "action_route": f.action_route,
                "action_handler": f.action_handler,
                "view_count": f.view_count,
                "helpful_count": f.helpful_count,
                "not_helpful_count": f.not_helpful_count,
                "priority": f.priority,
                "is_published": f.is_published,
                "created_at": str(f.created_at) if f.created_at else None,
            }
            for f in faqs
        ],
        "categories": categories,
    }


@router.get("/faqs/{faq_id}")
async def get_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    # 조회수 증가
    faq.view_count = (faq.view_count or 0) + 1
    db.commit()
    return {
        "id": faq.id,
        "category": faq.category,
        "question": faq.question,
        "answer": faq.answer,
        "keywords": faq.keywords,
        "action_route": faq.action_route,
        "action_handler": faq.action_handler,
        "view_count": faq.view_count,
        "helpful_count": faq.helpful_count,
        "not_helpful_count": faq.not_helpful_count,
    }


@router.post("/faqs", status_code=201)
async def create_faq(data: FaqCreate, db: Session = Depends(get_db)):
    faq = Faq(**data.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return {"id": faq.id}


@router.put("/faqs/{faq_id}")
async def update_faq(faq_id: int, data: FaqUpdate, db: Session = Depends(get_db)):
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(faq, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/faqs/{faq_id}")
async def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    db.delete(faq)
    db.commit()
    return {"ok": True}


class FeedbackBody(BaseModel):
    is_helpful: bool
    comment: Optional[str] = None
    user_name: Optional[str] = None


@router.post("/faqs/{faq_id}/feedback")
async def submit_feedback(faq_id: int, body: FeedbackBody, db: Session = Depends(get_db)):
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    fb = FaqFeedback(
        faq_id=faq_id,
        user_name=body.user_name,
        is_helpful=body.is_helpful,
        comment=body.comment,
    )
    db.add(fb)
    if body.is_helpful:
        faq.helpful_count = (faq.helpful_count or 0) + 1
    else:
        faq.not_helpful_count = (faq.not_helpful_count or 0) + 1
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# 스트리밍 엔드포인트 (Phase 2-A) — SSE
# ═══════════════════════════════════════════════════════════════

from fastapi.responses import StreamingResponse


@router.post("/message/stream")
async def chat_message_stream(req: ChatRequest, db: Session = Depends(get_db)):
    """SSE 기반 스트리밍 응답 — JSON actions/suggestions는 끝에 한 번에."""

    def stream_generator():
        try:
            # 세션 확보 + 사용자 메시지 저장
            session = get_or_create_session(db, req.session_id, req.user_name, req.message, req.page)
            save_message(db, session.id, "user", req.message, current_page=req.page)

            # FAQ 매칭 — 있으면 바로 반환 (스트리밍 없이)
            if not req.attachments:
                faq = find_matching_faq(db, req.message)
                if faq:
                    faq.view_count = (faq.view_count or 0) + 1
                    db.commit()
                    actions = []
                    if faq.action_route:
                        actions.append({"type": "navigate", "label": "바로가기", "route": faq.action_route})
                    if faq.action_handler:
                        actions.append({"type": "execute", "label": "실행", "handler": faq.action_handler})
                    save_message(db, session.id, "assistant", faq.answer,
                                 actions=actions, matched_faq_id=faq.id)
                    final = {"reply": faq.answer, "actions": actions, "suggestions": [], "session_id": session.id, "matched_faq_id": faq.id}
                    yield f"data: {json.dumps({'type': 'chunk', 'text': faq.answer}, ensure_ascii=False)}\n\n"
                    yield f"data: {json.dumps({'type': 'done', **final}, ensure_ascii=False)}\n\n"
                    return

            # 페이지별 시스템 프롬프트 (chat_message와 동일)
            page_context = _build_page_context(req.page, req.base_ym, req.period_type, req.user_role)

            attachment_context = ""
            if req.attachments:
                lines = ["\n\n[사용자 첨부]"]
                for i, att in enumerate(req.attachments, 1):
                    if isinstance(att, dict):
                        lines.append(f"{i}. {att.get('label','')} — {att.get('summary','')}")
                attachment_context = "\n".join(lines)

            messages = [{"role": "system", "content": SYSTEM_PROMPT + page_context + attachment_context}]
            if req.history:
                for h in req.history[-10:]:
                    if isinstance(h, dict):
                        messages.append({"role": h.get("role", "user"), "content": h.get("text", "")})
            messages.append({"role": "user", "content": req.message})

            ai = get_client()
            model = get_model()

            # Tool 호출이 필요한지 먼저 결정 (non-stream)
            resp = ai.chat.completions.create(
                model=model, messages=messages, tools=TOOLS, tool_choice="auto",
                temperature=0.7, max_tokens=1500,
            )
            asst = resp.choices[0].message

            if asst.tool_calls:
                messages.append(asst)
                for tc in asst.tool_calls:
                    fn_name = tc.function.name
                    fn_args = json.loads(tc.function.arguments)
                    if "base_ym" not in fn_args:
                        fn_args["base_ym"] = req.base_ym
                    if "period_type" not in fn_args:
                        fn_args["period_type"] = req.period_type
                    result = execute_tool(fn_name, fn_args, db)
                    messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

            # 최종 응답은 스트림으로
            stream = ai.chat.completions.create(
                model=model, messages=messages, temperature=0.7, max_tokens=1500, stream=True,
            )
            buffer = ""
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    buffer += delta
                    yield f"data: {json.dumps({'type': 'chunk', 'text': delta}, ensure_ascii=False)}\n\n"

            parsed = _parse_ai_response(buffer)
            save_message(db, session.id, "assistant", parsed["reply"],
                         actions=parsed["actions"], suggestions=parsed["suggestions"],
                         current_page=req.page)
            final = {
                "reply": parsed["reply"],
                "actions": parsed["actions"],
                "suggestions": parsed["suggestions"],
                "session_id": session.id,
            }
            yield f"data: {json.dumps({'type': 'done', **final}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")
