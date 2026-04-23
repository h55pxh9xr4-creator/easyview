"use client";

import Loading from "@/components/ui/Loading";
import { useEffect, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import {
  fetchPLSalesKPI, fetchPLSalesTrend, fetchPLSalesTopDonut,
  fetchPLSalesTopChange, fetchPLSalesCounterpartyList,
  fetchPLSalesCounterpartyTrend, fetchPLSalesVouchers,
  fetchPLSalesBarRace,
} from "@/lib/api";
import ReactECharts from "echarts-for-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useAmountFormat } from "@/lib/fmtAmount";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarController, LineController,
  BarElement, LineElement, PointElement,
  Tooltip, Legend,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale,
  BarController, LineController,
  BarElement, LineElement, PointElement,
  Tooltip, Legend,
);

const fmtPct = (p: number) => `${(p * 100).toFixed(1)}%`;
const sign   = (n: number) => n >= 0 ? "▲" : "▼";

const ORANGE = "#E87722";
const ORANGE_L = "rgba(232,119,34,0.15)";
const GRAY = "rgba(180,180,180,0.4)";
const RED = "#EF4444";
const RED_L = "rgba(192,57,43,0.15)";

const DONUT_COLORS = [
  "#E87722","#f5a623","#f7c26b","#fae0b5",
  "#2C3E50","#5D6D7E","#85929E","#AEB6BF",
  "#2563EB","#aaa",
];

interface BarRaceData {
  year: string;
  months: number[];
  data: { month: number; counterparty: string; amount: number }[];
}

const RACE_COLORS = [
  "#E87722","#f5a623","#2563EB","#10b981","#8b5cf6",
  "#ef4444","#06b6d4","#f59e0b","#ec4899","#6366f1",
  "#14b8a6","#f97316","#84cc16","#a855f7","#0ea5e9",
];

interface KPIData {
  revenue: { current: number; prior: number; change: number; change_pct: number; vs_prev_month: number };
  counterparty_count: { current: number; prior: number; change: number; change_pct: number; vs_prev_month: number };
}
interface TrendRow { month: number; current: number; prior: number }
interface DonutItem { counterparty: string; amount: number; pct: number }
interface DonutData { items: DonutItem[]; top_total: number; top_pct: number }
interface ChangeItem { counterparty: string; current: number; prior: number; change: number }
interface ChangeData { increased: ChangeItem[]; decreased: ChangeItem[] }
interface CpTrend { cp1: { month: number; amount: number }[]; cp2: { month: number; amount: number }[] }
interface VoucherRow { date: string; voucher_no: string; counterparty: string; description: string; amount: number; dr_cr: string }
interface VoucherData { current: VoucherRow[]; prior: VoucherRow[] }

// ── KPI 카드 ──────────────────────────────────────────────────
function KpiCard({ label, value, unit, prior, change, changePct, vsPrevMonth, isDark = false }: {
  label: string; value: number | string; unit: string;
  prior: number | string; change: number; changePct: number; vsPrevMonth: number;
  isDark?: boolean;
}) {
  const up = change >= 0;
  const secClr  = isDark ? "#9198A8" : "#999";
  const priorClr = isDark ? "#E2E5EC" : "#555";
  return (
    <div className="kpi" style={{ flex: 1 }}>
      <div className="kpi-lbl">{label}</div>
      <div className="kpi-val">{typeof value === "number" ? value.toLocaleString("ko-KR") : value}<span className="u">{unit}</span></div>
      <div style={{ marginTop: 10, fontSize: 11, color: secClr, display: "flex", flexDirection: "column", gap: 3 }}>
        <div>전기 &nbsp;<span style={{ color: priorClr }}>{typeof prior === "number" ? prior.toLocaleString("ko-KR") : prior}{unit}</span></div>
        <div>증감 &nbsp;
          <span className={up ? "up-t" : "dn-t"}>{sign(change)}{typeof change === "number" ? Math.abs(change).toLocaleString("ko-KR") : change}{unit}</span>
          &nbsp;<span style={{ fontSize: 10 }}>({fmtPct(Math.abs(changePct))})</span>
        </div>
        <div>전월대비증감 &nbsp;
          <span className={vsPrevMonth >= 0 ? "up-t" : "dn-t"}>{sign(vsPrevMonth)}{Math.abs(vsPrevMonth).toLocaleString("ko-KR")}{unit}</span>
        </div>
      </div>
    </div>
  );
}

