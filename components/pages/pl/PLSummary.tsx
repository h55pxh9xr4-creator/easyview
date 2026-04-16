"use client";

import Loading from "@/components/ui/Loading";
import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { fetchPLSummary, fetchPLTrend, fetchPLWaterfall } from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  Tooltip, Legend,
} from "chart.js";
import { Chart, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale,
  BarController, LineController, DoughnutController,
  BarElement, LineElement, PointElement, ArcElement,
  Tooltip, Legend,
);

const fmtB   = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const fmtPct = (p: number) => `${(p * 100).toFixed(1)}%`;

interface WaterfallRow {
  year_month: string;
  revenue: number; cogs: number; sga: number;
  gross_profit: number; other_net: number;
  operating_income: number; net_income: number;
}

interface PLData {
  current: Record<string, number>;
  prior:   Record<string, number>;
  prev_month_rev_diff: number;
  change:  Record<string, number>;
}
interface TrendRow {
  year_month: string;
  revenue: number; gross_profit: number; operating_income: number; net_income: number;
  is_current_year: boolean;
}

// ── 미니 도넛 게이지 ──────────────────────────────────────────
function MarginGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(Math.max(value * 100, 0), 100);
  const data = {
    datasets: [{ data: [pct, 100 - pct], backgroundColor: [color, "#F0F0F0"], borderWidth: 0 }],
  };
  return (
    <div style={{ textAlign: "center", margin: "8px 0" }}>
      <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto" }}>
        <Doughnut data={data} options={{ cutout: "72%", plugins: { legend: { display: false }, tooltip: { enabled: false } }, responsive: true }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color }}>
          {fmtPct(value)}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── 미니 바 차트 ─────────────────────────────────────────────
function MiniBarChart({ curData, priData, labels, color, selectedIdx, onBarClick }: {
  curData: number[]; priData: number[]; labels: string[]; color: string;
  selectedIdx: number | null;
  onBarClick: (idx: number | null) => void;
}) {
  const chartData = {
    labels,
    datasets: [
      {
        type: "bar" as const, label: "당기",
        data: curData.map(v => Math.round(v / 1_000_000)),
        backgroundColor: curData.map((_, i) => i === selectedIdx ? "#2563EB" : color),
        barPercentage: 0.65, categoryPercentage: 0.75,
      },
      {
        type: "bar" as const, label: "전기",
        data: priData.map(v => Math.round(v / 1_000_000)),
        backgroundColor: "rgba(180,180,180,0.4)", barPercentage: 0.65, categoryPercentage: 0.75,
      },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: "#888", font: { size: 10 }, boxWidth: 8, padding: 6 } },
      tooltip: {
        callbacks: {
          label: (ctx: {dataset: {label: string}; parsed: {y: number}}) =>
            `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("ko-KR")}백만`,
        },
      },
    },
    scales: {
      x: { ticks: { color: "#bbb", font: { size: 9 } }, grid: { display: false } },
      y: { display: false },
    },
    onClick(_evt: unknown, elements: {index: number}[]) {
      if (!elements.length) { onBarClick(null); return; }
      const idx = elements[0].index;
      onBarClick(selectedIdx === idx ? null : idx);
    },
  };
  return <div style={{ height: 155, cursor: "pointer" }}><Chart type="bar" data={chartData} options={opts as never} /></div>;
}

