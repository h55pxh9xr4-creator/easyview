"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { fetchPLItemsTable, ViewType } from "@/lib/api";
import { useDarkMode } from "@/hooks/useDarkMode";

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
  const isDark = useDarkMode();
  const filter = useFilter();
  const { triggerComment, target: cmtTarget, panelOpen } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const isHighlighted = (label: string) =>
    panelOpen && !!cmtTarget?.inquiryId && cmtTarget.page === "손익항목" && cmtTarget.label === label;
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

  // 다크모드 색상
  const thBg       = isDark ? "#252830" : "#FAFAFA";
  const thClr      = isDark ? "#9198A8" : "#888";
  const thSubClr   = isDark ? "#E2E5EC" : "#555";
  const thPeriodClr = isDark ? "#9198A8" : "#999";
  const bdrStrong  = isDark ? "#2E3039" : "#E8E8E8";
  const bdrSoft    = isDark ? "#252830" : "#F3F3F3";
  const bdrRow     = isDark ? "#2A2D36" : "#F5F5F5";
  const rowDiscBg  = isDark ? "#252830" : "#FAFAFA";
  const rowMgmtBg  = isDark ? "#1C1F26" : "#fff";
  const discClr    = isDark ? "#E2E5EC" : "#333";
  const mgmtClr    = isDark ? "#C8CCDA" : "#555";
  const arrowClr   = isDark ? "#3A3F4A" : "#D0D0D0";
  const zeroClr    = isDark ? "#3A3F4A" : "#CCC";
  const negClr     = isDark ? "#60A5FA" : "#2563EB";
  const posClr     = isDark ? "#C8CCDA" : "#444";

  // 토글 버튼 공통 스타일
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: "4px 14px",
    fontSize: 12,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    background: active ? ORANGE : (isDark ? "#1C1F26" : "#fff"),
    color: active ? "#fff" : (isDark ? "#9198A8" : "#888"),
    transition: "background 0.15s, color 0.15s",
  });

  const toggleWrap: React.CSSProperties = {
    display: "flex",
    borderRadius: 6,
    overflow: "hidden",
    border: `1px solid ${isDark ? "#2E3039" : "#E0E0E0"}`,
  };

  return (
    <div className="wrap">

      {/* 컨트롤 바 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* 계정 단계 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: isDark ? "#9198A8" : "#999", fontWeight: 600 }}>계정 단계</span>
          <div style={toggleWrap}>
            {([["disclosure", "공시용계정"], ["all", "관리계정"]] as [LevelType, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setLevelType(v)} style={toggleBtn(levelType === v)}>{label}</button>
            ))}
          </div>
        </div>

        {/* 기간 단위 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: isDark ? "#9198A8" : "#999", fontWeight: 600 }}>기간</span>
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
          <div style={{ padding: 40, textAlign: "center", color: isDark ? "#5A6070" : "#bbb" }}>로딩 중...</div>
        )}
        {!loading && data && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 800, borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
              <thead>
                {/* 연도 그룹 행 */}
                <tr>
                  <th rowSpan={2} style={{
                    background: thBg, color: thClr, padding: "10px 16px",
                    textAlign: "left", position: "sticky", left: 0, zIndex: 2,
                    minWidth: 200, fontWeight: 600, fontSize: 11,
                    borderRight: `1px solid ${bdrStrong}`,
                    borderBottom: `2px solid ${ORANGE}`,
                    verticalAlign: "middle", letterSpacing: "0.03em",
                  }}>계정</th>
                  {colGroups.map(g => (
                    <th key={g.label} colSpan={g.indices.length} style={{
                      background: thBg, color: thSubClr, padding: "8px 6px",
                      textAlign: "center", fontWeight: 700, fontSize: 12,
                      borderRight: `1px solid ${bdrStrong}`,
                      borderBottom: `1px solid ${isDark ? "#2E3039" : "#EFEFEF"}`,
                    }}>{g.label}</th>
                  ))}
                </tr>
                {/* 기간 컬럼 행 */}
                <tr style={{ borderBottom: `2px solid ${ORANGE}` }}>
                  {data.columns.map((col, i) => (
                    <th key={i} style={{
                      background: thBg, color: thPeriodClr, padding: "6px 12px",
                      textAlign: "center", fontWeight: 600, fontSize: 11,
                      borderRight: isLastInGroup(i) ? `1px solid ${bdrStrong}` : `1px solid ${bdrSoft}`,
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
                      ? rowDiscBg
                      : rowMgmtBg;
                  const labelColor = isSubtotal ? ORANGE : isDisclosure ? discClr : mgmtClr;
                  const rowFw = isSubtotal ? 700 : isDisclosure ? 600 : 400;

                  return (
                    <tr key={ri} style={{
                      borderBottom: isSubtotal ? `1px solid rgba(232,119,34,0.2)` : `1px solid ${bdrRow}`,
                      background: rowBg,
                      transition: "background 0.25s",
                    }}>
                      {/* 계정명 셀 — 클릭 없음 */}
                      <td style={{
                        padding: isMgmt ? "5px 16px 5px 32px" : isSubtotal ? "8px 16px" : "6px 16px",
                        position: "sticky", left: 0, zIndex: 1,
                        background: rowBg, color: labelColor, fontWeight: rowFw,
                        borderRight: `1px solid ${bdrStrong}`,
                        fontSize: isMgmt ? 11 : 12,
                        whiteSpace: "nowrap",
                        borderLeft: isSubtotal ? `3px solid ${ORANGE}` : "3px solid transparent",
                      }}>
                        {isMgmt && <span style={{ color: arrowClr, marginRight: 6, fontSize: 10 }}>└</span>}
                        {row.label}
                      </td>

                      {/* 값 셀 — 각 셀 개별 클릭 → comment */}
                      {row.values.map((v, ci) => {
                        const colLabel = data.columns[ci] ?? "";
                        const cellKey  = commentKey("손익항목", `${row.label} (${colLabel})`);
                        const hasCmt   = ck.has(cellKey);
                        const valColor = isSubtotal
                          ? ORANGE
                          : isDisclosure
                            ? discClr
                            : v < 0 ? negClr : v === 0 ? zeroClr : posClr;
                        return (
                          <td
                            key={ci}
                            style={{
                              textAlign: "right",
                              fontSize: 12,
                              padding: "5px 12px",
                              color: valColor,
                              fontWeight: isSubtotal ? 700 : isDisclosure ? 600 : 400,
                              borderRight: isLastInGroup(ci) ? `1px solid ${bdrStrong}` : `1px solid ${bdrSoft}`,
                              background: hasCmt ? (isDark ? "rgba(232,119,34,0.12)" : "rgba(232,119,34,0.06)") : rowBg,
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                              position: "relative",
                            }}
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              triggerComment(
                                { page: "손익항목", label: `${row.label} (${colLabel})`, value: fmt(v) },
                                { top: r.top, right: r.right }
                              );
                            }}
                          >
                            {fmt(v)}
                            {hasCmt && (
                              <CommentDot inquiryId={ck.get(cellKey)!} inline />
                            )}
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
