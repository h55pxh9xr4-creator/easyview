"use client";

import Loading from "@/components/ui/Loading";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

export interface ScRow {
  date: string; voucher_no: string; account_name: string;
  counterparty: string; description: string; amount: number; dr_cr: string;
  [key: string]: string | number;
}

interface Props {
  title: string;
  desc: string;
  rows: ScRow[] | null;
  extraCols?: { key: string; label: string }[];
}

export default function ScenarioTable({ title, desc, rows, extraCols = [] }: Props) {
  if (!rows) return <Loading />;

  return (
    <div className="wrap">
      <div className="info-note" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#E87722", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#666" }}>{desc}</div>
        <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
          탐지 건수: <strong style={{ color: "#E87722" }}>{rows.length.toLocaleString()}건</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>탐지된 전표가 없습니다.</div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>일자</th><th>전표번호</th><th>계정과목</th>
                  <th>거래처</th><th>적요</th><th>차/대</th><th>금액</th>
                  {extraCols.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                    <td>{r.voucher_no}</td>
                    <td>{r.account_name}</td>
                    <td>{r.counterparty}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                    <td style={{ color: r.dr_cr === "차변" ? "#2563EB" : "#EF4444", fontWeight: 600 }}>{r.dr_cr}</td>
                    <td>{fmt(r.amount)}</td>
                    {extraCols.map((c) => <td key={c.key} style={{ color: "#E87722", fontWeight: 600 }}>{String(r[c.key] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
