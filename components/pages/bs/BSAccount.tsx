"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchBSAccount } from "@/lib/api";

const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

interface BSAcctRow {
  category: string; sum_acct: string; mgmt_acct: string;
  disclosure_acct: string; ending: number; opening: number; change_pct: number;
}

const CATS = ["자산", "부채", "자본"];
const catColor: Record<string, string> = { 자산: "#4fc3f7", 부채: "#ef9a9a", 자본: "#a5d6a7" };

export default function BSAccount() {
  const filter = useFilter();
  const [rows, setRows] = useState<BSAcctRow[] | null>(null);
  const [activeCat, setActiveCat] = useState("자산");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBSAccount(filter).then((d) => setRows(d as BSAcctRow[])).catch(console.error);
  }, [filter.baseYm, filter.bsBase]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const catRows = rows.filter((r) => r.category === activeCat);

  // sum_acct → mgmt_acct → disclosure_acct
  const bySumAcct = catRows.reduce<Record<string, Record<string, BSAcctRow[]>>>((acc, r) => {
    if (!acc[r.sum_acct]) acc[r.sum_acct] = {};
    if (!acc[r.sum_acct][r.mgmt_acct]) acc[r.sum_acct][r.mgmt_acct] = [];
    acc[r.sum_acct][r.mgmt_acct].push(r);
    return acc;
  }, {});

  return (
    <div className="wrap">
      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {CATS.map((cat) => (
          <button
            key={cat}
            className={`ftbtn${activeCat === cat ? " on" : ""}`}
            style={{ color: activeCat === cat ? catColor[cat] : undefined }}
            onClick={() => { setActiveCat(cat); setExpanded({}); }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-title" style={{ color: catColor[activeCat] }}>BS 계정분석 — {activeCat}</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>계정</th><th>기말 (백만)</th><th>기초 (백만)</th><th>증감률</th></tr></thead>
            <tbody>
              {Object.entries(bySumAcct).map(([sum, mgmtMap]) => {
                const sumEnd = Object.values(mgmtMap).flat().reduce((s, r) => s + r.ending, 0);
                const sumOpn = Object.values(mgmtMap).flat().reduce((s, r) => s + r.opening, 0);
                const sumChg = sumOpn ? (sumEnd - sumOpn) / Math.abs(sumOpn) : 0;
                const sumKey = `s-${sum}`;
                const sumOpen = expanded[sumKey];

                return [
                  <tr key={sumKey} className="tr-sum" style={{ cursor: "pointer" }} onClick={() => toggle(sumKey)}>
                    <td>{sumOpen ? "▼" : "▶"} {sum}</td>
                    <td>{fmtB(sumEnd)}</td>
                    <td>{fmtB(sumOpn)}</td>
                    <td className={sumChg >= 0 ? "up-t" : "dn-t"}>
                      {sumChg >= 0 ? "▲" : "▼"}{Math.abs(sumChg * 100).toFixed(1)}%
                    </td>
                  </tr>,
                  ...(!sumOpen ? [] : Object.entries(mgmtMap).map(([mgmt, accts]) => {
                    const mgmtEnd = accts.reduce((s, r) => s + r.ending, 0);
                    const mgmtOpn = accts.reduce((s, r) => s + r.opening, 0);
                    const mgmtChg = mgmtOpn ? (mgmtEnd - mgmtOpn) / Math.abs(mgmtOpn) : 0;
                    const mgmtKey = `m-${sum}-${mgmt}`;
                    const mgmtOpen = expanded[mgmtKey];

                    return [
                      <tr key={mgmtKey} style={{ cursor: "pointer", background: "#1e1e2e" }} onClick={() => toggle(mgmtKey)}>
                        <td className="td-s1">{mgmtOpen ? "▼" : "▶"} {mgmt}</td>
                        <td>{fmtB(mgmtEnd)}</td>
                        <td>{fmtB(mgmtOpn)}</td>
                        <td className={mgmtChg >= 0 ? "up-t" : "dn-t"}>
                          {mgmtChg >= 0 ? "▲" : "▼"}{Math.abs(mgmtChg * 100).toFixed(1)}%
                        </td>
                      </tr>,
                      ...(!mgmtOpen ? [] : accts.map((r) => (
                        <tr key={`${r.sum_acct}-${r.mgmt_acct}-${r.disclosure_acct}`} style={{ background: "#171723" }}>
                          <td style={{ paddingLeft: 40, color: "#aaa" }}>{r.disclosure_acct}</td>
                          <td>{fmtB(r.ending)}</td>
                          <td>{fmtB(r.opening)}</td>
                          <td className={r.change_pct >= 0 ? "up-t" : "dn-t"}>
                            {r.change_pct >= 0 ? "▲" : "▼"}{Math.abs(r.change_pct * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))),
                    ];
                  })),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