// ── 이익률 꺾은선 차트 ────────────────────────────────────────
function MarginLineChart({ curMargins, priMargins, labels, color, title }: {
  curMargins: number[]; priMargins: number[]; labels: string[]; color: string; title: string;
}) {
  const data = {
    labels,
    datasets: [
      { type: "line" as const, label: "당기", data: curMargins.map(v => parseFloat((v * 100).toFixed(1))), borderColor: color, backgroundColor: color, tension: 0.3, pointRadius: 3, pointHoverRadius: 5 },
      { type: "line" as const, label: "전기", data: priMargins.map(v => parseFloat((v * 100).toFixed(1))), borderColor: "rgba(180,180,180,0.9)", backgroundColor: "rgba(180,180,180,0.9)", tension: 0.3, pointRadius: 2, borderDash: [3, 3] },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#888", font: { size: 11 }, boxWidth: 8 } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
    },
    scales: {
      x: { ticks: { color: "#aaa", font: { size: 10 } }, grid: { color: "#EEEEEE" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y: { ticks: { color: "#aaa", font: { size: 10 }, callback: (v: any) => `${v}%` }, grid: { color: "#EEEEEE" } },
    },
  };
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div style={{ height: 160 }}><Chart type="line" data={data} options={opts} /></div>
    </div>
  );
}

// ── 통계 행 ──────────────────────────────────────────────────
function StatRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F8F8F8", fontSize: 12 }}>
      <span style={{ color: "#bbb", fontWeight: 500 }}>{label}</span>
      <span className={cls} style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export default function PLSummary() {
  const filter = useFilter();
  const { triggerComment } = useComment();
  const [data,        setData]        = useState<PLData | null>(null);
  const [trend,       setTrend]       = useState<TrendRow[] | null>(null);
  const [waterfall,   setWaterfall]   = useState<WaterfallRow[] | null>(null);
  const [wfSelected,  setWfSelected]  = useState<string[]>([]);
  const [selIdx, setSelIdx] = useState<Record<string, number | null>>({
    revenue: null, gross_profit: null, operating_income: null, net_income: null,
  });

  useEffect(() => {
    Promise.all([
      fetchPLSummary(filter).then(d => setData(d as PLData)),
      fetchPLTrend({ ...filter, periodType: "monthly" }).then(d => setTrend(d as TrendRow[])),
      fetchPLWaterfall(filter).then(d => {
        const rows = d as WaterfallRow[];
        setWaterfall(rows);
        setWfSelected(rows.slice(-3).map(r => r.year_month));
      }),
    ]).catch(console.error);
  }, [filter.baseYm, filter.periodType, filter.compareTarget]);

  if (!data || !trend || !waterfall) {
    return <Loading />;
  }

  const curTrend = trend.filter(r => r.is_current_year);
  const priTrend = trend.filter(r => !r.is_current_year);
  const labels   = curTrend.map(r => r.year_month.slice(5) + "월");
  const rev      = data.current.revenue || 1;

  // 마진 추이
  const safe = (a: number, b: number) => b > 0 ? a / b : 0;
  const curGrossM = curTrend.map(r => safe(r.gross_profit, r.revenue));
  const curOpM    = curTrend.map(r => safe(r.operating_income, r.revenue));
  const curNetM   = curTrend.map(r => safe(r.net_income, r.revenue));
  const priGrossM = priTrend.map(r => safe(r.gross_profit, r.revenue));
  const priOpM    = priTrend.map(r => safe(r.operating_income, r.revenue));
  const priNetM   = priTrend.map(r => safe(r.net_income, r.revenue));

  // ── Waterfall 데이터 빌드 ──────────────────────────────────
  const wfLabels: string[] = [];
  type FloatBar = [number, number] | null;
  const wfTot:        FloatBar[] = [];
  const wfPos:        FloatBar[] = [];
  const wfNeg:        FloatBar[] = [];
  const wfOth:        FloatBar[] = [];
  const wfConnectVals: number[]  = []; // 각 바의 "도착점" 값 (연결선 기준)

  const wfFiltered = wfSelected.length > 0
    ? waterfall.filter(r => wfSelected.includes(r.year_month))
    : waterfall;

  for (const m of wfFiltered) {
    const M   = 1_000_000;
    const wRev = Math.round(m.revenue           / M);
    const wGr  = Math.round(m.gross_profit      / M);
    const wOp  = Math.round(m.operating_income  / M);
    const wOth = Math.round(m.other_net         / M);
    const wNet = Math.round(m.net_income        / M);
    const ymLabel = m.year_month.slice(0,4) + "년 " + m.year_month.slice(5) + "월";

    // 1) 월 합계 → 도착점: operating_income
    wfLabels.push(ymLabel);
    wfTot.push([0, wOp]); wfPos.push(null); wfNeg.push(null); wfOth.push(null);
    wfConnectVals.push(wOp);

    // 2) 매출액 → 도착점: revenue
    wfLabels.push("매출액");
    wfTot.push(null); wfPos.push([0, wRev]); wfNeg.push(null); wfOth.push(null);
    wfConnectVals.push(wRev);

    // 3) 매출원가 → 도착점: gross_profit (하단)
    wfLabels.push("매출원가");
    wfTot.push(null); wfPos.push(null); wfNeg.push([wGr, wRev]); wfOth.push(null);
    wfConnectVals.push(wGr);

    // 4) 판관비 → 도착점: operating_income (하단)
    wfLabels.push("판관비");
    wfTot.push(null); wfPos.push(null); wfNeg.push([wOp, wGr]); wfOth.push(null);
    wfConnectVals.push(wOp);

    // 5) 기타 → 도착점: net_income
    if (wOth !== 0) {
      wfLabels.push("기타");
      wfTot.push(null); wfPos.push(null); wfNeg.push(null);
      wfOth.push(wOth >= 0 ? [wOp, wNet] : [wNet, wOp]);
      wfConnectVals.push(wNet);
    }
  }

  const wfData = {
    labels: wfLabels,
    datasets: [
      {
        type: "bar" as const,
        label: "합계",
        data: wfTot,
        backgroundColor: "#F5C842",
        borderColor: "#F5C842",
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 0.8,
      },
      {
        type: "bar" as const,
        label: "증가",
        data: wfPos,
        backgroundColor: "#E87722",
        borderColor: "#E87722",
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 0.8,
      },
      {
        type: "bar" as const,
        label: "감소",
        data: wfNeg,
        backgroundColor: "#2563EB",
        borderColor: "#2563EB",
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 0.8,
      },
      {
        type: "bar" as const,
        label: "기타",
        data: wfOth,
        backgroundColor: "#9E9E9E",
        borderColor: "#9E9E9E",
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 0.8,
      },
    ],
  };

  const wfOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#555", font: { size: 11 }, boxWidth: 10, padding: 12 } },
      tooltip: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callbacks: { label: (ctx: any) => {
          const v = ctx.raw;
          if (!v) return "";
          const val = Math.abs(v[1] - v[0]).toLocaleString("ko-KR");
          return `${ctx.dataset.label}: ${val}백만`;
        }},
      },
    },
    grouped: false,
    scales: {
      x: { ticks: { color: "#999", font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: {
          color: "#aaa", font: { size: 10 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => `${Number(v).toLocaleString()}백만`,
        },
        grid: { color: "#EEEEEE" },
      },
    },
  };

  // 막대 사이 연결선 플러그인 — wfConnectVals 기반
  const wfConnectorPlugin = {
    id: "wfConnector",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    afterDatasetsDraw(chart: any) {
      const { ctx, scales: { y } } = chart;

      // 각 라벨 인덱스별 바 위치(x, width) 수집
      const barPos: Record<number, { x: number; w: number }> = {};
      for (let di = 0; di < chart.data.datasets.length; di++) {
        const meta = chart.getDatasetMeta(di);
        const ds   = chart.data.datasets[di];
        for (let i = 0; i < ds.data.length; i++) {
          if (ds.data[i] !== null && !barPos[i]) {
            const bar  = meta.data[i];
            barPos[i]  = { x: bar.x, w: bar.width };
          }
        }
      }

      const idxs = Object.keys(barPos).map(Number).sort((a, b) => a - b);
      ctx.save();
      ctx.strokeStyle = "#BBBBBB";
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);

      for (let k = 0; k < idxs.length - 1; k++) {
        const i    = idxs[k];
        const next = idxs[k + 1];
        const connectVal = wfConnectVals[i]; // 현재 바의 도착점
        if (connectVal === undefined) continue;

        const curBar  = barPos[i];
        const nextBar = barPos[next];
        const lineY   = y.getPixelForValue(connectVal);
        const x1      = curBar.x  + curBar.w  / 2;
        const x2      = nextBar.x - nextBar.w / 2;

        ctx.beginPath();
        ctx.moveTo(x1, lineY);
        ctx.lineTo(x2, lineY);
        ctx.stroke();
      }
      ctx.restore();
    },
  };

  const CARDS = [
    { key: "revenue",          title: "매출액",    color: "#E87722", trendKey: "revenue"          as keyof TrendRow, marginLabel: "" },
    { key: "gross_profit",     title: "매출총이익", color: "#D5476E", trendKey: "gross_profit"     as keyof TrendRow, marginLabel: "매출총이익률" },
    { key: "operating_income", title: "영업이익",  color: "#E87722", trendKey: "operating_income" as keyof TrendRow, marginLabel: "영업이익률" },
    { key: "net_income",       title: "당기순이익", color: "#6D4C41", trendKey: "net_income"       as keyof TrendRow, marginLabel: "당기손익률" },
  ];

  return (
    <div className="wrap">

      {/* ── 2×2 복합 KPI 카드 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {CARDS.map((card) => {
          const curD = curTrend.map(r => Number(r[card.trendKey]) || 0);
          const priD = priTrend.map(r => Number(r[card.trendKey]) || 0);
          const idx  = selIdx[card.key];
          const cur  = idx !== null ? (curD[idx] ?? 0) : (data.current[card.key] ?? 0);
          const pri  = idx !== null ? (priD[idx] ?? 0) : (data.prior[card.key] ?? 0);
          const diff = cur - pri;
          const chg  = pri !== 0 ? (diff / Math.abs(pri)) : 0;
          const isRev = card.key === "revenue";
          const selLabel = idx !== null ? labels[idx] : null;
          // 이익률 게이지: 해당 월의 revenue 대비 비율
          const curRev = idx !== null ? (curTrend[idx]?.revenue || 1) : (data.current.revenue || 1);
          const margin = isRev ? null : cur / curRev;

          return (
            <div key={card.key} className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "PL 요약", label: `${card.title} 추이`, value: `${fmtB(cur)}백만`, sub: selLabel ? `선택 월: ${selLabel}` : undefined }, { top: r.top, right: r.right }); }}>
              <div style={{ display: "grid", gridTemplateColumns: "190px 1fr" }}>

                {/* 왼쪽: 통계 */}
                <div style={{ padding: "14px 14px 14px 16px", borderRight: "1px solid #F5F5F5", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    {card.title}
                    {selLabel && (
                      <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 400, background: "rgba(37,99,235,0.08)", padding: "1px 6px", borderRadius: 8 }}>
                        {selLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: card.color, letterSpacing: "-1px", lineHeight: 1 }}>
                    {fmtB(cur)}
                    <span style={{ fontSize: 12, fontWeight: 400, color: "#bbb", marginLeft: 3 }}>백만</span>
                  </div>
                  {margin !== null && margin !== undefined && (
                    <MarginGauge value={margin} label={card.marginLabel} color={card.color} />
                  )}
                  <div style={{ marginTop: margin !== null ? 0 : 12, flex: 1 }}>
                    <StatRow label="전기" value={`${fmtB(pri)}백만`} />
                    <StatRow label="증감" value={`${fmtB(diff)}백만`} cls={diff >= 0 ? "up-t" : "dn-t"} />
                    <StatRow
                      label="△%"
                      value={chg >= 0 ? `▲${Math.abs(chg * 100).toFixed(1)}%` : `▼${Math.abs(chg * 100).toFixed(1)}%`}
                      cls={chg >= 0 ? "up-t" : "dn-t"}
                    />
                    {isRev && (
                      <StatRow
                        label="전월대비증감"
                        value={`${fmtB(data.prev_month_rev_diff)}백만`}
                        cls={data.prev_month_rev_diff >= 0 ? "up-t" : "dn-t"}
                      />
                    )}
                  </div>
                </div>

                {/* 오른쪽: 미니 차트 */}
                <div style={{ padding: "12px 12px 10px" }}>
                  <div style={{ fontSize: 11, color: "#999", marginBottom: 2, fontWeight: 600 }}>{card.title} 추이</div>
                  <MiniBarChart
                    curData={curD} priData={priD} labels={labels} color={card.color}
                    selectedIdx={idx}
                    onBarClick={(i) => setSelIdx(prev => ({ ...prev, [card.key]: i }))}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 이익률 추이 ── */}
      <div>
        <div className="sec-hd">
          <span className="sec-hd-txt">이익률 추이</span>
          <div className="sec-hd-line" />
        </div>
        <div className="g3">
          <MarginLineChart curMargins={curGrossM} priMargins={priGrossM} labels={labels} color="#D5476E" title="매출총이익률 추이" />
          <MarginLineChart curMargins={curOpM}    priMargins={priOpM}    labels={labels} color="#E87722" title="영업이익률 추이" />
          <MarginLineChart curMargins={curNetM}   priMargins={priNetM}   labels={labels} color="#6D4C41" title="당기손익률 추이" />
        </div>
      </div>

      {/* ── 손익 Waterfall ── */}
      <div>
        <div className="sec-hd">
          <span className="sec-hd-txt">손익 Waterfall</span>
          <div className="sec-hd-line" />
        </div>
        <div className="card">
          {/* 연월 다중선택 필터 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {waterfall.map(r => {
              const sel = wfSelected.includes(r.year_month);
              const lbl = r.year_month.slice(0,4) + "년 " + r.year_month.slice(5) + "월";
              return (
                <button
                  key={r.year_month}
                  onClick={() => setWfSelected(prev =>
                    prev.includes(r.year_month)
                      ? prev.filter(m => m !== r.year_month)
                      : [...prev, r.year_month]
                  )}
                  style={{
                    padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${sel ? "#E87722" : "#E0E0E0"}`,
                    borderRadius: 20,
                    background: sel ? "#E87722" : "#fff",
                    color: sel ? "#fff" : "#888",
                    transition: "all .15s",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <div style={{ height: 360 }}>
            <Chart type="bar" data={wfData} options={wfOptions} plugins={[wfConnectorPlugin]} />
          </div>
        </div>
      </div>

    </div>
  );
}
