from pydantic import BaseModel
from typing import Optional


# ── 공통 필터 파라미터 ──────────────────────────────────────────
class FilterParams(BaseModel):
    base_ym: str           # "2025-09"
    period_type: str       # "monthly" | "cumulative"
    compare_target: str    # "prev_year_cum" | "prev_year_month" | "prev_month"
    bs_base: str           # "year_start" | "month_start"


# ── Summary ────────────────────────────────────────────────────
class KPIItem(BaseModel):
    label: str
    value: float
    change_pct: float
    change_label: str      # "vs 전기" | "vs 기초"


class Top3Item(BaseModel):
    rank: int
    name: str
    value: float
    bar_pct: float         # 0~100


class IndicatorItem(BaseModel):
    label: str
    value: float           # 소수 (e.g. 0.207 = 20.7%)


class PLTableRow(BaseModel):
    account: str
    current: float
    prior: float
    change_pct: float
    is_subtotal: bool


class BSTableRow(BaseModel):
    account: str
    current: float         # 기말
    prior: float           # 기초
    change_pct: float
    indent: int            # 0=대분류, 1=소분류


class ScenarioCount(BaseModel):
    sc1_dup: int
    sc2_cash_debt: int
    sc3_weekend: int
    sc4_big_cash: int
    sc5_cost_cash: int
    sc6_seldom: int


# ── PL ────────────────────────────────────────────────────────
class PLMonthlyPoint(BaseModel):
    year_month: str
    current: float
    prior: float


class PLSummaryResponse(BaseModel):
    revenue: float
    revenue_prior: float
    gross_profit: float
    gross_profit_prior: float
    operating_income: float
    operating_income_prior: float
    net_income: float
    net_income_prior: float
    prev_month_diff: float


# ── BS ────────────────────────────────────────────────────────
class BSAccountRow(BaseModel):
    account: str
    ending: float
    opening: float
    change: float
    change_pct: float
    sum_acct: str
    category: str


# ── VCH ───────────────────────────────────────────────────────
class VCHRow(BaseModel):
    date: str
    voucher_no: str
    dr_cr: str
    amount: float
    counterparty: Optional[str]
    description: Optional[str]
    account_name: str
    disclosure_acct: str


# ── Scenario ──────────────────────────────────────────────────
class ScenarioRow(BaseModel):
    date: str
    voucher_no: str
    account_name: str
    counterparty: Optional[str]
    description: Optional[str]
    amount: float
    dr_cr: str
