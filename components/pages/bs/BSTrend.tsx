"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchBSTrend } from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, Tooltip, Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface TrendRow { year_month: string; 자산?: number; 부채?: number; 자본?: number }

const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

export default function BSTrend() {
  const filter = useFilter();
  const [rows, setRows] = useState<TrendRow[] | null>(null);

  useEffect(() => {
    fetchBSTrend(filter).then((d) => setRows(d as TrendRow[])).catch(console.error);
  }, [filter.baseYm]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const labels = rows.map((r) => r.year_month.slice(5) + "월");

  const chartData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "자산",
        data: rows.map((r) => Math.round((r.자산 ?? 0) / 1_000_000)),
        backgroundColor: "rgba(79,195,247,0.6)",
        yAxisID: "y",
      },
      {
        type: "bar" as const,
        label: "부채",
        data: rows.map((r) => Math.round((r.부채 ?? 0) / 1_000_000)),
        backgroundColor: "rgba(239,154,154,0.6)",
        yAxisID: "y",
      },
      {
        type: "line" as const,
        label: "자본",
        data: rows.map((r) => Math.round((r.자본 ?? 0) / 1_000_000)),
        borderColor: "#a5d6a7",
        backgroundColor: "#a5d6a7",
        tension: 0.3,
        yAxisID: "y",
        pointRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#ccc", font: { size: 12 } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmtB((ctx.parsed.y ?? 0) * 1_000_000)} 백만` } },
    },
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "#2a2a3a" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y: { ticks: { color: "#aaa", callback: (v: any) => Number(v).toLocaleString() }, grid: { color: "#2a2a3a" } },
    },
  };

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">BS 추이분석 (월별)</div>
        <Chart type="bar" data={chartData} options={options} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">월별 상세</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>연월</th><th>자산 (백만)</th><th>부채 (백만)</th><th>자본 (백만)</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year_month}>
                  <td>{r.year_month}</td>
                  <td style={{ color: "#4fc3f7" }}>{fmtB(r.자산 ?? 0)}</td>
                  <td style={{ color: "#ef9a9a" }}>{fmtB(r.부채 ?? 0)}</td>
                  <td style={{ color: "#a5d6a7" }}>{fmtB(r.자본 ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
