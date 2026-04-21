"use client";

import Loading from "@/components/ui/Loading";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { useDarkMode } from "@/hooks/useDarkMode";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const BLUE = "rgba(37,99,235,1)";
const RED  = "rgba(220,38,38,1)";

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
  const isDark = useDarkMode();
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);
  if (!rows) return <Loading />;

  const subTxt  = isDark ? "#9198A8" : "#666";
  const dimTxt  = isDark ? "#5A6070" : "#555";
  const theadBg = isDark ? "#1C1F26" : "#FFF";
  const emptyClr = isDark ? "#5A6070" : "#aaa";

  return (
    <div className="wrap">
      <div className="info-note" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#E87722", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: subTxt }}>{desc}</div>
        <div style={{ fontSize: 13, color: dimTxt, marginTop: 6 }}>
          탐지 건수: <strong style={{ color: "#E87722" }}>{rows.length.toLocaleString()}건</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 40, color: emptyClr, textAlign: "center" }}>탐지된 전표가 없습니다.</div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
                <tr>
                  <th>일자</th><th>전표번호</th><th>계정과목</th>
                  <th>거래처</th><th>적요</th><th>차/대</th><th>금액</th>
                  {extraCols.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const label = `${r.voucher_no} (${r.date})`;
                  return (
                  <tr key={i} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); triggerComment({ page: title, label, value: `${fmt(r.amount)}원` }, { top: rect.top, right: rect.right }); }} style={{ cursor: "pointer" }}>
                    <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                    <td>
                      {r.voucher_no}
                      {ck.has(commentKey(title, label)) && <CommentDot inline inquiryId={ck.get(commentKey(title, label))!} />}
                    </td>
                    <td>{r.account_name}</td>
                    <td>{r.counterparty}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                    <td style={{ color: r.dr_cr === "차변" ? BLUE : RED, fontWeight: 600 }}>{r.dr_cr}</td>
                    <td>{fmt(r.amount)}</td>
                    {extraCols.map((c) => <td key={c.key} style={{ color: "#E87722", fontWeight: 600 }}>{String(r[c.key] ?? "")}</td>)}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
