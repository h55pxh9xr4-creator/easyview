const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PeriodType = "monthly" | "cumulative";
export type CompareTarget = "prev_year_cum" | "prev_year_month" | "prev_month" | "prev_month_cum";
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

export const fetchTop3 = (f: FilterState, base_ym_override?: string, period_type_override?: string) =>
  get<Top3Data>("/api/summary/top3", { base_ym: base_ym_override ?? f.baseYm, period_type: period_type_override ?? f.periodType });

export const fetchIndicators = (f: FilterState) =>
  get<IndicatorData>("/api/summary/indicators", { base_ym: f.baseYm, period_type: f.periodType, compare_target: f.compareTarget });

export const fetchPLTable = (f: FilterState) =>
  get<PLTableRow[]>("/api/summary/pl_table", { base_ym: f.baseYm, period_type: f.periodType, compare_target: f.compareTarget });

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

export const fetchPLAccountDetail = (f: FilterState, mgmt_acct: string, base_ym_override?: string, period_type_override?: string) =>
  get("/api/pl/account_detail", { base_ym: base_ym_override ?? f.baseYm, period_type: period_type_override ?? f.periodType, mgmt_acct });

export const fetchPLSales = (f: FilterState) =>
  get("/api/pl/sales", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLSalesKPI = (f: FilterState, base_ym_override?: string, period_type_override?: string) =>
  get("/api/pl/sales/kpi", { base_ym: base_ym_override ?? f.baseYm, period_type: period_type_override ?? f.periodType });

export const fetchPLSalesTrend = (f: FilterState) =>
  get("/api/pl/sales/trend", { base_ym: f.baseYm });

export const fetchPLSalesTopDonut = (f: FilterState, top_n: number, base_ym_override?: string, period_type_override?: string) =>
  get("/api/pl/sales/top_donut", { base_ym: base_ym_override ?? f.baseYm, period_type: period_type_override ?? f.periodType, top_n });

export const fetchPLSalesTopChange = (f: FilterState, top_n: number) =>
  get("/api/pl/sales/top_change", { base_ym: f.baseYm, period_type: f.periodType, top_n });

export const fetchPLSalesCounterpartyList = (f: FilterState) =>
  get<string[]>("/api/pl/sales/counterparty_list", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLSalesCounterpartyTrend = (f: FilterState, cp1?: string, cp2?: string) =>
  get("/api/pl/sales/counterparty_trend", { base_ym: f.baseYm, cp1, cp2 });

export const fetchPLSalesVouchers = (f: FilterState) =>
  get("/api/pl/sales/vouchers", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchPLSalesBarRace = (f: FilterState, top_n: number) =>
  get("/api/pl/sales/bar_race", { base_ym: f.baseYm, top_n });

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

export interface BSDisclosureDetail {
  account_items: { mgmt_acct: string; account_name: string; ending: number; opening: number }[];
  monthly_trend: { year_month: string; ending: number }[];
  counterparty_changes: { name: string; dr: number; cr: number; net: number }[];
  vouchers: { date: string; voucher_no: string; account_name: string; counterparty: string; description: string; dr_cr: string; amount: number }[];
}
export const fetchBSDisclosureDetail = (f: FilterState, disclosureAcct: string) =>
  get<BSDisclosureDetail>("/api/bs/disclosure_detail", { base_ym: f.baseYm, disclosure_acct: disclosureAcct });

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

export interface VCHSearchParams {
  keyword?: string; disc_acct?: string; counterparty?: string;
  date_from?: string; date_to?: string; dr_cr?: string;
  page?: number; page_size?: number;
}
export const fetchVCHSearch = (params: VCHSearchParams) =>
  get<{ total: number; page: number; page_size: number; items: VCHSearchItem[] }>(
    "/api/vch/search", params as Record<string, string | number | undefined>);

export interface VCHSearchItem {
  date: string; voucher_no: string; dr_cr: string; amount: number;
  counterparty: string; description: string; account_name: string;
  disclosure_acct: string; mgmt_acct: string;
}

export const fetchVCHVoucherDetail = (voucherNo: string) =>
  get<VCHCounterLineItem[]>("/api/vch/voucher_detail", { voucher_no: voucherNo });

export const fetchVCHSearchDiscAccts = (dateFrom?: string, dateTo?: string) =>
  get<string[]>("/api/vch/search_disc_accts", { date_from: dateFrom, date_to: dateTo });

export const fetchVCHCounterSummary = (params: Omit<VCHSearchParams, "page" | "page_size">) =>
  get<{ account_name: string; disclosure_acct: string; dr: number; cr: number }[]>(
    "/api/vch/counter_summary", params as Record<string, string | undefined>);

export const fetchVCHCounterLines = (params: VCHSearchParams & { sel_accounts?: string }) =>
  get<{ total: number; page: number; page_size: number; items: VCHCounterLineItem[] }>(
    "/api/vch/counter_lines", params as Record<string, string | number | undefined>);

export interface VCHCounterLineItem {
  date: string; voucher_no: string; account_name: string; disclosure_acct: string;
  counterparty: string; description: string; dr_cr: string; amount: number;
}

export const fetchVCHDisclosureAccts = (f: FilterState) =>
  get<string[]>("/api/vch/disclosure_accts", { base_ym: f.baseYm, period_type: f.periodType });

export const fetchVCHKpi = (f: FilterState, discAccts?: string, date?: string) =>
  get<{ total_cnt: number; dr_sum: number; cr_sum: number }>(
    "/api/vch/kpi", { base_ym: f.baseYm, period_type: f.periodType, disc_accts: discAccts, date });

export const fetchVCHDaily = (f: FilterState, discAccts?: string) =>
  get<{ date: string; cnt: number }[]>(
    "/api/vch/daily", { base_ym: f.baseYm, period_type: f.periodType, disc_accts: discAccts });

export const fetchVCHAccountBar = (f: FilterState, discAccts?: string, date?: string) =>
  get<{ disclosure_acct: string; cnt: number }[]>(
    "/api/vch/account_bar", { base_ym: f.baseYm, period_type: f.periodType, disc_accts: discAccts, date });

export const fetchVCHTopCounterparty = (f: FilterState, discAccts?: string, topN = 10, date?: string) =>
  get<{ name: string; cnt: number; pct: number }[]>(
    "/api/vch/top_counterparty", { base_ym: f.baseYm, period_type: f.periodType, disc_accts: discAccts, top_n: topN, date });

export const fetchVCHVouchers = (f: FilterState, discAccts?: string, page = 1, pageSize = 100, date?: string) =>
  get<{ total: number; page: number; page_size: number; items: VCHVoucherItem[] }>(
    "/api/vch/vouchers", { base_ym: f.baseYm, period_type: f.periodType, disc_accts: discAccts, page, page_size: pageSize, date });

export interface VCHVoucherItem {
  date: string; voucher_no: string; account_name: string; counterparty: string;
  description: string; dr_cr: string; amount: number; disclosure_acct: string; mgmt_acct: string;
}

// ── Scenario ─────────────────────────────────────────────────
export const fetchScenario = (num: number, base_ym: string, extra?: Record<string, number>) =>
  get(`/api/scenario/${num}/detail`, { base_ym, ...extra });

export interface SC1Exception { year_month: string; account_name: string; amount: number; dr_cnt: number; cr_cnt: number; total_cnt: number }
export interface SC1Extract   { year_month: string; account_name: string; counterparty: string; dr: number; cr: number }
export interface SC1Line      { date: string; voucher_no: string; account_name: string; counterparty: string; description: string; dr_cr: string; amount: number }

const sc1p = (dateFrom: string, dateTo: string, minAmt: number, maxAmt: number) =>
  ({ date_from: dateFrom, date_to: dateTo, min_amount: minAmt, max_amount: maxAmt });

export const fetchSC1Exceptions = (dateFrom: string, dateTo: string, minAmt: number, maxAmt: number) =>
  get<SC1Exception[]>("/api/scenario/1/exceptions", sc1p(dateFrom, dateTo, minAmt, maxAmt));

export const fetchSC1Extract = (dateFrom: string, dateTo: string, ym: string, accountName: string, amount: number) =>
  get<SC1Extract[]>("/api/scenario/1/extract", { date_from: dateFrom, date_to: dateTo, year_month: ym, account_name: accountName, amount });

export const fetchSC1Lines = (dateFrom: string, dateTo: string, ym: string, accountName: string, amount: number) =>
  get<SC1Line[]>("/api/scenario/1/lines", { date_from: dateFrom, date_to: dateTo, year_month: ym, account_name: accountName, amount });

export interface SC2Exception { year_month: string; amount: number; vch_cnt: number }
export interface SC2Extract   { date: string; type: string; voucher_no: string; account_name: string; counterparty: string; amount: number }
export interface SC2Line      { date: string; voucher_no: string; account_name: string; counterparty: string; description: string; dr_cr: string; amount: number }

const sc2p = (dateFrom: string, dateTo: string, minAmt: number, maxAmt: number) =>
  ({ date_from: dateFrom, date_to: dateTo, min_amount: minAmt, max_amount: maxAmt });

export const fetchSC2Exceptions = (dateFrom: string, dateTo: string, minAmt: number, maxAmt: number) =>
  get<SC2Exception[]>("/api/scenario/2/exceptions", sc2p(dateFrom, dateTo, minAmt, maxAmt));

export const fetchSC2Extract = (dateFrom: string, dateTo: string, ym: string, amount: number) =>
  get<SC2Extract[]>("/api/scenario/2/extract", { date_from: dateFrom, date_to: dateTo, year_month: ym, amount });

export const fetchSC2Lines = (dateFrom: string, dateTo: string, ym: string, amount: number) =>
  get<SC2Line[]>("/api/scenario/2/lines", { date_from: dateFrom, date_to: dateTo, year_month: ym, amount });

export interface SC3Summary { date: string; cnt: number; total_amount: number }
export interface SC3Extract { voucher_no: string; account_name: string; counterparty: string; total_amount: number }

export const fetchSC3Summary = (dateFrom: string, dateTo: string) =>
  get<SC3Summary[]>("/api/scenario/3/summary", { date_from: dateFrom, date_to: dateTo });

export const fetchSC3Extract = (dateFrom: string, dateTo: string, selectedDate: string) =>
  get<SC3Extract[]>("/api/scenario/3/extract", { date_from: dateFrom, date_to: dateTo, selected_date: selectedDate });

export interface SC4Summary { date: string; cnt: number; total_amount: number }
export interface SC4Extract { voucher_no: string; account_name: string; counterparty: string; total_amount: number }

export const fetchSC4Summary = (dateFrom: string, dateTo: string, minAmount: number, maxAmount: number) =>
  get<SC4Summary[]>("/api/scenario/4/summary", { date_from: dateFrom, date_to: dateTo, min_amount: minAmount, max_amount: maxAmount });

export const fetchSC4Extract = (dateFrom: string, dateTo: string, selectedDate: string, minAmount: number, maxAmount: number) =>
  get<SC4Extract[]>("/api/scenario/4/extract", { date_from: dateFrom, date_to: dateTo, selected_date: selectedDate, min_amount: minAmount, max_amount: maxAmount });

export interface SC5Summary { date: string; cnt: number; total_expense: number; total_cash: number }
export interface SC5Extract { voucher_no: string; expense_amount: number; cash_amount: number }

export const fetchSC5Summary = (dateFrom: string, dateTo: string) =>
  get<SC5Summary[]>("/api/scenario/5/summary", { date_from: dateFrom, date_to: dateTo });

export const fetchSC5Extract = (dateFrom: string, dateTo: string, selectedDate: string) =>
  get<SC5Extract[]>("/api/scenario/5/extract", { date_from: dateFrom, date_to: dateTo, selected_date: selectedDate });

export interface SC6Exception { counterparty: string; vch_cnt: number }
export interface SC6Extract { date: string; voucher_no: string; dr_amount: number; cr_amount: number }

export const fetchSC6Exceptions = (dateFrom: string, dateTo: string, threshold: number) =>
  get<SC6Exception[]>("/api/scenario/6/exceptions", { date_from: dateFrom, date_to: dateTo, threshold });

export const fetchSC6Extract = (dateFrom: string, dateTo: string, counterparty: string) =>
  get<SC6Extract[]>("/api/scenario/6/extract", { date_from: dateFrom, date_to: dateTo, counterparty });

// ── Inquiry ──────────────────────────────────────────────────
export const INQUIRY_CATEGORIES = ["Comment", "조회 오류", "데이터 오류", "기타 문의"] as const;
export type InquiryCategory = typeof INQUIRY_CATEGORIES[number];

export interface InquiryItem {
  id: number; category: string; title: string; author: string;
  is_secret: boolean; status: string; created_at: string;
}
export interface InquiryDetail extends InquiryItem {
  content: string; reply: string | null; reply_at: string | null;
}
export const fetchInquiries = () => get<InquiryItem[]>("/api/inquiry");
export const fetchInquiry   = (id: number) => get<InquiryDetail>(`/api/inquiry/${id}`);
export const createInquiry  = (body: { category: string; title: string; content: string; author: string; is_secret: boolean }) =>
  fetch(`${BASE}/api/inquiry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
export const replyInquiry   = (id: number, reply: string) =>
  fetch(`${BASE}/api/inquiry/${id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply }) }).then(r => r.json());
export const updateInquiry  = (id: number, body: { category?: string; title?: string; content?: string; is_secret?: boolean }) =>
  fetch(`${BASE}/api/inquiry/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
export const deleteInquiry  = (id: number) =>
  fetch(`${BASE}/api/inquiry/${id}`, { method: "DELETE" }).then(r => r.json());
