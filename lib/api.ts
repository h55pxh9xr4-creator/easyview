const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PeriodType = "monthly" | "cumulative";
export type CompareTarget = "prev_year_cum" | "prev_year_month" | "prev_month";
export type BsBase = "year_start" | "month_start";

export interface FilterState {
  baseYm: string;
  periodType: PeriodType;
  compareTarget: CompareTarget;
  bsBase: BsBase;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) p.set(k, String(v));
  }
  return p.toString();
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = `${BASE}${path}${params ? "?" + qs(params) : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${path}`);
  return res.json();
}

// ── Filters ──────────────────────────────────────────────────
export const fetchMonths = () => get<string[]>("/api/filters/months");

// ── Summary types ────────────────────────────────────────────
export type KPIData = Record<string, { value: number; prior: number; change_pct: number; vs: string }>;
export type Top3Data = Record<string, { rank: number; name: string; value: number; bar_pct: number }[]>;
export interface IndicatorData { pl: Record<string, number>; bs: Record<string, number> }
export interface PLTableRow { account: string; current: number; prior: number; change_pct: number; is_subtotal: boolean }
export interface BSTableRow { account: string; current: number; prior: number; change_pct: number; indent: number }
export type ScenarioCountData = Record<string, number>;

// ── Summary ──────────────────────────────────────────────────
export const fetchKPI = (f: FilterState) =>
  get<KPIData>("/api/summary/kpi", { base_ym: f.baseYm, period_type: f.periodType, compare_target: f.compareTarget, bs_base: f.bsBase });

export const fetchTop3 = (f: FilterState) =>
  get<Top3Data>("/api/summary/top3", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchIndicators = (f: FilterState) =>
  get<IndicatorData>("/api/summary/indicators", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLTable = (f: FilterState) =>
  get<PLTableRow[]>("/api/summary/pl_table", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchBSTable = (f: FilterState) =>
  get<BSTableRow[]>("/api/summary/bs_table", { base_ym: f.baseYm, bs_base: f.bsBase });

export const fetchScenarioCount = (f: FilterState) =>
  get<ScenarioCountData>("/api/summary/scenario_count", { base_ym: f.baseYm });

// ── PL ───────────────────────────────────────────────────────
export const fetchPLSummary = (f: FilterState) =>
  get("/api/pl/summary", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLTrend = (f: FilterState) =>
  get("/api/pl/trend", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLWaterfall = (f: FilterState) =>
  get("/api/pl/waterfall", { base_ym: f.baseYm });

export const fetchPLAccount = (f: FilterState) =>
  get("/api/pl/account", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLTrendByAccount = (f: FilterState) =>
  get("/api/pl/trend_by_account", { base_ym: f.baseYm });

export const fetchPLAccountDetail = (f: FilterState, mgmt_acct: string) =>
  get("/api/pl/account_detail", { base_ym: f.baseYm, period_type: f.periodType, mgmt_acct });

export const fetchPLSales = (f: FilterState) =>
  get("/api/pl/sales", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLSalesKPI = (f: FilterState) =>
  get("/api/pl/sales/kpi", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLSalesTrend = (f: FilterState) =>
  get("/api/pl/sales/trend", { base_ym: f.baseYm });

export const fetchPLSalesTopDonut = (f: FilterState, top_n: number) =>
  get("/api/pl/sales/top_donut", { base_ym: f.baseYm, period_type: f.periodType, top_n });

export const fetchPLSalesTopChange = (f: FilterState, top_n: number) =>
  get("/api/pl/sales/top_change", { base_ym: f.baseYm, period_type: f.periodType, top_n });

export const fetchPLSalesCounterpartyList = (f: FilterState) =>
  get<string[]>("/api/pl/sales/counterparty_list", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLSalesCounterpartyTrend = (f: FilterState, cp1?: string, cp2?: string) =>
  get("/api/pl/sales/counterparty_trend", { base_ym: f.baseYm, cp1, cp2 });

export const fetchPLSalesVouchers = (f: FilterState) =>
  get("/api/pl/sales/vouchers", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLItems = (f: FilterState) =>
  get("/api/pl/items", { base_ym: f.baseYm, period_type: f.periodType });

export type ViewType = "month" | "quarter" | "year";
export const fetchPLItemsTable = (f: FilterState, view_type: ViewType) =>
  get("/api/pl/items/table", { base_ym: f.baseYm, view_type });

// ── BS ───────────────────────────────────────────────────────
export const fetchBSSummary = (f: FilterState) =>
  get("/api/bs/summary", { base_ym: f.baseYm, bs_base: f.bsBase });

export const fetchBSKPI = (f: FilterState) =>
  get("/api/bs/kpi", { base_ym: f.baseYm });

export const fetchBSTrendDetail = (f: FilterState) =>
  get("/api/bs/trend_detail", { base_ym: f.baseYm });

export const fetchBSRatios = (f: FilterState) =>
  get("/api/bs/ratios", { base_ym: f.baseYm });

export const fetchBSActivity = (f: FilterState) =>
  get("/api/bs/activity", { base_ym: f.baseYm });

export const fetchBSTrend = (f: FilterState) =>
  get("/api/bs/trend", { base_ym: f.baseYm });

export const fetchBSAccount = (f: FilterState, category?: string) =>
  get("/api/bs/account", { base_ym: f.baseYm, bs_base: f.bsBase, category });

export const fetchBSDisclosures = () =>
  get<string[]>("/api/bs/disclosures");

export const fetchBSAcctNames = (disclosureAcct: string) =>
  get<string[]>("/api/bs/acct_names", { disclosure_acct: disclosureAcct });

export interface DailyBalanceRow { date: string; balance: number }
export const fetchBSDailyBalance = (
  disclosureAcct: string, accountName: string | null, dateFrom: string, dateTo: string,
) => get<DailyBalanceRow[]>("/api/bs/daily_balance", {
  disclosure_acct: disclosureAcct,
  account_name: accountName ?? undefined,
  date_from: dateFrom,
  date_to: dateTo,
});

export interface DailyDetailData {
  counterparty_dr: { name: string; amount: number }[];
  counterparty_cr: { name: string; amount: number }[];
  counter_accounts: { account_name: string; disclosure_acct: string; dr: number; cr: number }[];
  vouchers: { date: string; voucher_no: string; account_name: string; disclosure_acct: string; counterparty: string; description: string; dr_cr: string; amount: number }[];
}
export const fetchBSDailyDetail = (
  disclosureAcct: string,
  accountName: string | null,
  opts: { date: string } | { dateFrom: string; dateTo: string },
) => get<DailyDetailData>("/api/bs/daily_detail", {
  disclosure_acct: disclosureAcct,
  account_name: accountName ?? undefined,
  ...("date" in opts ? { date: opts.date } : { date_from: opts.dateFrom, date_to: opts.dateTo }),
});

// ── VCH ──────────────────────────────────────────────────────
export const fetchVCHAnalysis = (f: FilterState) =>
  get("/api/vch/analysis", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchVCHSearch = (params: {
  keyword?: string; account?: string; counterparty?: string;
  date_from?: string; date_to?: string; dr_cr?: string;
  page?: number; page_size?: number;
}) => get("/api/vch/search", params as Record<string, string | number | undefined>);

// ── Scenario ─────────────────────────────────────────────────
export const fetchScenario = (num: number, base_ym: string, extra?: Record<string, number>) =>
  get(`/api/scenario/${num}/detail`, { base_ym, ...extra });
