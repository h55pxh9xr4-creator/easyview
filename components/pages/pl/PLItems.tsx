"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLItems } from "@/lib/api";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

interface PLItem { account: string; current: number; prior: number; change_pct: number }

export default function PLItems() {
  const filter = useFilter();
  const [rows, setRows] = useState<PLItem[] | null>(null);

  useEffect(() => {
    fetchPLItems(filter).then((d) => setRows(d as PLItem[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">손익항목 상세</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>공시용계정</th><th>당기</th><th>전기</th><th>증감액</th><th>증감률</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account}>
                  <td>{r.account}</td>
                  <td>{fmt(r.current)}</td>
                  <td>{fmt(r.prior)}</td>
                  <td className={r.current - r.prior >= 0 ? "up-t" : "dn-t"}>{fmt(r.current - r.prior)}</td>
                  <td className={r.change_pct >= 0 ? "up-t" : "dn-t"}>
                    {r.change_pct >= 0 ? "▲" : "▼"}{Math.abs(r.change_pct * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
