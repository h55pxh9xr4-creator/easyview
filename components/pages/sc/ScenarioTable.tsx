"use client";

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
  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  return (
    <div className="wrap">
      <div style={{ marginBottom: 12, padding: "10px 14px", background: "#1e1e2e", borderRadius: 6, borderLeft: "3px solid #ffb74d" }}>
        <div style={{ fontWeight: 700, color: "#ffb74d", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#aaa" }}>{desc}</div>
        <div style={{ fontSize: 13, color: "#ccc", marginTop: 6 }}>
          탐지 건수: <strong style={{ color: "#4fc3f7" }}>{rows.length.toLocaleString()}건</strong>
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
                    <td style={{ color: r.dr_cr === "차변" ? "#4fc3f7" : "#ef9a9a" }}>{r.dr_cr}</td>
                    <td>{fmt(r.amount)}</td>
                    {extraCols.map((c) => <td key={c.key} style={{ color: "#ffb74d" }}>{String(r[c.key] ?? "")}</td>)}
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
