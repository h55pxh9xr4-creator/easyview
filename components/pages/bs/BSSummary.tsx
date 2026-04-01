"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchBSSummary } from "@/lib/api";

const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const arrowTxt = (p: number) => p >= 0 ? `▲ ${Math.abs(p * 100).toFixed(1)}%` : `▼ ${Math.abs(p * 100).toFixed(1)}%`;

interface BSRow { category: string; sum_acct: string; ending: number; opening: number; change_pct: number }

export default function BSSummary() {
  const filter = useFilter();
  const [rows, setRows] = useState<BSRow[] | null>(null);

  useEffect(() => {
    fetchBSSummary(filter).then((d) => setRows(d as BSRow[])).catch(console.error);
  }, [filter.baseYm, filter.bsBase]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  // category별 합계
  const totals: Record<string, { ending: number; opening: number }> = {};
  for (const r of rows) {
    if (!totals[r.category]) totals[r.category] = { ending: 0, opening: 0 };
    totals[r.category].ending  += r.ending;
    totals[r.category].opening += r.opening;
  }

  const cats = ["자산", "부채", "자본"];
  const catColor: Record<string, string> = { 자산: "#4fc3f7", 부채: "#ef9a9a", 자본: "#a5d6a7" };

  return (
    <div className="wrap">
      {/* KPI strip */}
      <div className="kpi-strip">
        {cats.map((cat) => {
          const t = totals[cat] ?? { ending: 0, opening: 0 };
          const chg = t.opening ? (t.ending - t.opening) / Math.abs(t.opening) : 0;
          return (
            <div key={cat} className="kpi">
              <div className="kpi-lbl">{cat}</div>
              <div className="kpi-val">{fmtB(t.ending)}<span className="u">백만</span></div>
              <div className={`kpi-chg ${chg >= 0 ? "up" : "dn"}`}>{arrowTxt(chg)}</div>
            </div>
          );
        })}
      </div>

      {/* 카테고리별 카드 */}
      <div className="g2" style={{ gap: 16 }}>
        {cats.map((cat) => {
          const catRows = rows.filter((r) => r.category === cat);
          const total = totals[cat] ?? { ending: 0, opening: 0 };
          return (
            <div key={cat} className="card">
              <div className="card-title" style={{ color: catColor[cat] }}>{cat}</div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>합산계정</th><th>기말 (백만)</th><th>기초 (백만)</th><th>증감률</th></tr></thead>
                  <tbody>
                    {catRows.map((r) => (
                      <tr key={r.sum_acct}>
                        <td>{r.sum_acct}</td>
                        <td>{fmtB(r.ending)}</td>
                        <td>{fmtB(r.opening)}</td>
                        <td className={r.change_pct >= 0 ? "up-t" : "dn-t"}>
                          {r.change_pct >= 0 ? "▲" : "▼"}{Math.abs(r.change_pct * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    <tr className="tr-sum">
                      <td>합계</td>
                      <td>{fmtB(total.ending)}</td>
                      <td>{fmtB(total.opening)}</td>
                      <td className={total.ending >= total.opening ? "up-t" : "dn-t"}>
                        {total.ending >= total.opening ? "▲" : "▼"}
                        {total.opening ? Math.abs((total.ending - total.opening) / total.opening * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
