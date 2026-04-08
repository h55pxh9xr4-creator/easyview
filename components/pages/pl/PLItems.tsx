"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
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
                <tr style={{ borderBottom: "none" }}>
                  <th rowSpan={2} style={{
                    background: ORANGE_BG, color: ORANGE, padding: "8px 14px",
                    textAlign: "left", position: "sticky", left: 0, zIndex: 2,
                    minWidth: 180, fontWeight: 700, fontSize: 12,
                    borderRight: "2px solid #E87722",
                    borderBottom: `2px solid ${ORANGE}`,
                    verticalAlign: "middle",
                  }}>기간</th>
                  {colGroups.map(g => (
                    <th key={g.label} colSpan={g.indices.length} style={{
                      background: ORANGE_BG, color: ORANGE, padding: "8px 6px",
                      textAlign: "center", fontWeight: 800, fontSize: 13,
                      borderRight: "2px solid #E87722", borderBottom: "1px solid #F0E8E0",
                    }}>{g.label}</th>
                  ))}
                </tr>
                {/* 기간 컬럼 행 */}
                <tr style={{ borderBottom: `2px solid ${ORANGE}` }}>
                  {data.columns.map((col, i) => (
                    <th key={i} style={{
                      background: ORANGE_BG, color: "#555", padding: "6px 10px",
                      textAlign: "right", fontWeight: 600, fontSize: 11,
                      borderRight: isLastInGroup(i) ? "2px solid #E87722" : "1px solid #EEE",
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
                    ? ORANGE
                    : isDisclosure
                      ? "#F5F5F5"
                      : "#fff";
                  const rowColor = isSubtotal ? "#fff" : "#2C2C2C";
                  const rowFw    = isSubtotal ? 800 : isDisclosure ? 700 : 400;

                  return (
                    <tr key={ri} style={{ borderBottom: "1px solid #F0F0F0", background: rowBg }}>
                      {/* 계정명 셀 */}
                      <td style={{
                        padding: isMgmt ? "5px 14px 5px 30px" : "7px 14px",
                        position: "sticky", left: 0, zIndex: 1,
                        background: rowBg, color: rowColor, fontWeight: rowFw,
                        borderRight: "2px solid #E8E8E8",
                        fontSize: isMgmt ? 11 : 12,
                        whiteSpace: "nowrap",
                      }}>
                        {isMgmt && <span style={{ color: "#ccc", marginRight: 5 }}>└</span>}
                        {row.label}
                      </td>

                      {/* 값 셀 */}
                      {row.values.map((v, ci) => {
                        const neg = v < 0;
                        const valColor = isSubtotal || isDisclosure
                          ? rowColor
                          : neg ? "#2563EB" : v === 0 ? "#bbb" : "#2C2C2C";
                        return (
                          <td key={ci} style={{
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontSize: 12,
                            padding: "5px 10px",
                            color: valColor,
                            fontWeight: isSubtotal ? 800 : isDisclosure ? 700 : 400,
                            borderRight: isLastInGroup(ci) ? "2px solid #E8E8E8" : "1px solid #F0F0F0",
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
