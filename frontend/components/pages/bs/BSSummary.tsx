"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { useDarkMode } from "@/hooks/useDarkMode";
import { fetchBSKPI, fetchBSTrendDetail, fetchBSRatios, fetchBSActivity } from "@/lib/api";
import { useAmountFormat } from "@/lib/fmtAmount";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  LineController, BarController,
  LineElement, BarElement, PointElement,
  Filler, Tooltip, Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import ReactECharts from "echarts-for-react";

ChartJS.register(
  CategoryScale, LinearScale,
  LineController, BarController,
  LineElement, BarElement, PointElement,
  Filler, Tooltip, Legend,
);

const fmtPct = (p: number) => `${p >= 0 ? "▲" : "▼"}${Math.abs(p * 100).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const ORANGE = "rgba(232,119,34,0.9)";
const BLUE   = "rgba(37,99,235,0.9)";
const RED    = "rgba(220,38,38,0.9)";
const GREEN  = "rgba(22,163,74,0.9)";
const GRAY   = "rgba(150,150,150,0.7)";

const CAT_COLOR: Record<string, string> = {
  자산: "#E87722",
  부채: "#EF4444",
  자본: "#16A34A",
};

interface KPICat { ending: number; yr_start: number; yr_chg_pct: number; mo_start: number; mo_chg_pct: number }
interface KPIData { 자산: KPICat; 부채: KPICat; 자본: KPICat }
interface TrendRow { year_month: string; 유동자산: number; 비유동자산: number; 유동부채: number; 비유동부채: number; 자본: number }
interface RatioRow { year_month: string; 유동비율: number; 당좌비율: number; 부채비율: number }
interface ActivityCurrent { year_month: string; 매출채권회전일수: number; 재고자산회전일수: number; avg_recv: number; avg_inv: number; daily_rev: number; daily_cogs: number }
interface ActivityData { current: ActivityCurrent; trend: ActivityCurrent[] }

// ── 로딩 오버레이 ─────────────────────────────────────────────
function ChartLoading({ height = 110, isDark }: { height?: number; isDark?: boolean }) {
  return (
    <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: isDark ? "#5A6070" : "#bbb" }}>
      <div className="spinner" />
      <span style={{ fontSize: 11 }}>로딩 중...</span>
    </div>
  );
}

// ── 공통 소형 라인 차트 ───────────────────────────────────────
function MiniAreaChart({ labels, datasets, height = 110, yFmt, selectedIdx, onClickPoint, showLegend = true, isDark = false }: {
  labels: string[];
  datasets: { label: string; data: (number | null)[]; color: string; fill?: boolean }[];
  height?: number;
  yFmt?: (v: number) => string;
  selectedIdx?: number | null;
  onClickPoint?: (idx: number | null) => void;
  showLegend?: boolean;
  isDark?: boolean;
}) {
  const tickClr = isDark ? "#9198A8" : "#bbb";
  const gridClr = isDark ? "#2E3039" : "#f5f5f5";
  const lgdClr  = isDark ? "#9198A8" : "#888";
  const tipBg   = isDark ? "#1C1F26" : "#fff";
  const tipBdr  = isDark ? "#2E3039" : "#eee";
  const tipTxt  = isDark ? "#E2E5EC" : "#333";

  return (
    <div style={{ height, cursor: onClickPoint ? "pointer" : "default" }}>
      <Line
        data={{
          labels,
          datasets: datasets.map(d => ({
            label: d.label,
            data: d.data,
            borderColor: d.color,
            backgroundColor: d.fill !== false
              ? d.color.replace(/[\d.]+\)$/, "0.15)")
              : "transparent",
            fill: d.fill !== false,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: (ctx: { dataIndex: number }) =>
              ctx.dataIndex === selectedIdx ? "#2563EB" : d.color,
            pointBorderColor: (ctx: { dataIndex: number }) =>
              ctx.dataIndex === selectedIdx ? "#fff" : d.color,
            pointBorderWidth: (ctx: { dataIndex: number }) =>
              ctx.dataIndex === selectedIdx ? 2 : 0,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: "rgba(150,150,150,0.45)",
            pointHoverBorderColor: "rgba(150,150,150,0.3)",
            pointHoverBorderWidth: 2,
            borderWidth: 1.5,
            spanGaps: true,
          })),
        }}
        plugins={selectedIdx !== null && selectedIdx !== undefined ? [{
          id: "selectedBg",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          beforeDraw(chart: any) {
            const { ctx, chartArea, scales } = chart;
            if (selectedIdx === null || selectedIdx === undefined) return;
            const x = scales.x.getPixelForValue(selectedIdx);
            const tickCount = (scales.x.ticks as unknown[]).length;
            const halfBand = tickCount > 1 ? scales.x.width / (tickCount - 1) / 2 : 20;
            ctx.save();
            ctx.fillStyle = "rgba(37,99,235,0.07)";
            ctx.fillRect(x - halfBand, chartArea.top, halfBand * 2, chartArea.bottom - chartArea.top);
            ctx.restore();
          },
        }] : []}
        options={{
          responsive: true, maintainAspectRatio: false,
          onClick: onClickPoint ? (_e, elements) => {
            if (elements.length === 0) { onClickPoint(null); return; }
            const idx = elements[0].index;
            onClickPoint(selectedIdx === idx ? null : idx);
          } : undefined,
          plugins: {
            legend: { display: showLegend, position: "top", align: "end", labels: { color: lgdClr, font: { size: 10 }, boxWidth: 8, padding: 6 } },
            tooltip: {
              backgroundColor: tipBg,
              borderColor: tipBdr,
              borderWidth: 1,
              titleColor: tipTxt,
              bodyColor: tipTxt,
              callbacks: {
                label: ctx => {
                  const v = ctx.parsed.y as number;
                  return ` ${ctx.dataset.label}: ${yFmt ? yFmt(v) : v.toLocaleString("ko-KR")}`;
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: tickClr, font: { size: 9 }, maxTicksLimit: 8 }, grid: { display: false } },
            y: { ticks: { color: tickClr, font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: gridClr } },
          },
        }}
      />
    </div>
  );
}

// ── 비율 추이 차트 (ECharts, max/min markPoint) ───────────────
function RatioChart({ labels, series, height = 160, yFmt, showLegend = true, isDark = false }: {
  labels: string[];
  series: { name: string; data: number[]; color: string }[];
  height?: number;
  yFmt?: (v: number) => string;
  showLegend?: boolean;
  isDark?: boolean;
}) {
  const gridClr    = isDark ? "#2E3039" : "#f5f5f5";
  const axisLblClr = isDark ? "#9198A8" : "#bbb";
  const axisLnClr  = isDark ? "#2E3039" : "#eee";
  const lgdClr     = isDark ? "#9198A8" : "#888";
  const tipBg      = isDark ? "#1C1F26" : "#fff";
  const tipBdr     = isDark ? "#2E3039" : "#eee";
  const tipTxt     = isDark ? "#E2E5EC" : "#333";

  const option = {
    backgroundColor: "transparent",
    animation: false,
    grid: { top: showLegend ? 50 : 40, bottom: 48, left: 8, right: 16, containLabel: true },
    legend: { show: showLegend, top: 4, right: 8, textStyle: { fontSize: 10, color: lgdClr }, itemWidth: 8, itemHeight: 8 },
    tooltip: {
      trigger: "axis",
      backgroundColor: tipBg,
      borderColor: tipBdr,
      textStyle: { color: tipTxt, fontSize: 11 },
      formatter: (params: { seriesName: string; value: number; axisValueLabel: string }[]) => {
        const label = params[0]?.axisValueLabel ?? "";
        return `<span style="font-size:10px;color:${axisLblClr}">${label}</span><br/>` +
          params.map(p => `${p.seriesName}: ${yFmt ? yFmt(p.value) : p.value}`).join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { fontSize: 9, color: axisLblClr },
      axisLine: { lineStyle: { color: axisLnClr } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 9, color: axisLblClr, formatter: yFmt ?? ((v: number) => String(v)) },
      splitLine: { lineStyle: { color: gridClr } },
    },
    series: series.map(s => {
      const maxIdx = s.data.indexOf(Math.max(...s.data));
      const minIdx = s.data.indexOf(Math.min(...s.data));
      const other = series.find(o => o !== s);

      const shouldShow = (type: "max" | "min", idx: number) => {
        if (!other || series.length < 2) return true;
        const otherIdx = type === "max"
          ? other.data.indexOf(Math.max(...other.data))
          : other.data.indexOf(Math.min(...other.data));
        if (otherIdx !== idx) return true;
        return s.data[idx] >= other.data[idx];
      };

      const markData = [
        shouldShow("max", maxIdx) && { type: "max", name: "최고", itemStyle: { color: s.color } },
        shouldShow("min", minIdx) && { type: "min", name: "최저", itemStyle: { color: s.color + "bb" } },
      ].filter(Boolean);

      return {
        name: s.name,
        type: "line",
        data: s.data,
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: s.color, width: 1.8 },
        itemStyle: { color: s.color },
        emphasis: { focus: "none" },
        blur: { lineStyle: { opacity: 1 }, itemStyle: { opacity: 1 } },
        markPoint: {
          symbol: "pin",
          symbolSize: (val: number) => {
            const len = String(Math.round(val)).length;
            return len <= 3 ? 46 : len <= 5 ? 58 : 70;
          },
          label: { fontSize: 11, color: "#fff", fontWeight: 700 },
          emphasis: {
            symbolSize: (val: number) => {
              const len = String(Math.round(val)).length;
              return (len <= 3 ? 46 : len <= 5 ? 58 : 70) * 1.25;
            },
          },
          blur: { itemStyle: { opacity: 1 }, label: { opacity: 1 } },
          data: markData,
        },
      };
    }),
  };
  return <ReactECharts option={option} style={{ height, width: "100%" }} notMerge />;
}

// ── BS KPI 카드 ───────────────────────────────────────────────
function BSKpiCard({ cat, data, selectedLabel, current, noncurrent, isDark = false }: {
  cat: string; data: KPICat; selectedLabel?: string | null;
  current?: number; noncurrent?: number; isDark?: boolean;
}) {
  const { fmtAmt, unitLabel } = useAmountFormat();
  const color = CAT_COLOR[cat] ?? "#E87722";
  const prefix = cat === "자산" ? "자산" : cat === "부채" ? "부채" : null;
  const labelClr = isDark ? "#9198A8" : "#999";
  const valClr   = isDark ? "#C8CCDA" : "#444";
  const divClr   = isDark ? "#2E3039" : "#F0F0F0";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", boxSizing: "border-box" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: labelClr }}>{cat}</div>
          {selectedLabel && (
            <span style={{ fontSize: 10, color, background: color + "30", padding: "1px 6px", borderRadius: 6, fontWeight: 600 }}>{selectedLabel}</span>
          )}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
          {fmtAmt(data.ending)}<span style={{ fontSize: 14, color, fontWeight: 700, marginLeft: 4 }}>{unitLabel}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: labelClr }}>
        {prefix && current !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>유동{prefix}</span>
            <span style={{ color: valClr }}>{fmtAmt(current)}{unitLabel}</span>
          </div>
        )}
        {prefix && noncurrent !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>비유동{prefix}</span>
            <span style={{ color: valClr }}>{fmtAmt(noncurrent)}{unitLabel}</span>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${divClr}`, margin: "2px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>당기기초 금액</span>
          <span style={{ color: valClr }}>
            {fmtAmt(data.yr_start)}{unitLabel}&nbsp;
            <span className={data.yr_chg_pct >= 0 ? "up-t" : "dn-t"} style={{ fontSize: 10 }}>
              {fmtPct(data.yr_chg_pct)}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>당월 기초 금액</span>
          <span style={{ color: valClr }}>
            {fmtAmt(data.mo_start)}{unitLabel}&nbsp;
            <span className={data.mo_chg_pct >= 0 ? "up-t" : "dn-t"} style={{ fontSize: 10 }}>
              {fmtPct(data.mo_chg_pct)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export default function BSSummary() {
  const isDark = useDarkMode();
  const filter = useFilter();
  const { fmtAmt, unitLabel } = useAmountFormat();
  const { triggerComment, target: cmtTarget, panelOpen } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const lift = (label: string): React.CSSProperties => {
    const viewingInquiry = panelOpen && !!cmtTarget?.inquiryId && cmtTarget.page === "BS 요약" && cmtTarget.label === label;
    const selected = !!cmtTarget && !cmtTarget.inquiryId && cmtTarget.page === "BS 요약" && cmtTarget.label === label;
    if (viewingInquiry) {
      return { boxShadow: "0 8px 24px rgba(232,119,34,0.14), 0 0 0 2px rgba(232,119,34,0.28), 0 0 0 10px rgba(232,119,34,0.04)", borderRadius: 10, transform: "translateY(-4px)", zIndex: 10, transition: "all 0.25s" };
    }
    if (selected) {
      return { boxShadow: "0 4px 14px rgba(232,119,34,0.1), 0 0 0 1.5px rgba(232,119,34,0.22), 0 0 0 8px rgba(232,119,34,0.05)", borderRadius: 10, zIndex: 10, transition: "all 0.25s" };
    }
    return { transition: "all 0.25s" };
  };
  const [kpi,          setKpi]          = useState<KPIData | null>(null);
  const [trend,        setTrend]        = useState<TrendRow[]>([]);
  const [ratios,       setRatios]       = useState<RatioRow[]>([]);
  const [activity,     setActivity]     = useState<ActivityData | null>(null);
  const [kpiLoading,   setKpiLoading]   = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [ratioLoading, setRatioLoading] = useState(true);
  const [actLoading,   setActLoading]   = useState(true);
  const [selIdx, setSelIdx] = useState<Record<string, number | null>>({ 자산: null, 부채: null, 자본: null });
  const [selActIdx, setSelActIdx] = useState<Record<string, number | null>>({ 매출채권회전일수: null, 재고자산회전일수: null });

  useEffect(() => {
    setKpiLoading(true); setTrendLoading(true); setRatioLoading(true); setActLoading(true);
    fetchBSKPI(filter).then(d => { setKpi(d as KPIData); setKpiLoading(false); }).catch(console.error);
    fetchBSTrendDetail(filter).then(d => { setTrend(d as TrendRow[]); setTrendLoading(false); }).catch(console.error);
    fetchBSRatios(filter).then(d => { setRatios(d as RatioRow[]); setRatioLoading(false); }).catch(console.error);
    fetchBSActivity(filter).then(d => { setActivity(d as ActivityData); setActLoading(false); }).catch(console.error);
  }, [filter.baseYm]);

  const labels = trend.map(r => {
    const [y, m] = r.year_month.split("-");
    return `${y.slice(2)}/${parseInt(m)}월`;
  });
  const rLabels = ratios.map(r => {
    const [y, m] = r.year_month.split("-");
    return `${y.slice(2)}/${parseInt(m)}월`;
  });
  const aLabels = (activity?.trend ?? []).map(r => {
    const [y, m] = r.year_month.split("-");
    return `${y.slice(2)}/${parseInt(m)}월`;
  });

  const labelClr = isDark ? "#9198A8" : "#999";
  const valClr   = isDark ? "#C8CCDA" : "#444";
  const divClr   = isDark ? "#2E3039" : "#F0F0F0";

  const KpiSkeleton = () => (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 130, color: isDark ? "#5A6070" : "#bbb" }}>
      <div className="spinner" />
      <span style={{ fontSize: 11 }}>로딩 중...</span>
    </div>
  );

  const cur = activity?.current;

  return (
    <div className="wrap">

      {/* ── KPI + 추이 차트 — 자산/부채/자본 각 행 ──────────────── */}
      {[
        {
          cat: "자산" as const,
          title: "자산추이",
          datasets: [
            { label: "유동",   data: trend.map(r => r.유동자산),   color: ORANGE, fill: true },
            { label: "비유동", data: trend.map(r => r.비유동자산), color: BLUE,   fill: true },
          ],
        },
        {
          cat: "부채" as const,
          title: "부채추이",
          datasets: [
            { label: "유동",   data: trend.map(r => r.유동부채),   color: RED,  fill: true },
            { label: "비유동", data: trend.map(r => r.비유동부채), color: GRAY, fill: true },
          ],
        },
        {
          cat: "자본" as const,
          title: "자본추이",
          datasets: [
            { label: "자본", data: trend.map(r => r.자본), color: GREEN, fill: true },
          ],
        },
      ].map(({ cat, title, datasets }) => {
        const idx = selIdx[cat];
        const selectedLabel = idx !== null ? labels[idx] : null;

        const trendRow = (idx !== null && trend[idx]) ? trend[idx] : (trend.length ? trend[trend.length - 1] : null);
        const kpiForIdx = (idx !== null && trend[idx]) ? (() => {
          const r = trend[idx];
          const endingMap: Record<string, number> = {
            자산: r.유동자산 + r.비유동자산,
            부채: r.유동부채 + r.비유동부채,
            자본: r.자본,
          };
          const ending = endingMap[cat];
          const prevR = trend[idx - 1];
          const prevEnding = prevR ? (cat === "자산" ? prevR.유동자산 + prevR.비유동자산 : cat === "부채" ? prevR.유동부채 + prevR.비유동부채 : prevR.자본) : ending;
          const mo_chg_pct = prevEnding ? (ending - prevEnding) / Math.abs(prevEnding) : 0;
          return { ...kpi![cat], ending, mo_start: prevEnding, mo_chg_pct };
        })() : (kpi ? kpi[cat] : null);

        const currentVal    = trendRow ? (cat === "자산" ? trendRow.유동자산   : cat === "부채" ? trendRow.유동부채   : undefined) : undefined;
        const noncurrentVal = trendRow ? (cat === "자산" ? trendRow.비유동자산 : cat === "부채" ? trendRow.비유동부채 : undefined) : undefined;

        return (
          <div key={cat} style={{ display: "grid", gridTemplateColumns: "min(420px, 40%) 1fr", gap: 14, alignItems: "stretch", minWidth: 0 }}>
            {kpiLoading || !kpiForIdx ? <KpiSkeleton /> : (
              <div style={{ cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", ...lift(cat) }}
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "BS 요약", label: cat, value: `${fmtAmt(kpiForIdx.ending)}${unitLabel}`, sub: selectedLabel ? `선택 월: ${selectedLabel}` : undefined }, { top: r.top, right: r.right }, e.currentTarget); }}>
                {ck.has(commentKey("BS 요약", cat)) && <CommentDot inquiryId={ck.get(commentKey("BS 요약", cat))!} />}
                <BSKpiCard cat={cat} data={kpiForIdx} selectedLabel={selectedLabel} current={currentVal} noncurrent={noncurrentVal} isDark={isDark} />
              </div>
            )}
            <div className="card" style={{ minWidth: 0 }}>
              <div className="card-title">{title}</div>
              {trendLoading
                ? <ChartLoading height={120} isDark={isDark} />
                : <MiniAreaChart
                    labels={labels} height={120} datasets={datasets}
                    yFmt={v => `${fmtAmt(v)}${unitLabel}`}
                    selectedIdx={idx}
                    onClickPoint={i => setSelIdx(prev => ({ ...prev, [cat]: i }))}
                    showLegend={datasets.length > 1}
                    isDark={isDark}
                  />
              }
            </div>
          </div>
        );
      })}

      {/* ── 재무 지표 ─────────────────────────────────────────── */}
      <div>
        <div className="sec-hd"><span className="sec-hd-txt">재무 지표</span><div className="sec-hd-line" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card">
            <div className="card-title">당좌비율, 유동비율 추이</div>
            {ratioLoading
              ? <ChartLoading height={160} isDark={isDark} />
              : <RatioChart labels={rLabels} height={160} isDark={isDark} series={[
                  { name: "당좌비율", data: ratios.map(r => r.당좌비율), color: ORANGE },
                  { name: "유동비율", data: ratios.map(r => r.유동비율), color: BLUE },
                ]} yFmt={v => `${v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} />
            }
          </div>
          <div className="card">
            <div className="card-title">부채비율 추이</div>
            {ratioLoading
              ? <ChartLoading height={160} isDark={isDark} />
              : <RatioChart labels={rLabels} height={160} showLegend={false} isDark={isDark} series={[
                  { name: "부채비율", data: ratios.map(r => r.부채비율), color: RED },
                ]} yFmt={v => `${v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} />
            }
          </div>
        </div>
      </div>

      {/* ── 활동성 지표 ───────────────────────────────────────── */}
      <div>
        <div className="sec-hd"><span className="sec-hd-txt">활동성 지표</span><div className="sec-hd-line" /></div>
        {actLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "min(420px, 40%) 1fr", gap: 14, marginBottom: 14 }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 130, color: isDark ? "#5A6070" : "#bbb" }}>
              <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 11 }}>로딩 중...</span>
            </div>
            <div className="card"><div className="card-title">매출채권 회전일수 추이</div><ChartLoading height={130} isDark={isDark} /></div>
          </div>
        ) : cur && [
          {
            label: "매출채권회전일수", days: cur.매출채권회전일수, color: ORANGE,
            sub1: "평균매출채권잔액", val1: cur.avg_recv,
            sub2: "일평균매출액",     val2: cur.daily_rev,
            chartTitle: "매출채권 회전일수 추이",
            chartData: activity!.trend.map(r => r.매출채권회전일수),
          },
          {
            label: "재고자산회전일수", days: cur.재고자산회전일수, color: RED,
            sub1: "평균재고자산잔액", val1: cur.avg_inv,
            sub2: "일평균매출원가",   val2: cur.daily_cogs,
            chartTitle: "재고자산 회전일수 추이",
            chartData: activity!.trend.map(r => r.재고자산회전일수),
          },
        ]?.map(item => {
          const idx = selActIdx[item.label];
          const trendRow = (idx !== null && activity!.trend[idx]) ? activity!.trend[idx] : cur!;
          const selectedLabel = idx !== null ? aLabels[idx] : null;
          const days = item.label === "매출채권회전일수" ? trendRow.매출채권회전일수 : trendRow.재고자산회전일수;
          const val1 = item.label === "매출채권회전일수" ? trendRow.avg_recv : trendRow.avg_inv;
          const val2 = item.label === "매출채권회전일수" ? trendRow.daily_rev : trendRow.daily_cogs;

          return (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "min(420px, 40%) 1fr", gap: 14, alignItems: "stretch", minWidth: 0, marginBottom: 14 }}>
              {/* 왼쪽 카드 */}
              <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", position: "relative", ...lift(item.label) }}
                onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "BS 요약", label: item.label, value: `${days.toFixed(1)}일`, sub: selectedLabel ? `선택 월: ${selectedLabel}` : undefined }, { top: r.top, right: r.right }, e.currentTarget); }}>
                {ck.has(commentKey("BS 요약", item.label)) && <CommentDot inquiryId={ck.get(commentKey("BS 요약", item.label))!} />}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: labelClr }}>{item.label}</div>
                    {selectedLabel && (
                      <span style={{ fontSize: 10, color: item.color, background: item.color + "30", padding: "1px 6px", borderRadius: 6, fontWeight: 600 }}>{selectedLabel}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: "-0.5px" }}>
                    {days.toFixed(1)}<span style={{ fontSize: 14, color: item.color, fontWeight: 700, marginLeft: 4 }}>일</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: labelClr }}>
                  <div style={{ borderTop: `1px solid ${divClr}`, margin: "2px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{item.sub1}</span>
                    <span style={{ color: valClr }}>{val1.toLocaleString("ko-KR")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{item.sub2}</span>
                    <span style={{ color: valClr }}>{val2.toLocaleString("ko-KR")}</span>
                  </div>
                </div>
              </div>
              {/* 오른쪽 차트 */}
              <div className="card" style={{ minWidth: 0 }}>
                <div className="card-title">{item.chartTitle}</div>
                <MiniAreaChart
                  labels={aLabels}
                  height={130}
                  datasets={[{ label: item.label, data: item.chartData, color: item.color, fill: true }]}
                  yFmt={v => `${v.toFixed(1)}일`}
                  showLegend={false}
                  selectedIdx={idx}
                  onClickPoint={i => setSelActIdx(prev => ({ ...prev, [item.label]: i }))}
                  isDark={isDark}
                />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
