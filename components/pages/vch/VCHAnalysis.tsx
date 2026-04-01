"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchVCHAnalysis } from "@/lib/api";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

interface VCHRow {
  disclosure_acct: string; mgmt_acct: string; dr_cr: string;
  voucher_cnt: number; line_cnt: number; total_amount: number;
}

export default function VCHAnalysis() {
  const filter = useFilter();
  const [rows, setRows] = useState<VCHRow[] | null>(null);
  const [sortCol, setSortCol] = useState<keyof VCHRow>("total_amount");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchVCHAnalysis(filter).then((d) => setRows(d as VCHRow[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const handleSort = (col: keyof VCHRow) => {
    if (sortCol === col) setSortAsc((p) => !p);
    else { setSortCol(col); setSortAsc(false); }
  };

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol];
    if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
    return sortAsc
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  const th = (col: keyof VCHRow, label: string) => (
    <th style={{ cursor: "pointer" }} onClick={() => handleSort(col)}>
      {label}{sortCol === col ? (sortAsc ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">전표분석내역 (상위 200건)</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                {th("disclosure_acct", "공시용계정")}
                {th("mgmt_acct", "관리계정")}
                {th("dr_cr", "차/대")}
                {th("voucher_cnt", "전표수")}
                {th("line_cnt", "행수")}
                {th("total_amount", "금액합계")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={i}>
                  <td>{r.disclosure_acct}</td>
                  <td>{r.mgmt_acct}</td>
                  <td style={{ color: r.dr_cr === "차변" ? "#4fc3f7" : "#ef9a9a" }}>{r.dr_cr}</td>
                  <td>{r.voucher_cnt.toLocaleString()}</td>
                  <td>{r.line_cnt.toLocaleString()}</td>
                  <td>{fmt(r.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
