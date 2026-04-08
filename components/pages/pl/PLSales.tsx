"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import {
  fetchPLSalesKPI, fetchPLSalesTrend, fetchPLSalesTopDonut,
  fetchPLSalesTopChange, fetchPLSalesCounterpartyList,
  fetchPLSalesCounterpartyTrend, fetchPLSalesVouchers,
  fetchPLSalesBarRace,
} from "@/lib/api";
import ReactECharts from "echarts-for-react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  Tooltip, Legend, Plugin,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale,
  BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  Tooltip, Legend,
);

// ── 폴리라인 외부 라벨 플러그인 (PLAccount와 동일) ──────────────
const MIN_PCT_LABEL = 2;
const LINE_GAP = 14;

const polylineLabelPlugin: Plugin<"doughnut"> = {
  id: "polylineLabel",
  afterDraw(chart) {
    const { ctx } = chart;
    const ds    = chart.data.datasets[0];
    const meta  = chart.getDatasetMeta(0);
    const total = (ds.data as number[]).reduce((s, v) => s + v, 0) || 1;
    const colors = ds.backgroundColor as string[];
    const labels = (chart.data.labels ?? []) as string[];

    type Lbl = { i: number; pct: number; color: string; name: string;
                 isRight: boolean; x1: number; y1: number;
                 x2: number; y2: number; x3: number; y3: number; };

    const all: Lbl[] = [];
    meta.data.forEach((arc, i) => {
      const val = (ds.data as number[])[i];
      const pct = val / total * 100;
      if (pct < MIN_PCT_LABEL) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a   = arc as any;
      const mid = (a.startAngle + a.endAngle) / 2;
      const r   = a.outerRadius;
      const cx  = a.x, cy = a.y;
      const isRight = Math.cos(mid) >= 0;
      const x1 = cx + Math.cos(mid) * (r + 3);
      const y1 = cy + Math.sin(mid) * (r + 3);
      const x2 = cx + Math.cos(mid) * (r + 18);
      const y2 = cy + Math.sin(mid) * (r + 18);
      const x3 = x2 + (isRight ? 16 : -16);
      all.push({ i, pct, color: colors[i], name: labels[i] ?? "",
                 isRight, x1, y1, x2, y2, x3, y3: y2 });
    });

    const settle = (group: Lbl[]) => {
      group.sort((a, b) => a.y3 - b.y3);
      for (let k = 1; k < group.length; k++) {
        if (group[k].y3 - group[k-1].y3 < LINE_GAP)
          group[k].y3 = group[k-1].y3 + LINE_GAP;
      }
      for (let k = group.length - 2; k >= 0; k--) {
        if (group[k+1].y3 - group[k].y3 < LINE_GAP)
          group[k].y3 = group[k+1].y3 - LINE_GAP;
      }
    };
    settle(all.filter(l =>  l.isRight));
    settle(all.filter(l => !l.isRight));

    ctx.save();
    all.forEach(lbl => {
      const short = lbl.name.length > 9 ? lbl.name.slice(0, 9) + "…" : lbl.name;
      const text  = `${short} ${lbl.pct.toFixed(1)}%`;
      ctx.beginPath();
      ctx.moveTo(lbl.x1, lbl.y1);
      ctx.lineTo(lbl.x2, lbl.y2);
      ctx.lineTo(lbl.x3, lbl.y3);
      ctx.strokeStyle = lbl.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle    = "#333";
      ctx.font         = "10px Inter, sans-serif";
      ctx.textAlign    = lbl.isRight ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillText(text, lbl.x3 + (lbl.isRight ? 3 : -3), lbl.y3);
    });
    ctx.restore();
  },
};

const fmtB   = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const fmtM   = (n: number) => Math.round(n / 10_000).toLocaleString("ko-KR");
const fmtPct = (p: number) => `${(p * 100).toFixed(1)}%`;
const sign   = (n: number) => n >= 0 ? "▲" : "▼";
const absFmtB = (n: number) => `${sign(n)}${fmtB(Math.abs(n))}백만`;

