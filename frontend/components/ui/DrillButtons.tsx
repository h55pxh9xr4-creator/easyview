"use client";

import { useTranslation } from "react-i18next";

interface Props {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  isDark?: boolean;
}

/**
 * 계층 테이블용 "전체 펼침 / 전체 접힘" 버튼 한 쌍.
 * 카드 헤더 우측에 배치해서 사용.
 */
export default function DrillButtons({ onExpandAll, onCollapseAll, isDark = false }: Props) {
  const { t } = useTranslation();
  const bg = isDark ? "#252830" : "#fff";
  const bdr = isDark ? "#2E3039" : "#E0E0E0";
  const txt = isDark ? "#C4C9D4" : "#555";

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    height: 26,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color: txt,
    border: `1px solid ${bdr}`,
    borderRadius: 5,
    cursor: "pointer",
    fontFamily: "inherit",
    lineHeight: 1,
  };

  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      <button
        onClick={onExpandAll}
        title={t("drill.expandAll", "전체 펼침")}
        style={btnStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "#2E3039" : "#F5F5F5"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = bg; }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </svg>
        {t("drill.expandAll", "전체 펼침")}
      </button>
      <button
        onClick={onCollapseAll}
        title={t("drill.collapseAll", "전체 접힘")}
        style={btnStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "#2E3039" : "#F5F5F5"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = bg; }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 11 12 6 7 11" />
          <polyline points="17 18 12 13 7 18" />
        </svg>
        {t("drill.collapseAll", "전체 접힘")}
      </button>
    </div>
  );
}
