"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchBSKPI, fetchBSTrendDetail, fetchBSRatios, fetchBSActivity } from "@/lib/api";
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

const fmtB   = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const fmtPct = (p: number) => `${p >= 0 ? "▲" : "▼"}${Math.abs(p * 100).toFixed(1)}%`;
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
function ChartLoading({ height = 110 }: { height?: number }) {
  return (
    <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#bbb" }}>
      <div className="spinner" />
      <span style={{ fontSize: 11 }}>로딩 중...</span>
    </div>
  );
}

// ── 공통 소형 라인 차트 ───────────────────────────────────────
function MiniAreaChart({ labels, datasets, height = 110, yFmt, selectedIdx, onClickPoint, showLegend = true }: {
  labels: string[];
  datasets: { label: string; data: (number | null)[]; color: string; fill?: boolean }[];
  height?: number;
  yFmt?: (v: number) => string;
  selectedIdx?: number | null;
  onClickPoint?: (idx: number | null) => void;
  showLegend?: boolean;
}) {
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
            legend: { display: showLegend, position: "top", align: "end", labels: { color: "#888", font: { size: 10 }, boxWidth: 8, padding: 6 } },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const v = ctx.parsed.y as number;
                  return ` ${ctx.dataset.label}: ${yFmt ? yFmt(v) : v.toLocaleString("ko-KR")}`;
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: "#bbb", font: { size: 9 }, maxTicksLimit: 8 }, grid: { display: false } },
            y: { ticks: { color: "#bbb", font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: "#f5f5f5" } },
          },
        }}
      />
    </div>
  );
}

