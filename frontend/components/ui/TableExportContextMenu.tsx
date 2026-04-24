"use client";

import { useEffect, useState } from "react";
import { exportSingleTableToXlsx, findTableTitle } from "@/lib/exports";

interface MenuState {
  x: number;
  y: number;
  tableEl: HTMLTableElement;
  title: string;
}

interface Props {
  pageLabel?: string;
}

/**
 * 테이블이 있는 카드를 우클릭하면 "이 표를 엑셀로 다운로드" 팝업이 뜸.
 * 다른 곳 우클릭에는 관여하지 않음(브라우저 기본 메뉴).
 */
export default function TableExportContextMenu({ pageLabel }: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      // 테이블 자체 또는 카드(.card) 내부인지
      const table = (target.closest("table") as HTMLTableElement | null)
        ?? (target.closest<HTMLElement>(".card")?.querySelector<HTMLTableElement>("table") ?? null);
      if (!table) return; // 대시보드 카드가 아니면 기본 메뉴 유지
      const { title } = findTableTitle(table);
      if (!title) return; // 제목을 못 찾으면 기본 메뉴 유지
      e.preventDefault();
      // 화면 밖으로 넘치지 않게 대략 보정
      const MENU_W = 200;
      const MENU_H = 44;
      const x = Math.min(e.clientX, window.innerWidth - MENU_W - 8);
      const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8);
      setMenu({ x, y, tableEl: table, title });
    };

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".table-export-ctx")) return;
      setMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onScroll = () => setMenu(null);

    document.addEventListener("contextmenu", onContext);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!menu) return null;

  const handleExport = () => {
    try {
      exportSingleTableToXlsx({ tableEl: menu.tableEl, title: menu.title, pageLabel });
    } catch (e) {
      console.error(e);
      alert("엑셀 생성 중 오류가 발생했습니다.");
    } finally {
      setMenu(null);
    }
  };

  return (
    <div
      className="table-export-ctx"
      style={{
        position: "fixed",
        top: menu.y,
        left: menu.x,
        zIndex: 3000,
        background: "var(--bg-card, #fff)",
        border: "1px solid var(--border, #E0E0E0)",
        borderRadius: 6,
        padding: 4,
        minWidth: 200,
        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        color: "var(--text-primary, #2C2C2C)",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={{ fontSize: 10.5, color: "#999", padding: "4px 10px", fontWeight: 700, letterSpacing: "0.3px" }}>
        {menu.title}
      </div>
      <button
        onClick={handleExport}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", textAlign: "left",
          padding: "8px 10px", background: "transparent", border: "none",
          borderRadius: 4, fontSize: 12.5, fontWeight: 500,
          color: "inherit", cursor: "pointer", fontFamily: "inherit",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,119,34,0.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
          <line x1="12" y1="12" x2="12" y2="18"/>
        </svg>
        이 표를 엑셀로 다운로드
      </button>
    </div>
  );
}
