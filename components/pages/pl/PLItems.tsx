"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { fetchPLItemsTable, ViewType } from "@/lib/api";

const fmt = (n: number) =>
  n === 0 ? "-" : Math.round(n).toLocaleString("ko-KR");

interface TableRow {
  type: "disclosure" | "mgmt" | "subtotal";
  label: string;
  values: number[];
}
interface TableData {
  columns: string[];
  rows: TableRow[];
}

type LevelType = "disclosure" | "all";

const ORANGE     = "#E87722";
const ORANGE_BG  = "#FFF8F3";
const ORANGE_L   = "rgba(232,119,34,0.12)";

export default function PLItems() {
  const filter = useFilter();
  const { triggerComment } = useComment();
  const [viewType,  setViewType]  = useState<ViewType>("quarter");
  const [levelType, setLevelType] = useState<LevelType>("all");
  const [data,    setData]    = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPLItemsTable(filter, viewType)
      .then(d => setData(d as TableData))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter.baseYm, viewType]);

  // 레벨 필터 적용
  const visibleRows = data?.rows.filter(r =>
    levelType === "disclosure" ? r.type !== "mgmt" : true
  ) ?? [];

  // 연도 그룹 계산
  const colGroups: { label: string; indices: number[] }[] = [];
  if (data) {
    data.columns.forEach((col, i) => {
      const yearLabel = viewType === "year"
        ? col
        : viewType === "quarter"
          ? col.split("/")[0] + "년"
          : col.split("/")[0] + "년";
      const last = colGroups[colGroups.length - 1];
      if (!last || last.label !== yearLabel) {
        colGroups.push({ label: yearLabel, indices: [i] });
      } else {
        last.indices.push(i);
      }
    });
  }

  const isLastInGroup = (i: number) =>
    colGroups.some(g => g.indices[g.indices.length - 1] === i);

  // 토글 버튼 공통 스타일
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: "4px 14px",
    fontSize: 12,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    background: active ? ORANGE : "#fff",
    color: active ? "#fff" : "#888",
    transition: "background 0.15s, color 0.15s",
  });

  const toggleWrap: React.CSSProperties = {
    display: "flex",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid #E0E0E0",
  };

  return (
    <div className="wrap">

      {/* 컨트롤 바 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* 계정 단계 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>계정 단계</span>
          <div style={toggleWrap}>
            {([["disclosure", "공시용계정"], ["all", "관리계정"]] as [LevelType, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setLevelType(v)} style={toggleBtn(levelType === v)}>{label}</button>
            ))}
          </div>
        </div>

        {/* 기간 단위 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#999", fontWeight: 600 }}>기간</span>
          <div style={toggleWrap}>
            {([["month", "월"], ["quarter", "분기"], ["year", "연"]] as [ViewType, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setViewType(v)} style={toggleBtn(viewType === v)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 테이블 카드 */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "#bbb" }}>로딩 중...</div>
        )}
        {!loading && data && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 800, borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
              <thead>
                {/* 연도 그룹 행 */}
                <tr>
                  <th rowSpan={2} style={{
                    background: "#FAFAFA", color: "#888", padding: "10px 16px",
                    textAlign: "left", position: "sticky", left: 0, zIndex: 2,
                    minWidth: 200, fontWeight: 600, fontSize: 11,
                    borderRight: "1px solid #E8E8E8",
                    borderBottom: `2px solid ${ORANGE}`,
                    verticalAlign: "middle", letterSpacing: "0.03em",
                  }}>계정</th>
                  {colGroups.map(g => (
                    <th key={g.label} colSpan={g.indices.length} style={{
                      background: "#FAFAFA", color: "#555", padding: "8px 6px",
                      textAlign: "center", fontWeight: 700, fontSize: 12,
                      borderRight: "1px solid #E8E8E8",
                      borderBottom: "1px solid #EFEFEF",
                    }}>{g.label}</th>
                  ))}
                </tr>
                {/* 기간 컬럼 행 */}
                <tr style={{ borderBottom: `2px solid ${ORANGE}` }}>
                  {data.columns.map((col, i) => (
                    <th key={i} style={{
                      background: "#FAFAFA", color: "#999", padding: "6px 12px",
                      textAlign: "center", fontWeight: 600, fontSize: 11,
                      borderRight: isLastInGroup(i) ? "1px solid #E8E8E8" : "1px solid #F3F3F3",
                      letterSpacing: "0.02em",
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, ri) => {
                  const isSubtotal   = row.type === "subtotal";
                  const isDisclosure = row.type === "disclosure";
                  const isMgmt       = row.type === "mgmt";

                  const rowBg = isSubtotal
                    ? ORANGE_L
                    : isDisclosure
                      ? "#FAFAFA"
                      : "#fff";
                  const labelColor = isSubtotal ? ORANGE : isDisclosure ? "#333" : "#555";
                  const rowFw = isSubtotal ? 700 : isDisclosure ? 600 : 400;

                  return (
                    <tr key={ri} style={{
                      borderBottom: isSubtotal ? `1px solid rgba(232,119,34,0.2)` : "1px solid #F5F5F5",
                      background: rowBg,
                      cursor: "pointer",
                    }} onClick={() => triggerComment({ page: "손익항목", label: row.label, value: fmt(row.values[row.values.length - 1]) })}>
                      {/* 계정명 셀 */}
                      <td style={{
                        padding: isMgmt ? "5px 16px 5px 32px" : isSubtotal ? "8px 16px" : "6px 16px",
                        position: "sticky", left: 0, zIndex: 1,
                        background: rowBg, color: labelColor, fontWeight: rowFw,
                        borderRight: "1px solid #E8E8E8",
                        fontSize: isMgmt ? 11 : 12,
                        whiteSpace: "nowrap",
                        borderLeft: isSubtotal ? `3px solid ${ORANGE}` : "3px solid transparent",
                      }}>
                        {isMgmt && <span style={{ color: "#D0D0D0", marginRight: 6, fontSize: 10 }}>└</span>}
                        {row.label}
                      </td>

                      {/* 값 셀 */}
                      {row.values.map((v, ci) => {
                        const valColor = isSubtotal
                          ? ORANGE
                          : isDisclosure
                            ? "#333"
                            : v < 0 ? "#2563EB" : v === 0 ? "#CCC" : "#444";
                        return (
                          <td key={ci} style={{
                            textAlign: "right",
                            fontSize: 12,
                            padding: "5px 12px",
                            color: valColor,
                            fontWeight: isSubtotal ? 700 : isDisclosure ? 600 : 400,
                            borderRight: isLastInGroup(ci) ? "1px solid #E8E8E8" : "1px solid #F3F3F3",
                            background: rowBg,
                            whiteSpace: "nowrap",
                          }}>
                            {fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
