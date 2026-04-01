"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLAccount } from "@/lib/api";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

interface AcctRow {
  disclosure_acct: string;
  mgmt_acct: string;
  account_name: string;
  category: string;
  current: number;
  prior: number;
  change_pct: number;
}

export default function PLAccount() {
  const filter = useFilter();
  const [rows, setRows] = useState<AcctRow[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPLAccount(filter).then((d) => setRows(d as AcctRow[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  // Group: disclosure_acct → mgmt_acct → account_name
  const byDisclosure = rows.reduce<Record<string, Record<string, AcctRow[]>>>((acc, r) => {
    if (!acc[r.disclosure_acct]) acc[r.disclosure_acct] = {};
    if (!acc[r.disclosure_acct][r.mgmt_acct]) acc[r.disclosure_acct][r.mgmt_acct] = [];
    acc[r.disclosure_acct][r.mgmt_acct].push(r);
    return acc;
  }, {});

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">PL 계정분석</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>계정</th><th>당기</th><th>전기</th><th>증감률</th></tr>
            </thead>
            <tbody>
              {Object.entries(byDisclosure).map(([disc, mgmtMap]) => {
                // disclosure subtotal
                const discCur = Object.values(mgmtMap).flat().reduce((s, r) => s + r.current, 0);
                const discPri = Object.values(mgmtMap).flat().reduce((s, r) => s + r.prior, 0);
                const discChg = discPri ? (discCur - discPri) / Math.abs(discPri) : 0;
                const discKey = `d-${disc}`;
                const discOpen = expanded[discKey];

                return [
                  <tr key={discKey} className="tr-sum" style={{ cursor: "pointer" }} onClick={() => toggle(discKey)}>
                    <td>{discOpen ? "▼" : "▶"} {disc}</td>
                    <td>{fmt(discCur)}</td>
                    <td>{fmt(discPri)}</td>
                    <td className={discChg >= 0 ? "up-t" : "dn-t"}>
                      {discChg >= 0 ? "▲" : "▼"}{Math.abs(discChg * 100).toFixed(1)}%
                    </td>
                  </tr>,
                  ...(!discOpen ? [] : Object.entries(mgmtMap).map(([mgmt, accts]) => {
                    const mgmtCur = accts.reduce((s, r) => s + r.current, 0);
                    const mgmtPri = accts.reduce((s, r) => s + r.prior, 0);
                    const mgmtChg = mgmtPri ? (mgmtCur - mgmtPri) / Math.abs(mgmtPri) : 0;
                    const mgmtKey = `m-${disc}-${mgmt}`;
                    const mgmtOpen = expanded[mgmtKey];

                    return [
                      <tr key={mgmtKey} style={{ cursor: "pointer", background: "#1e1e2e" }} onClick={() => toggle(mgmtKey)}>
                        <td className="td-s1">{mgmtOpen ? "▼" : "▶"} {mgmt}</td>
                        <td>{fmt(mgmtCur)}</td>
                        <td>{fmt(mgmtPri)}</td>
                        <td className={mgmtChg >= 0 ? "up-t" : "dn-t"}>
                          {mgmtChg >= 0 ? "▲" : "▼"}{Math.abs(mgmtChg * 100).toFixed(1)}%
                        </td>
                      </tr>,
                      ...(!mgmtOpen ? [] : accts.map((r) => (
                        <tr key={`${r.disclosure_acct}-${r.mgmt_acct}-${r.account_name}`} style={{ background: "#171723" }}>
                          <td style={{ paddingLeft: 40, color: "#aaa" }}>{r.account_name}</td>
                          <td>{fmt(r.current)}</td>
                          <td>{fmt(r.prior)}</td>
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