// ── 월별 거래처 순위 ECharts 바 (Bar Race) ────────────────────
function MonthlyRaceBar({ barRace, selectedMonth, topN, colorMap, isDark = false }: {
  barRace: BarRaceData | null;
  selectedMonth: number | null;
  topN: number;
  colorMap: Record<string, string>;
  isDark?: boolean;
}) {
  if (!barRace) return <Loading />;

  let items: { counterparty: string; amount: number }[];
  if (selectedMonth === null) {
    const totals: Record<string, number> = {};
    barRace.data.forEach(d => { totals[d.counterparty] = (totals[d.counterparty] ?? 0) + d.amount; });
    items = Object.entries(totals)
      .map(([counterparty, amount]) => ({ counterparty, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topN);
  } else {
    items = barRace.data
      .filter(d => d.month === selectedMonth)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topN);
  }

  const sorted = [...items].reverse();
  const { fmtAmt, unitLabel } = useAmountFormat();
  const gridClr  = isDark ? "#2E3039" : "#f5f5f5";
  const axisClr  = isDark ? "#9198A8" : "#555";
  const xAxisClr = isDark ? "#9198A8" : "#bbb";

  const option = {
    backgroundColor: "transparent",
    grid: { top: 8, bottom: 28, left: 140, right: 100 },
    xAxis: {
      max: "dataMax",
      axisLabel: {
        formatter: (n: number) => `${fmtAmt(n)}${unitLabel}`,
        fontSize: 10, color: xAxisClr,
      },
      splitLine: { lineStyle: { color: gridClr } },
    },
    yAxis: {
      type: "category",
      data: sorted.map(d => d.counterparty),
      animationDuration: 300,
      animationDurationUpdate: 700,
      axisLabel: {
        fontSize: 11, color: axisClr,
        formatter: (v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v,
      },
    },
    series: [{
      realtimeSort: false,
      type: "bar",
      data: sorted.map(d => ({
        value: d.amount,
        itemStyle: { color: colorMap[d.counterparty] ?? ORANGE, borderRadius: [0, 3, 3, 0] },
      })),
      label: {
        show: true, position: "right",
        formatter: (p: { value: number }) => `${fmtAmt(p.value)}${unitLabel}`,
        fontSize: 10, color: axisClr,
      },
      barMaxWidth: 28,
    }],
    animationDuration: 400,
    animationDurationUpdate: 700,
    animationEasing: "cubicOut" as const,
    animationEasingUpdate: "cubicOut" as const,
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(sorted.length * 34 + 40, 200) }}
      notMerge={false}
      lazyUpdate={false}
    />
  );
}

