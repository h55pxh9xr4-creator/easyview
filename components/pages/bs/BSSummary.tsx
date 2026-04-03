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
  부채: "#DC2626",
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
      <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 11 }}>데이터 로딩 중...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── 공통 소형 라인 차트 ───────────────────────────────────────
function MiniAreaChart({ labels, datasets, height = 110, yFmt }: {
  labels: string[];
  datasets: { label: string; data: (number | null)[]; color: string; fill?: boolean }[];
  height?: number;
  yFmt?: (v: number) => string;
}) {
  return (
    <div style={{ height }}>
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
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: true,
          })),
        }}
        options={{
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { color: "#888", font: { size: 10 }, boxWidth: 8, padding: 6 } },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const v = ctx.parsed.y;
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

// ── BS KPI 카드 ───────────────────────────────────────────────
function BSKpiCard({ cat, data }: { cat: string; data: KPICat }) {
  const color = CAT_COLOR[cat] ?? "#E87722";
  const up = data.yr_chg_pct >= 0;
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 6 }}>{cat}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
        {fmtB(data.ending)}<span style={{ fontSize: 11, color: "#bbb", fontWeight: 400, marginLeft: 3 }}>백만</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#999" }}>
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
      <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 11 }}>데이터 로딩 중...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      ].map(({ cat, title, datasets }) => (
        <div key={cat} style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "stretch" }}>
          {kpiLoading ? <KpiSkeleton /> : <BSKpiCard cat={cat} data={kpi![cat]} />}
          <div className="card">
            <div className="card-title">{title}</div>
            {trendLoading
              ? <ChartLoading height={120} />
              : <MiniAreaChart labels={labels} height={120} datasets={datasets} yFmt={v => `${v.toLocaleString("ko-KR")}백만`} />
            }
          </div>
        </div>
      ))}

      {/* ── 재무 지표 ─────────────────────────────────────────── */}
      <div>
        <div className="sec-hd"><span className="sec-hd-txt">재무 지표</span><div className="sec-hd-line" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card">
            <div className="card-title">당좌비율, 유동비율 추이</div>
            {ratioLoading
              ? <ChartLoading height={160} />
              : <MiniAreaChart labels={rLabels} height={160} datasets={[
                  { label: "당좌비율", data: ratios.map(r => r.당좌비율), color: ORANGE, fill: false },
                  { label: "유동비율", data: ratios.map(r => r.유동비율), color: BLUE, fill: false },
                ]} yFmt={v => `${v.toFixed(1)}%`} />
            }
          </div>
          <div className="card">
            <div className="card-title">부채비율 추이</div>
            {ratioLoading
              ? <ChartLoading height={160} />
              : <MiniAreaChart labels={rLabels} height={160} datasets={[
                  { label: "부채비율", data: ratios.map(r => r.부채비율), color: RED, fill: false },
                ]} yFmt={v => `${v.toFixed(1)}%`} />
            }
          </div>
        </div>
      </div>

      {/* ── 활동성 지표 ───────────────────────────────────────── */}
      <div>
        <div className="sec-hd"><span className="sec-hd-txt">활동성 지표</span><div className="sec-hd-line" /></div>
        {actLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, marginBottom: 14 }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 130, color: "#bbb" }}>
              <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 11 }}>데이터 로딩 중...</span>
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
        ]?.map(item => (
          <div key={item.label} style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, alignItems: "stretch", marginBottom: 14 }}>
            {/* 왼쪽 카드 */}
            <div className="card" style={{ borderTop: `3px solid ${item.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: "-0.5px" }}>
                {item.days.toFixed(1)}<span style={{ fontSize: 12, color: "#bbb", fontWeight: 400, marginLeft: 3 }}>일</span>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#999" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.sub1}</span>
                  <span style={{ color: "#444" }}>{item.val1.toLocaleString("ko-KR")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.sub2}</span>
                  <span style={{ color: "#444" }}>{item.val2.toLocaleString("ko-KR")}</span>
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
              />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