const ORANGE = "#E87722";
const ORANGE_L = "rgba(232,119,34,0.15)";
const GRAY = "rgba(180,180,180,0.4)";
const RED = "#c0392b";
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
function KpiCard({ label, value, unit, prior, change, changePct, vsPrevMonth }: {
  label: string; value: number | string; unit: string;
  prior: number | string; change: number; changePct: number; vsPrevMonth: number;
}) {
  const up = change >= 0;
  return (
    <div className="kpi" style={{ flex: 1 }}>
      <div className="kpi-lbl">{label}</div>
      <div className="kpi-val">{typeof value === "number" ? value.toLocaleString("ko-KR") : value}<span className="u">{unit}</span></div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#999", display: "flex", flexDirection: "column", gap: 3 }}>
        <div>전기 &nbsp;<span style={{ color: "#555" }}>{typeof prior === "number" ? prior.toLocaleString("ko-KR") : prior}{unit}</span></div>
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
function MonthlyRaceBar({ barRace, selectedMonth, topN }: {
  barRace: BarRaceData | null;
  selectedMonth: number | null;
  topN: number;
}) {
  if (!barRace) return <div style={{ color: "#aaa", padding: 20, fontSize: 12 }}>데이터 로딩 중...</div>;

  const allCps = Array.from(new Set(barRace.data.map(d => d.counterparty)));
  const colorMap: Record<string, string> = {};
  allCps.forEach((cp, i) => { colorMap[cp] = RACE_COLORS[i % RACE_COLORS.length]; });

  // 월 선택 없으면 전체 합산
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

  // ECharts는 역순(아래→위)으로 표시하므로 뒤집기
  const sorted = [...items].reverse();

  const option = {
    grid: { top: 8, bottom: 28, left: 10, right: 100, containLabel: true },
    xAxis: {
      max: "dataMax",
      axisLabel: {
        formatter: (n: number) => `${Math.round(n / 1_000_000).toLocaleString("ko-KR")}백만`,
        fontSize: 10, color: "#bbb",
      },
      splitLine: { lineStyle: { color: "#f5f5f5" } },
    },
    yAxis: {
      type: "category",
      data: sorted.map(d => d.counterparty),
      animationDuration: 300,
      animationDurationUpdate: 700,
      axisLabel: {
        fontSize: 11, color: "#555",
        formatter: (v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v,
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
        formatter: (p: { value: number }) => `${Math.round(p.value / 1_000_000).toLocaleString("ko-KR")}백만`,
        fontSize: 10, color: "#555",
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
function VoucherTable({ rows, title }: { rows: VoucherRow[]; title: string }) {
  const [open, setOpen] = useState(true);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="card">
      <div
        className="sec-hd"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ fontSize: 13, color: "#aaa" }}>{open ? "▾" : "▸"}</span>
        <span className="sec-hd-txt">{title}</span>
        <div className="sec-hd-line" />
      </div>
      {open && (
        <div style={{ overflowY: "auto", maxHeight: 280, overflowX: "auto" }}>
          <table style={{ minWidth: 700 }}>
            <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <tr>
                <th>일자</th><th>전표번호</th><th>거래처</th>
                <th>적요</th><th style={{ textAlign: "right" }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.voucher_no}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.counterparty}</td>
                  <td style={{ maxWidth: 300 }}>{r.description}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.amount.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: "#fafafa", position: "sticky", bottom: 0 }}>
                <td colSpan={4}>합계</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{total.toLocaleString("ko-KR")}</td>
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
  const filter = useFilter();

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
    return row ? Math.round(row.current / 1_000_000) : 0;
  });
  const trendPri = trendLabels.map(m => {
    const row = trend.find(r => r.month === parseInt(m));
    return row ? Math.round(row.prior / 1_000_000) : 0;
  });

  // ── 도넛 차트 데이터 ─────────────────────────────────────────
  const donutChartData = donut ? {
    labels: donut.items.map(x => x.counterparty),
    datasets: [{
      data: donut.items.map(x => Math.round(x.amount / 1_000_000)),
      backgroundColor: DONUT_COLORS.slice(0, donut.items.length),
      borderWidth: 1,
      borderColor: "#fff",
    }],
  } : null;

  // ── 거래처별 비교 차트 ───────────────────────────────────────
  const cpLabels = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
  const cpChartData = cpTrend ? {
    labels: cpLabels,
    datasets: [
      {
        label: cp1 || "거래처1",
        data: cpLabels.map((_, i) => {
          const row = cpTrend.cp1.find(r => r.month === i + 1);
          return row ? Math.round(row.amount / 10_000) : null;
        }),
        borderColor: ORANGE,
        backgroundColor: ORANGE_L,
        pointBackgroundColor: ORANGE,
        tension: 0.3,
        spanGaps: true,
      },
      {
        label: cp2 || "거래처2",
        data: cpLabels.map((_, i) => {
          const row = cpTrend.cp2.find(r => r.month === i + 1);
          return row ? Math.round(row.amount / 10_000) : null;
        }),
        borderColor: RED,
        backgroundColor: RED_L,
        pointBackgroundColor: RED,
        tension: 0.3,
        spanGaps: true,
      },
    ],
  } : null;

  if (!kpi) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  // 월 선택 시 monthlyKpi 사용, 미선택 시 전체 KPI
  const activeKpi = (selectedMonth !== null && monthlyKpi) ? monthlyKpi : kpi;
  const rev = activeKpi.revenue;
  const cnt = activeKpi.counterparty_count;
  const kpiLabel = selectedMonth !== null ? `${selectedMonth}월 매출액` : "매출액";

  return (
    <div className="wrap">

      {/* ── 전체 레이아웃: 2열 그리드 2행 ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gridTemplateRows: "auto auto", gap: 14 }}>

        {/* [1,1] KPI 카드 2개 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, gridColumn: "1", gridRow: "1", alignSelf: "stretch" }}>
          <KpiCard
            label={kpiLabel} unit="백만"
            value={fmtB(rev.current)} prior={fmtB(rev.prior)}
            change={Math.round(rev.change / 1_000_000)}
            changePct={rev.change_pct}
            vsPrevMonth={Math.round(rev.vs_prev_month / 1_000_000)}
          />
          <KpiCard
            label="거래처수" unit="개"
            value={cnt.current} prior={cnt.prior}
            change={cnt.change}
            changePct={cnt.change_pct}
            vsPrevMonth={cnt.vs_prev_month}
          />
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
                    return row ? Math.round(row.amount / 1_000_000) : 0;
                  })
                : trendCur;
              const priData = selectedCp && selectedCpTrend
                ? trendLabels.map((_, i) => {
                    const row = selectedCpTrend.pri.find(r => r.month === i + 1);
                    return row ? Math.round(row.amount / 1_000_000) : 0;
                  })
                : trendPri;

              const trendOption = {
                grid: { top: 36, bottom: 24, left: 8, right: 16, containLabel: true },
                tooltip: {
                  trigger: "axis",
                  formatter: (params: {seriesName: string; value: number}[]) =>
                    params.map(p => `${p.seriesName}: ${p.value.toLocaleString("ko-KR")}백만`).join("<br/>"),
                },
                legend: {
                  data: ["당기", "전기"],
                  textStyle: { color: "#888", fontSize: 10 },
                  itemWidth: 10, itemHeight: 10,
                },
                xAxis: {
                  type: "category",
                  data: trendLabels,
                  axisLabel: { color: "#bbb", fontSize: 10 },
                  axisTick: { show: false },
                  axisLine: { lineStyle: { color: "#eee" } },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { color: "#bbb", fontSize: 10 },
                  splitLine: { lineStyle: { color: "#f0f0f0" } },
                },
                series: [
                  {
                    name: "당기",
                    type: "bar",
                    barMaxWidth: 24,
                    data: curData.map((v, i) => ({
                      value: v,
                      itemStyle: { color: selectedMonth === i + 1 ? "#2563EB" : ORANGE, borderRadius: [3, 3, 0, 0] },
                    })),
                    markPoint: {
                      symbolSize: 40,
                      label: { fontSize: 9, color: "#fff" },
                      data: [
                        { type: "max", name: "최대" },
                        { type: "min", name: "최소" },
                      ],
                    },
                    markLine: {
                      silent: true,
                      lineStyle: { color: ORANGE, type: "dashed", width: 1 },
                      label: { formatter: (p: {value: number}) => `평균 ${p.value.toLocaleString("ko-KR")}`, fontSize: 9, color: ORANGE },
                      data: [{ type: "average", name: "평균" }],
                    },
                  },
                  {
                    name: "전기",
                    type: "bar",
                    barMaxWidth: 24,
                    data: priData.map(v => ({
                      value: v,
                      itemStyle: { color: "rgba(180,180,180,0.4)", borderRadius: [3, 3, 0, 0] },
                    })),
                    markPoint: {
                      symbolSize: 40,
                      label: { fontSize: 9, color: "#fff" },
                      data: [
                        { type: "max", name: "최대" },
                        { type: "min", name: "최소" },
                      ],
                    },
                    markLine: {
                      silent: true,
                      lineStyle: { color: "#aaa", type: "dashed", width: 1 },
                      label: { formatter: (p: {value: number}) => `평균 ${p.value.toLocaleString("ko-KR")}`, fontSize: 9, color: "#aaa" },
                      data: [{ type: "average", name: "평균" }],
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
              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 5, border: "1px solid #ddd", color: "#555" }}
            >
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {donut && donutChartData && (() => {
            return (
              <>
                <Doughnut
                  data={{
                    ...donutChartData,
                    datasets: [{
                      ...donutChartData.datasets[0],
                      borderWidth: donutChartData.datasets[0].data.map((_, i) =>
                        donut.items[i]?.counterparty === selectedCp ? 3 : 1
                      ),
                      borderColor: donutChartData.datasets[0].data.map((_, i) =>
                        donut.items[i]?.counterparty === selectedCp ? "#2563EB" : "#fff"
                      ),
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: false,
                    cutout: "50%",
                    layout: { padding: 55 },
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${donut.items[ctx.dataIndex]?.pct.toFixed(1) ?? 0}%` } },
                    },
                    onClick(_evt, elements) {
                      if (!elements || elements.length === 0) return;
                      const cp = donut.items[elements[0].index]?.counterparty;
                      if (!cp || cp === "기타") return;
                      setSelectedCp(prev => prev === cp ? null : cp);
                    },
                  }}
                  style={{ cursor: "pointer" }}
                  plugins={[polylineLabelPlugin]}
                />
                <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#999" }}>매출액</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: ORANGE }}>{fmtB(donut.top_total)}백만</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#999" }}>비중</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: ORANGE }}>{donut.top_pct.toFixed(2)}%</div>
                  </div>
                </div>
              </>
            );
          })()}
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
          <MonthlyRaceBar barRace={barRace} selectedMonth={selectedMonth} topN={topN} />
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
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", color: "#555", maxWidth: 200 }}
            >
              <option value="">거래처1 선택</option>
              {cpList.map(cp => <option key={cp} value={cp}>{cp}</option>)}
            </select>
            <select
              value={cp2}
              onChange={e => setCp2(e.target.value)}
              style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", color: "#555", maxWidth: 200 }}
            >
              <option value="">거래처2 선택</option>
              {cpList.map(cp => <option key={cp} value={cp}>{cp}</option>)}
            </select>
          </div>
        </div>
        {cpChartData && (
          <div style={{ height: 200 }}>
            <Line
              data={cpChartData}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: "#888", font: { size: 11 }, boxWidth: 10 } },
                  tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString("ko-KR")}만` } },
                },
                scales: {
                  x: { ticks: { color: "#bbb", font: { size: 10 } }, grid: { display: false } },
                  y: { ticks: { color: "#bbb", font: { size: 10 } }, grid: { color: "#f0f0f0" } },
                },
              }}
            />
          </div>
        )}
      </div>

      {/* ── 전표 내역 ─────────────────────────────────────────── */}
      {vouchers && (
        <>
          <VoucherTable rows={vouchers.current} title="당기 전표 내역" />
          <VoucherTable rows={vouchers.prior}   title="전기 전표 내역" />
        </>
      )}

    </div>
  );
}