// ── 전표 테이블 ────────────────────────────────────────────────
function VoucherTable({ rows, title, onRowClick, isDark = false }: {
  rows: VoucherRow[]; title: string;
  onRowClick?: (r: VoucherRow, rect: { top: number; right: number }, el: HTMLElement) => void;
  isDark?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const stickyHd = isDark ? "#1C1F26" : "#fff";
  const stickyFt = isDark ? "#252830" : "#fafafa";
  const arrowClr = isDark ? "#9198A8" : "#aaa";
  return (
    <div className="card">
      <div className="sec-hd" style={{ cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: 13, color: arrowClr }}>{open ? "▾" : "▸"}</span>
        <span className="sec-hd-txt">{title}</span>
        <div className="sec-hd-line" />
      </div>
      {open && (
        <div style={{ overflowY: "auto", maxHeight: 280, overflowX: "auto" }}>
          <table style={{ minWidth: 700 }}>
            <thead style={{ position: "sticky", top: 0, background: stickyHd, zIndex: 1 }}>
              <tr>
                <th style={{ textAlign: "center" }}>일자</th>
                <th style={{ textAlign: "center" }}>전표번호</th>
                <th style={{ textAlign: "center" }}>거래처</th>
                <th style={{ textAlign: "center" }}>적요</th>
                <th style={{ textAlign: "center" }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ cursor: onRowClick ? "pointer" : undefined }} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onRowClick?.(r, { top: rect.top, right: rect.right }, e.currentTarget); }}>
                  <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>{r.date}</td>
                  <td style={{ fontSize: 11, textAlign: "center" }}>{r.voucher_no}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "left" }}>{r.counterparty}</td>
                  <td style={{ maxWidth: 300, textAlign: "left" }}>{r.description}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.amount.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tr-sum" style={{ position: "sticky", bottom: 0, background: stickyFt }}>
                <td colSpan={4}>합계</td>
                <td style={{ textAlign: "right" }}>{total.toLocaleString("ko-KR")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────
export default function PLSales() {
  const isDark = useDarkMode();
  const { fmtAmt, unitLabel, amountUnit } = useAmountFormat();
  const unitDivisor = { "원": 1, "천": 1_000, "백만": 1_000_000, "억": 100_000_000 }[amountUnit];
  const filter = useFilter();
  const { triggerComment, target: cmtTarget, panelOpen } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const lift = (label: string): React.CSSProperties => {
    const viewingInquiry = panelOpen && !!cmtTarget?.inquiryId && cmtTarget.page === "매출분석" && cmtTarget.label === label;
    const isSelected = !!cmtTarget && !cmtTarget.inquiryId && cmtTarget.page === "매출분석" && cmtTarget.label === label;
    if (viewingInquiry) {
      return { boxShadow: "0 8px 24px rgba(232,119,34,0.14), 0 0 0 2px rgba(232,119,34,0.28), 0 0 0 10px rgba(232,119,34,0.04)", borderRadius: 10, transform: "translateY(-4px)", zIndex: 10, transition: "all 0.25s" };
    }
    if (isSelected) {
      return { boxShadow: "0 4px 14px rgba(232,119,34,0.1), 0 0 0 1.5px rgba(232,119,34,0.22), 0 0 0 8px rgba(232,119,34,0.05)", borderRadius: 10, zIndex: 10, transition: "all 0.25s" };
    }
    return { transition: "all 0.25s" };
  };

  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [topN, setTopN] = useState(10);
  const [donut, setDonut] = useState<DonutData | null>(null);
  const [change, setChange] = useState<ChangeData | null>(null);
  const [cpList, setCpList] = useState<string[]>([]);
  const [cp1, setCp1] = useState<string>("");
  const [cp2, setCp2] = useState<string>("");
  const [cpTrend, setCpTrend] = useState<CpTrend | null>(null);
  const [vouchers, setVouchers] = useState<VoucherData | null>(null);
  const [selectedCp, setSelectedCp] = useState<string | null>(null);
  const [selectedCpTrend, setSelectedCpTrend] = useState<{ cur: { month: number; amount: number }[]; pri: { month: number; amount: number }[] } | null>(null);
  const [barRace, setBarRace] = useState<BarRaceData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [monthlyKpi, setMonthlyKpi] = useState<KPIData | null>(null);
  const [hoverDonut, setHoverDonut] = useState<{ name: string; value: number; percent: number } | null>(null);
  const [selectedDonutInfo, setSelectedDonutInfo] = useState<{ name: string; value: number; percent: number } | null>(null);
  const selectedDonutRef = useRef<{ name: string; value: number; percent: number } | null>(null);

  // 기본 데이터 로드
  useEffect(() => {
    fetchPLSalesKPI(filter).then(d => setKpi(d as KPIData)).catch(console.error);
    fetchPLSalesTrend(filter).then(d => setTrend(d as TrendRow[])).catch(console.error);
    fetchPLSalesCounterpartyList(filter).then(d => {
      setCpList(d);
      if (d.length > 0 && !cp1) setCp1(d[0]);
      if (d.length > 1 && !cp2) setCp2(d[1]);
    }).catch(console.error);
    fetchPLSalesVouchers(filter).then(d => setVouchers(d as VoucherData)).catch(console.error);
    fetchPLSalesBarRace(filter, 15).then(d => setBarRace(d as BarRaceData)).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  // 월 선택 시 해당 월 KPI 조회
  useEffect(() => {
    if (selectedMonth === null) { setMonthlyKpi(null); return; }
    const year = filter.baseYm.split("-")[0];
    const monthYm = `${year}-${String(selectedMonth).padStart(2, "0")}`;
    fetchPLSalesKPI(filter, monthYm, "monthly").then(d => setMonthlyKpi(d as KPIData)).catch(console.error);
  }, [selectedMonth, filter.baseYm]);

  // 도넛 / 변화 — topN 또는 selectedMonth 변경 시 재조회
  useEffect(() => {
    const year = filter.baseYm.split("-")[0];
    const monthYm = selectedMonth !== null
      ? `${year}-${String(selectedMonth).padStart(2, "0")}`
      : undefined;
    const pt = selectedMonth !== null ? "monthly" : undefined;
    fetchPLSalesTopDonut(filter, topN, monthYm, pt).then(d => setDonut(d as DonutData)).catch(console.error);
    fetchPLSalesTopChange(filter, topN).then(d => setChange(d as ChangeData)).catch(console.error);
  }, [filter.baseYm, filter.periodType, topN, selectedMonth]);

  // 도넛 클릭 → 선택 거래처 당기/전기 추이
  useEffect(() => {
    if (!selectedCp) { setSelectedCpTrend(null); return; }
    fetchPLSalesCounterpartyTrend(filter, selectedCp, undefined)
      .then((d: unknown) => {
        const r = d as CpTrend & { cp1_prior: { month: number; amount: number }[] };
        setSelectedCpTrend({ cur: r.cp1, pri: r.cp1_prior });
      })
      .catch(console.error);
  }, [filter.baseYm, selectedCp]);

  // 거래처별 비교 추이
  useEffect(() => {
    if (!cp1 && !cp2) return;
    fetchPLSalesCounterpartyTrend(filter, cp1 || undefined, cp2 || undefined)
      .then(d => setCpTrend(d as CpTrend)).catch(console.error);
  }, [filter.baseYm, cp1, cp2]);

  // ── 매출 추이 차트 데이터 ────────────────────────────────────
  const trendLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
  const trendCur = trendLabels.map(m => {
    const row = trend.find(r => r.month === parseInt(m));
    return row ? row.current : 0;
  });
  const trendPri = trendLabels.map(m => {
    const row = trend.find(r => r.month === parseInt(m));
    return row ? row.prior : 0;
  });

  // ── 도넛 차트 데이터 ─────────────────────────────────────────
  // 다크모드 차트 색상
  const gridClr     = isDark ? "#2E3039" : "#f0f0f0";
  const axisLineClr = isDark ? "#2E3039" : "#eee";
  const axisLblClr  = isDark ? "#9198A8" : "#bbb";
  const lgdClr      = isDark ? "#9198A8" : "#888";
  const tooltipBg   = isDark ? "#1C1F26" : "#fff";
  const tooltipBdr  = isDark ? "#2E3039" : "#eee";
  const tooltipTxt  = isDark ? "#E2E5EC" : "#333";
  const selectBdr   = isDark ? "#2E3039" : "#ddd";
  const selectClr   = isDark ? "#E2E5EC" : "#555";
  const selectBg    = isDark ? "#1C1F26" : "#fff";
  const donutBdr    = isDark ? "#1C1F26" : "#fff";

  // ── 거래처별 비교 차트 ───────────────────────────────────────
  const cpLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
  const cpOption = cpTrend ? {
    backgroundColor: "transparent",
    grid: { top: 48, bottom: 8, left: 8, right: 16, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg, borderColor: tooltipBdr,
      textStyle: { color: tooltipTxt, fontSize: 11 },
      formatter: (params: { seriesName: string; value: number }[]) =>
        params.map(p => `${p.seriesName}: ${fmtAmt(p.value ?? 0)}${unitLabel}`).join("<br/>"),
    },
    legend: {
      data: [cp1 || "거래처1", cp2 || "거래처2"],
      top: 0,
      left: "center",
      textStyle: { color: lgdClr, fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    xAxis: {
      type: "category",
      data: cpLabels,
      axisLabel: { color: axisLblClr, fontSize: 10 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: axisLineClr } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: axisLblClr, fontSize: 10, formatter: (v: number) => `${fmtAmt(v)}${unitLabel}` },
      splitLine: { lineStyle: { color: gridClr } },
    },
    series: [
      {
        name: cp1 || "거래처1",
        type: "line",
        smooth: true,
        color: ORANGE,
        data: cpLabels.map((_, i) => {
          const row = cpTrend.cp1.find(r => r.month === i + 1);
          return row ? row.amount : null;
        }),
        connectNulls: true,
        markPoint: {
          symbol: "pin",
          symbolSize: 52,
          itemStyle: { color: ORANGE },
          label: {
            fontSize: 10, color: "#fff", fontWeight: 700,
            formatter: (p: { value: number }) => fmtAmt(p.value),
          },
          data: [{ type: "max", name: "최대" }, { type: "min", name: "최소" }],
        },
      },
      {
        name: cp2 || "거래처2",
        type: "line",
        smooth: true,
        color: RED,
        data: cpLabels.map((_, i) => {
          const row = cpTrend.cp2.find(r => r.month === i + 1);
          return row ? row.amount : null;
        }),
        connectNulls: true,
        markPoint: {
          symbol: "pin",
          symbolSize: 52,
          itemStyle: { color: RED },
          label: {
            fontSize: 10, color: "#fff", fontWeight: 700,
            formatter: (p: { value: number }) => fmtAmt(p.value),
          },
          data: [{ type: "max", name: "최대" }, { type: "min", name: "최소" }],
        },
      },
    ],
  } : null;

  if (!kpi) return <Loading />;

  // 공통 colorMap (파이차트 + 막대차트 색상 통일)
  const colorMap: Record<string, string> = {};
  if (barRace) {
    Array.from(new Set(barRace.data.map(d => d.counterparty)))
      .forEach((cp, i) => { colorMap[cp] = RACE_COLORS[i % RACE_COLORS.length]; });
  }

  // 월 선택 시 monthlyKpi 사용, 미선택 시 전체 KPI
  const activeKpi = (selectedMonth !== null && monthlyKpi) ? monthlyKpi : kpi;
  const cnt = activeKpi.counterparty_count;
  const kpiLabel = selectedCp ? `${selectedCp} 매출액` : selectedMonth !== null ? `${selectedMonth}월 매출액` : "매출액";

  // 거래처 선택 시 해당 거래처 KPI로 오버라이드
  const cpChangeItem = selectedCp && change
    ? [...(change.increased ?? []), ...(change.decreased ?? [])].find(c => c.counterparty === selectedCp)
    : null;
  const rev = cpChangeItem
    ? {
        current:      cpChangeItem.current,
        prior:        cpChangeItem.prior,
        change:       cpChangeItem.change,
        change_pct:   cpChangeItem.prior !== 0 ? cpChangeItem.change / Math.abs(cpChangeItem.prior) * 100 : 0,
        vs_prev_month: 0,
      }
    : activeKpi.revenue;

  return (
    <div className="wrap">


      {/* ── 전체 레이아웃: 2열 그리드 2행 ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gridTemplateRows: "auto auto", gap: 14 }}>

        {/* [1,1] KPI 카드 2개 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, gridColumn: "1", gridRow: "1", alignSelf: "stretch" }}>
          <div style={{ cursor: "pointer", position: "relative", ...lift(kpiLabel) }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "매출분석", label: kpiLabel, value: `${fmtAmt(rev.current)}${unitLabel}` }, { top: r.top, right: r.right }, e.currentTarget); }}>
            {ck.has(commentKey("매출분석", kpiLabel)) && <CommentDot inquiryId={ck.get(commentKey("매출분석", kpiLabel))!} />}
            <KpiCard
              label={kpiLabel} unit={unitLabel}
              value={fmtAmt(rev.current)} prior={fmtAmt(rev.prior)}
              change={Math.round(rev.change / unitDivisor)}
              changePct={rev.change_pct}
              vsPrevMonth={Math.round(rev.vs_prev_month / unitDivisor)}
              isDark={isDark}
            />
          </div>
          <div style={{ cursor: "pointer", position: "relative", ...lift("거래처수") }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "매출분석", label: "거래처수", value: String(cnt.current) }, { top: r.top, right: r.right }, e.currentTarget); }}>
            {ck.has(commentKey("매출분석", "거래처수")) && <CommentDot inquiryId={ck.get(commentKey("매출분석", "거래처수"))!} />}
            <KpiCard
              label="거래처수" unit="개"
              value={cnt.current} prior={cnt.prior}
              change={cnt.change}
              changePct={cnt.change_pct}
              vsPrevMonth={cnt.vs_prev_month}
              isDark={isDark}
            />
          </div>
        </div>

        {/* [1,2] 매출액 추이 차트 */}
        <div className="card" style={{ gridColumn: "2", gridRow: "1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div className="card-title" style={{ margin: 0 }}>매출액 추이</div>
            {selectedCp && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, background: "rgba(37,99,235,0.08)", padding: "2px 8px", borderRadius: 12 }}>
                  {selectedCp}
                </span>
                <button
                  onClick={() => setSelectedCp(null)}
                  style={{ fontSize: 10, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >✕</button>
              </div>
            )}
            {selectedMonth !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <span style={{ fontSize: 11, color: ORANGE, fontWeight: 700, background: "rgba(232,119,34,0.08)", padding: "2px 8px", borderRadius: 12 }}>
                  {selectedMonth}월 선택됨
                </span>
                <button
                  onClick={() => setSelectedMonth(null)}
                  style={{ fontSize: 10, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >✕</button>
              </div>
            )}
          </div>
          <div style={{ height: 220, cursor: "pointer" }}>
            {(() => {
              const curData = selectedCp && selectedCpTrend
                ? trendLabels.map((_, i) => {
                    const row = selectedCpTrend.cur.find(r => r.month === i + 1);
                    return row ? row.amount : 0;
                  })
                : trendCur;
              const priData = selectedCp && selectedCpTrend
                ? trendLabels.map((_, i) => {
                    const row = selectedCpTrend.pri.find(r => r.month === i + 1);
                    return row ? row.amount : 0;
                  })
                : trendPri;

              const trendOption = {
                backgroundColor: "transparent",
                grid: { top: 56, bottom: 40, left: 8, right: 16, containLabel: true },
                tooltip: {
                  trigger: "axis",
                  backgroundColor: tooltipBg, borderColor: tooltipBdr,
                  textStyle: { color: tooltipTxt, fontSize: 11 },
                  formatter: (params: {seriesName: string; value: number}[]) =>
                    params.map(p => `${p.seriesName}: ${fmtAmt(p.value)}${unitLabel}`).join("<br/>"),
                },
                legend: {
                  data: ["당기", "전기"],
                  bottom: 0,
                  left: "center",
                  textStyle: { color: lgdClr, fontSize: 10 },
                  itemWidth: 10, itemHeight: 10,
                },
                xAxis: {
                  type: "category",
                  data: trendLabels,
                  axisLabel: { color: axisLblClr, fontSize: 10 },
                  axisTick: { show: false },
                  axisLine: { lineStyle: { color: axisLineClr } },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { color: axisLblClr, fontSize: 10, formatter: (v: number) => `${fmtAmt(v)}${unitLabel}` },
                  splitLine: { lineStyle: { color: gridClr } },
                },
                series: [
                  {
                    name: "당기",
                    type: "bar",
                    color: ORANGE,
                    barMaxWidth: 24,
                    data: curData.map((v, i) => ({
                      value: v,
                      itemStyle: { color: selectedMonth === i + 1 ? "#2563EB" : ORANGE, borderRadius: [3, 3, 0, 0] },
                    })),
                    markPoint: {
                      symbol: "pin",
                      symbolSize: 52,
                      itemStyle: { color: ORANGE },
                      label: {
                        fontSize: 10, color: "#fff", fontWeight: 700,
                        formatter: (p: {value: number}) => `${fmtAmt(p.value)}`,
                      },
                      data: [
                        { type: "max", name: "최대" },
                        { type: "min", name: "최소" },
                      ],
                    },
                  },
                  {
                    name: "전기",
                    type: "bar",
                    color: "rgba(180,180,180,0.45)",
                    barMaxWidth: 24,
                    data: priData.map(v => ({
                      value: v,
                      itemStyle: { color: "rgba(180,180,180,0.45)", borderRadius: [3, 3, 0, 0] },
                    })),
                    markPoint: {
                      symbol: "pin",
                      symbolSize: 52,
                      itemStyle: { color: "#999" },
                      label: {
                        fontSize: 10, color: "#fff", fontWeight: 700,
                        formatter: (p: {value: number}) => `${fmtAmt(p.value)}`,
                      },
                      data: [
                        { type: "max", name: "최대" },
                        { type: "min", name: "최소" },
                      ],
                    },
                  },
                ],
              };

              return (
                <ReactECharts
                  option={trendOption}
                  style={{ height: "100%" }}
                  notMerge={true}
                  onEvents={{
                    click: (params: { componentType: string; dataIndex: number }) => {
                      if (params.componentType !== "series") { setSelectedMonth(null); return; }
                      const mo = params.dataIndex + 1;
                      setSelectedMonth(prev => prev === mo ? null : mo);
                    },
                  }}
                />
              );
            })()}
          </div>
        </div>

        {/* [2,1] 도넛 — PLAccount 스타일 폴리라인 라벨 */}
        <div className="card" style={{ gridColumn: "1", gridRow: "2", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0, fontSize: 12 }}>
              상위 {topN}개 거래처 비중
              {selectedMonth !== null
                ? <span style={{ fontSize: 10, color: ORANGE, marginLeft: 6, fontWeight: 400 }}>{selectedMonth}월</span>
                : <span style={{ fontSize: 10, color: "#aaa", marginLeft: 6, fontWeight: 400 }}>당기</span>
              }
            </div>
            <select
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 5, border: `1px solid ${selectBdr}`, color: selectClr, background: selectBg }}
            >
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {donut && (
            <ReactECharts
              option={{
                backgroundColor: "transparent",
                tooltip: {
                  trigger: "item",
                  backgroundColor: tooltipBg, borderColor: tooltipBdr,
                  textStyle: { color: tooltipTxt, fontSize: 11 },
                  position: (point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: { contentSize: number[]; viewSize: number[] }) => {
                    const [x, y] = point;
                    const [w, h] = size.contentSize;
                    const isTop = y < size.viewSize[1] / 2;
                    return [x - w / 2, isTop ? y - h - 16 : y + 16];
                  },
                  formatter: (p: { name: string; value: number; percent: number }) =>
                    `${p.name}<br/>${fmtAmt(p.value)}${unitLabel} (${p.percent.toFixed(1)}%)`,
                },
                legend: { show: false },
                graphic: hoverDonut ? [{
                  type: "group",
                  left: "center",
                  top: "center",
                  children: [
                    { type: "text", z: 100, left: "center", top: -22, style: { text: hoverDonut.name.length > 10 ? hoverDonut.name.slice(0, 10) + "…" : hoverDonut.name, font: `700 12px sans-serif`, fill: isDark ? "#E2E5EC" : "#222", textAlign: "center" } },
                    { type: "text", z: 100, left: "center", top: 2,   style: { text: `${fmtAmt(hoverDonut.value)}${unitLabel}`, font: `800 15px sans-serif`, fill: ORANGE, textAlign: "center" } },
                    { type: "text", z: 100, left: "center", top: 24,  style: { text: `(${hoverDonut.percent.toFixed(1)}%)`, font: `400 11px sans-serif`, fill: isDark ? "#9198A8" : "#888", textAlign: "center" } },
                  ],
                }] : [],
                series: [{
                  name: "거래처 비중",
                  type: "pie",
                  radius: ["38%", "55%"],
                  center: ["50%", "50%"],
                  avoidLabelOverlap: true,
                  minShowLabelAngle: 20,
                  itemStyle: { borderRadius: 6, borderColor: donutBdr, borderWidth: 2 },
                  label: {
                    show: true,
                    position: "outside",
                    formatter: (p: { name: string; value: number; percent: number }) => {
                      const n = p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name;
                      return `${n}\n${p.percent.toFixed(1)}%`;
                    },
                    fontSize: 10,
                    lineHeight: 15,
                    color: isDark ? "#C8CDD8" : "#444",
                  },
                  emphasis: {
                    label: { show: false },
                    itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.28)" },
                  },
                  labelLine: { show: true, length: 8, length2: 12 },
                  data: donut.items.map((item, i) => ({
                    value: item.amount,
                    name: item.counterparty,
                    itemStyle: {
                      color: item.counterparty === selectedCp
                        ? "#2563EB"
                        : (colorMap[item.counterparty] ?? RACE_COLORS[i % RACE_COLORS.length]),
                      borderWidth: item.counterparty === selectedCp ? 3 : 2,
                      opacity: selectedCp && item.counterparty !== selectedCp ? 0.4 : 1,
                    },
                  })),
                }],
              }}
              style={{ height: 430, cursor: "pointer" }}
              notMerge={true}
              onEvents={{
                click: (p: { name: string; value: number; percent: number }) => {
                  if (!p.name || p.name === "기타") return;
                  const isDeselecting = selectedCp === p.name;
                  setSelectedCp(prev => prev === p.name ? null : p.name);
                  const info = isDeselecting ? null : { name: p.name, value: p.value, percent: p.percent };
                  setSelectedDonutInfo(info);
                  selectedDonutRef.current = info;
                  setHoverDonut(info);
                },
                mouseover: (p: { name: string; value: number; percent: number }) => {
                  if (p.name) setHoverDonut({ name: p.name, value: p.value, percent: p.percent });
                },
                mouseout: () => setHoverDonut(selectedDonutRef.current),
              }}
            />
          )}
        </div>

        {/* [2,2] 거래처 매출 순위 (월 클릭 연동 Bar Race) */}
        <div className="card" style={{ gridColumn: "2", gridRow: "2" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>
              상위 거래처 매출 순위
              {selectedMonth !== null
                ? <span style={{ fontSize: 11, color: ORANGE, marginLeft: 8, fontWeight: 400 }}>{selectedMonth}월</span>
                : <span style={{ fontSize: 11, color: "#aaa", marginLeft: 8, fontWeight: 400 }}>누적 · 월을 클릭하면 해당 월로 전환</span>
              }
            </div>
          </div>
          <MonthlyRaceBar barRace={barRace} selectedMonth={selectedMonth} topN={topN} colorMap={colorMap} isDark={isDark} />
        </div>
      </div>

      {/* ── 거래처별 비교 ─────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="card-title" style={{ margin: 0 }}>거래처별 비교</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={cp1}
              onChange={e => setCp1(e.target.value)}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid ${selectBdr}`, color: selectClr, background: selectBg, maxWidth: 200 }}
            >
              <option value="">거래처1 선택</option>
              {cpList.map(cp => <option key={cp} value={cp}>{cp}</option>)}
            </select>
            <select
              value={cp2}
              onChange={e => setCp2(e.target.value)}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: `1px solid ${selectBdr}`, color: selectClr, background: selectBg, maxWidth: 200 }}
            >
              <option value="">거래처2 선택</option>
              {cpList.map(cp => <option key={cp} value={cp}>{cp}</option>)}
            </select>
          </div>
        </div>
        {cpOption && (
          <div style={{ height: 200 }}>
            <ReactECharts option={cpOption} style={{ height: "100%" }} notMerge />
          </div>
        )}
      </div>

      {/* ── 전표 내역 ─────────────────────────────────────────── */}
      {vouchers && (
        <>
          <VoucherTable rows={vouchers.current} title="당기 전표 내역" isDark={isDark} onRowClick={(r, rect, el) => triggerComment({ page: "매출분석", label: r.counterparty, value: r.amount.toLocaleString("ko-KR") }, rect, el)} />
          <VoucherTable rows={vouchers.prior}   title="전기 전표 내역" isDark={isDark} />
        </>
      )}

    </div>
  );
}
