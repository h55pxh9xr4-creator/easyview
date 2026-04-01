"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLTrend } from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, Tooltip, Legend,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface TrendRow {
  year_month: string;
  revenue: number;
  gross_profit: number;
  operating_income: number;
  is_current_year: boolean;
}

const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

export default function PLTrend() {
  const filter = useFilter();
  const [rows, setRows] = useState<TrendRow[] | null>(null);

  useEffect(() => {
    fetchPLTrend(filter).then((d) => setRows(d as TrendRow[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const cur = rows.filter((r) => r.is_current_year);
  const pri = rows.filter((r) => !r.is_current_year);
  const labels = cur.map((r) => r.year_month.slice(5) + "월");

  const chartData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "당기 매출액",
        data: cur.map((r) => Math.round(r.revenue / 1_000_000)),
        backgroundColor: "rgba(79,195,247,0.7)",
        yAxisID: "y",
      },
      {
        type: "bar" as const,
        label: "전기 매출액",
        data: pri.map((r) => Math.round(r.revenue / 1_000_000)),
        backgroundColor: "rgba(79,195,247,0.25)",
        yAxisID: "y",
      },
      {
        type: "line" as const,
        label: "당기 영업이익",
        data: cur.map((r) => Math.round(r.operating_income / 1_000_000)),
        borderColor: "#ffb74d",
        backgroundColor: "#ffb74d",
        tension: 0.3,
        yAxisID: "y",
        pointRadius: 4,
      },
      {
        type: "line" as const,
        label: "전기 영업이익",
        data: pri.map((r) => Math.round(r.operating_income / 1_000_000)),
        borderColor: "rgba(255,183,77,0.4)",
        backgroundColor: "rgba(255,183,77,0.4)",
        tension: 0.3,
        borderDash: [4, 4],
        yAxisID: "y",
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#ccc", font: { size: 12 } } },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${fmtB((ctx.parsed.y ?? 0) * 1_000_000)} 백만`,
        },
      },
    },
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "#2a2a3a" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y: { ticks: { color: "#aaa", callback: (v: any) => `${Number(v).toLocaleString()}` }, grid: { color: "#2a2a3a" } },
    },
  };

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">PL 추이분석 (월별)</div>
        <Chart type="bar" data={chartData} options={options} />
      </div>

      {/* 테이블 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">월별 상세</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>연월</th><th>매출액 (백만)</th><th>매출총이익 (백만)</th><th>영업이익 (백만)</th><th>구분</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year_month} style={{ opacity: r.is_current_year ? 1 : 0.6 }}>
                  <td>{r.year_month}</td>
                  <td>{fmtB(r.revenue)}</td>
                  <td>{fmtB(r.gross_profit)}</td>
                  <td className={r.operating_income >= 0 ? "up-t" : "dn-t"}>{fmtB(r.operating_income)}</td>
                  <td style={{ color: r.is_current_year ? "#4fc3f7" : "#888" }}>{r.is_current_year ? "당기" : "전기"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
