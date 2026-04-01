"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLSales } from "@/lib/api";

const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

interface SalesRow { counterparty: string; current: number; prior: number; change: number }

export default function PLSales() {
  const filter = useFilter();
  const [rows, setRows] = useState<SalesRow[] | null>(null);

  useEffect(() => {
    fetchPLSales(filter).then((d) => setRows(d as SalesRow[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const maxVal = Math.max(...rows.map((r) => r.current), 1);

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">거래처별 매출분석 (상위 20개)</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>거래처</th><th>당기 (백만)</th><th>전기 (백만)</th><th>증감 (백만)</th><th>비중</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const barPct = (r.current / maxVal) * 100;
                return (
                  <tr key={r.counterparty}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: i < 3 ? "#4fc3f7" : "#ccc", fontWeight: i < 3 ? 700 : 400, minWidth: 20 }}>{i + 1}</span>
                        <div>
                          {r.counterparty}
                          <div style={{ height: 4, background: "#2a2a3a", borderRadius: 2, marginTop: 3, width: 120 }}>
                            <div style={{ height: "100%", width: `${barPct}%`, background: "#4fc3f7", borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{fmtB(r.current)}</td>
                    <td>{fmtB(r.prior)}</td>
                    <td className={r.change >= 0 ? "up-t" : "dn-t"}>{fmtB(r.change)}</td>
                    <td style={{ color: "#aaa" }}>{(r.current / maxVal * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