// ── 비율 추이 차트 (ECharts, max/min markPoint) ───────────────
function RatioChart({ labels, series, height = 160, yFmt, showLegend = true }: {
  labels: string[];
  series: { name: string; data: number[]; color: string }[];
  height?: number;
  yFmt?: (v: number) => string;
  showLegend?: boolean;
}) {
  const option = {
    animation: false,
    grid: { top: showLegend ? 50 : 40, bottom: 48, left: 8, right: 16, containLabel: true },
    legend: { show: showLegend, top: 4, right: 8, textStyle: { fontSize: 10, color: "#888" }, itemWidth: 8, itemHeight: 8 },
    tooltip: {
      trigger: "axis",
      formatter: (params: { seriesName: string; value: number; axisValueLabel: string }[]) => {
        const label = params[0]?.axisValueLabel ?? "";
        return `<span style="font-size:10px;color:#999">${label}</span><br/>` +
          params.map(p => `${p.seriesName}: ${yFmt ? yFmt(p.value) : p.value}`).join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { fontSize: 9, color: "#bbb" },
      axisLine: { lineStyle: { color: "#eee" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 9, color: "#bbb", formatter: yFmt ?? ((v: number) => String(v)) },
      splitLine: { lineStyle: { color: "#f5f5f5" } },
    },
    series: series.map(s => {
      // 겹치는 경우 높은 값만 핀 표시
      const maxIdx = s.data.indexOf(Math.max(...s.data));
      const minIdx = s.data.indexOf(Math.min(...s.data));
      const other = series.find(o => o !== s);

      const shouldShow = (type: "max" | "min", idx: number) => {
        if (!other || series.length < 2) return true;
        const otherIdx = type === "max"
          ? other.data.indexOf(Math.max(...other.data))
          : other.data.indexOf(Math.min(...other.data));
        if (otherIdx !== idx) return true;
        return s.data[idx] >= other.data[idx]; // 높은 값만 핀 표시
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
      blur: {
        lineStyle: { opacity: 1 },
        itemStyle: { opacity: 1 },
      },
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
        blur: {
          itemStyle: { opacity: 1 },
          label: { opacity: 1 },
        },
        data: markData,
      },
    }; }),
  };
  return <ReactECharts option={option} style={{ height, width: "100%" }} notMerge />;
}

// ── BS KPI 카드 ───────────────────────────────────────────────
function BSKpiCard({ cat, data, selectedLabel, current, noncurrent }: {
  cat: string; data: KPICat; selectedLabel?: string | null;
  current?: number; noncurrent?: number;
}) {
  const color = CAT_COLOR[cat] ?? "#E87722";
  const prefix = cat === "자산" ? "자산" : cat === "부채" ? "부채" : null;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#999" }}>{cat}</div>
          {selectedLabel && (
            <span style={{ fontSize: 10, color, background: color + "30", padding: "1px 6px", borderRadius: 6, fontWeight: 600 }}>{selectedLabel}</span>
          )}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
          {fmtB(data.ending)}<span style={{ fontSize: 14, color, fontWeight: 700, marginLeft: 4 }}>백만</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#999" }}>
        {prefix && current !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>유동{prefix}</span>
            <span style={{ color: "#444" }}>{fmtB(current)}백만</span>
          </div>
        )}
        {prefix && noncurrent !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>비유동{prefix}</span>
            <span style={{ color: "#444" }}>{fmtB(noncurrent)}백만</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid #F0F0F0", margin: "2px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>당기기초 금액</span>
          <span style={{ color: "#444" }}>
            {fmtB(data.yr_start)}백만&nbsp;
            <span className={data.yr_chg_pct >= 0 ? "up-t" : "dn-t"} style={{ fontSize: 10 }}>
              {fmtPct(data.yr_chg_pct)}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>당월 기초 금액</span>
          <span style={{ color: "#444" }}>
            {fmtB(data.mo_start)}백만&nbsp;
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
  const filter = useFilter();
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

  // KPI 카드용 스켈레톤
  const KpiSkeleton = () => (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 130, color: "#bbb" }}>
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
            { label: "유동", data: trend.map(r => Math.round(r.유동자산   / 1_000_000)), color: ORANGE, fill: true  },
            { label: "비유동", data: trend.map(r => Math.round(r.비유동자산 / 1_000_000)), color: BLUE,   fill: true  },
          ],
        },
        {
          cat: "부채" as const,
          title: "부채추이",
          datasets: [
            { label: "유동", data: trend.map(r => Math.round(r.유동부채   / 1_000_000)), color: RED,    fill: true  },
            { label: "비유동", data: trend.map(r => Math.round(r.비유동부채 / 1_000_000)), color: GRAY,   fill: true  },
          ],
        },
        {
          cat: "자본" as const,
          title: "자본추이",
          datasets: [
            { label: "자본", data: trend.map(r => Math.round(r.자본 / 1_000_000)), color: GREEN, fill: true },
          ],
        },
      ].map(({ cat, title, datasets }) => {
        const idx = selIdx[cat];
        const selectedLabel = idx !== null ? labels[idx] : null;

        // 선택된 시점의 KPI 계산 (trend 기반)
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

        const currentVal  = trendRow ? (cat === "자산" ? trendRow.유동자산   : cat === "부채" ? trendRow.유동부채   : undefined) : undefined;
        const noncurrentVal = trendRow ? (cat === "자산" ? trendRow.비유동자산 : cat === "부채" ? trendRow.비유동부채 : undefined) : undefined;

        return (
        <div key={cat} style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, alignItems: "stretch" }}>
          {kpiLoading || !kpiForIdx ? <KpiSkeleton /> : <BSKpiCard cat={cat} data={kpiForIdx} selectedLabel={selectedLabel} current={currentVal} noncurrent={noncurrentVal} />}
          <div className="card">
            <div className="card-title">{title}</div>
            {trendLoading
              ? <ChartLoading height={120} />
              : <MiniAreaChart
                  labels={labels} height={120} datasets={datasets}
                  yFmt={v => `${v.toLocaleString("ko-KR")}백만`}
                  selectedIdx={idx}
                  onClickPoint={i => setSelIdx(prev => ({ ...prev, [cat]: i }))}
                  showLegend={datasets.length > 1}
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
              ? <ChartLoading height={160} />
              : <RatioChart labels={rLabels} height={160} series={[
                  { name: "당좌비율", data: ratios.map(r => r.당좌비율), color: ORANGE },
                  { name: "유동비율", data: ratios.map(r => r.유동비율), color: BLUE },
                ]} yFmt={v => `${v.toFixed(1)}%`} />
            }
          </div>
          <div className="card">
            <div className="card-title">부채비율 추이</div>
            {ratioLoading
              ? <ChartLoading height={160} />
              : <RatioChart labels={rLabels} height={160} showLegend={false} series={[
                  { name: "부채비율", data: ratios.map(r => r.부채비율), color: RED },
                ]} yFmt={v => `${v.toFixed(1)}%`} />
            }
          </div>
        </div>
      </div>

      {/* ── 활동성 지표 ───────────────────────────────────────── */}
      <div>
        <div className="sec-hd"><span className="sec-hd-txt">활동성 지표</span><div className="sec-hd-line" /></div>
        {actLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginBottom: 14 }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 130, color: "#bbb" }}>
              <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 11 }}>로딩 중...</span>
            </div>
            <div className="card"><div className="card-title">매출채권 회전일수 추이</div><ChartLoading height={130} /></div>
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
          <div key={item.label} style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, alignItems: "stretch", marginBottom: 14 }}>
            {/* 왼쪽 카드 */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#999" }}>{item.label}</div>
                  {selectedLabel && (
                    <span style={{ fontSize: 10, color: item.color, background: item.color + "30", padding: "1px 6px", borderRadius: 6, fontWeight: 600 }}>{selectedLabel}</span>
                  )}
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: "-0.5px" }}>
                  {days.toFixed(1)}<span style={{ fontSize: 14, color: item.color, fontWeight: 700, marginLeft: 4 }}>일</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#999" }}>
                <div style={{ borderTop: "1px solid #F0F0F0", margin: "2px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.sub1}</span>
                  <span style={{ color: "#444" }}>{val1.toLocaleString("ko-KR")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.sub2}</span>
                  <span style={{ color: "#444" }}>{val2.toLocaleString("ko-KR")}</span>
                </div>
              </div>
            </div>
            {/* 오른쪽 차트 */}
            <div className="card">
              <div className="card-title">{item.chartTitle}</div>
              <MiniAreaChart
                labels={aLabels}
                height={130}
                datasets={[{ label: item.label, data: item.chartData, color: item.color, fill: true }]}
                yFmt={v => `${v.toFixed(1)}일`}
                showLegend={false}
                selectedIdx={idx}
                onClickPoint={i => setSelActIdx(prev => ({ ...prev, [item.label]: i }))}
              />
            </div>
          </div>
          );
        })}
      </div>

    </div>
  );
}
