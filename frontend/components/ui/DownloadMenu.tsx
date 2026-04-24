"use client";

import { useState, useRef, useEffect } from "react";
import {
  exportCurrentPageToPdf,
  exportMultiplePagesToPdf,
  exportCurrentPageTablesToXlsx,
  REPORT_SUBS,
} from "@/lib/exports";

type Mode = "closed" | "menu" | "selectPages" | "progress";

interface DownloadMenuProps {
  activeSub: string;
  pageLabel: string;
  /** 멀티 페이지 PDF에서 activeSub를 변경하기 위한 setter */
  setActiveSub: (sub: string) => void;
  /** 상위 탭도 함께 맞추기 위한 setter (선택) */
  setActiveTab?: (tab: string) => void;
  setPageLabel?: (label: string) => void;
}

export default function DownloadMenu({
  activeSub,
  pageLabel,
  setActiveSub,
  setActiveTab,
  setPageLabel,
}: DownloadMenuProps) {
  const [mode, setMode] = useState<Mode>("closed");
  const [selected, setSelected] = useState<Set<string>>(new Set(REPORT_SUBS.map(s => s.id)));
  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>({ done: 0, total: 0, label: "" });
  const btnRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (mode !== "menu" && mode !== "selectPages") return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (target.closest(".download-menu-panel")) return;
      setMode("closed");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [mode]);

  const getMainContentEl = (): HTMLElement | null => document.querySelector(".main-content");

  // ── 현재 페이지 PDF ────────────────────────────────────────
  const handleCurrentPdf = async () => {
    const el = getMainContentEl();
    if (!el) return;
    setMode("closed");
    try {
      await exportCurrentPageToPdf({ mainContentEl: el, pageLabel });
    } catch (e) {
      console.error(e);
      alert("PDF 생성 중 오류가 발생했습니다.");
    }
  };

  // ── 현재 페이지 테이블 Xlsx ────────────────────────────────
  const handleCurrentXlsx = () => {
    const el = getMainContentEl();
    if (!el) return;
    setMode("closed");
    try {
      const { sheetCount } = exportCurrentPageTablesToXlsx({ mainContentEl: el, pageLabel });
      if (sheetCount === 0) alert("현재 페이지에 내보낼 테이블이 없습니다.");
    } catch (e) {
      console.error(e);
      alert("엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  // ── 여러 페이지 PDF ────────────────────────────────────────
  const runMultiPdf = async (subIds: string[]) => {
    if (subIds.length === 0) return;
    const originalSub = activeSub;
    cancelRef.current = false;
    setMode("progress");
    setProgress({ done: 0, total: subIds.length, label: "" });

    try {
      const result = await exportMultiplePagesToPdf({
        subIds,
        controller: {
          setSub: async (subId) => {
            const meta = REPORT_SUBS.find(s => s.id === subId);
            if (meta) {
              setActiveTab?.(meta.tab);
              setActiveSub(meta.id);
              setPageLabel?.(meta.label);
            } else {
              setActiveSub(subId);
            }
            await new Promise<void>(r => requestAnimationFrame(() => r()));
          },
          getMainContentEl,
        },
        onProgress: (done, total, label) => setProgress({ done, total, label }),
        shouldCancel: () => cancelRef.current,
      });
      if (result.cancelled) {
        // 사용자 취소 — 파일 저장 안 함, 조용히 닫음
      }
    } catch (e) {
      console.error(e);
      if (!cancelRef.current) alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      const meta = REPORT_SUBS.find(s => s.id === originalSub);
      if (meta) {
        setActiveTab?.(meta.tab);
        setActiveSub(meta.id);
        setPageLabel?.(meta.label);
      }
      setMode("closed");
      cancelRef.current = false;
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allIds = REPORT_SUBS.map(s => s.id);

  return (
    <>
      <button
        ref={btnRef}
        data-no-export="true"
        onClick={() => setMode(mode === "closed" ? "menu" : "closed")}
        title="다운로드"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", height: 30,
          background: "var(--bg-card, #fff)",
          border: "1px solid var(--border, #E0E0E0)",
          borderRadius: 6, fontSize: 12, fontWeight: 600,
          color: "var(--text-primary, #2C2C2C)",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        다운로드
      </button>

      {mode === "menu" && (
        <div
          className="download-menu-panel"
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4,
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border, #E0E0E0)",
            borderRadius: 8, padding: 6, minWidth: 220,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 10, color: "#999", padding: "4px 10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>PDF</div>
          <MenuItem onClick={handleCurrentPdf}>현재 페이지 PDF</MenuItem>
          <MenuItem onClick={() => runMultiPdf(allIds)}>전체 페이지 PDF ({allIds.length})</MenuItem>
          <MenuItem onClick={() => setMode("selectPages")}>페이지 선택 PDF…</MenuItem>
          <div style={{ height: 1, background: "var(--border, #E0E0E0)", margin: "6px 0" }} />
          <div style={{ fontSize: 10, color: "#999", padding: "4px 10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>Excel</div>
          <MenuItem onClick={handleCurrentXlsx}>현재 페이지 테이블 Excel</MenuItem>
        </div>
      )}

      {mode === "selectPages" && (
        <div
          className="download-menu-panel"
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4,
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border, #E0E0E0)",
            borderRadius: 8, padding: 12, width: 300,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #2C2C2C)" }}>PDF에 포함할 페이지</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setSelected(new Set(allIds))}
                style={smallBtn}
              >전체</button>
              <button
                onClick={() => setSelected(new Set())}
                style={smallBtn}
              >해제</button>
            </div>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", borderTop: "1px solid var(--border, #E0E0E0)", paddingTop: 8 }}>
            {REPORT_SUBS.map(s => (
              <label
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 4px", fontSize: 12, cursor: "pointer",
                  color: "var(--text-primary, #2C2C2C)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleSelected(s.id)}
                  style={{ cursor: "pointer" }}
                />
                {s.label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
            <button onClick={() => setMode("menu")} style={cancelBtnStyle}>취소</button>
            <button
              onClick={() => {
                const ids = REPORT_SUBS.filter(s => selected.has(s.id)).map(s => s.id);
                runMultiPdf(ids);
              }}
              disabled={selected.size === 0}
              style={{ ...primaryBtnStyle, opacity: selected.size === 0 ? 0.5 : 1 }}
            >
              {selected.size}개 PDF 생성
            </button>
          </div>
        </div>
      )}

      {mode === "progress" && (
        <div
          data-no-export="true"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            data-no-export="true"
            style={{
              position: "relative",
              background: "var(--bg-card, #fff)", padding: "20px 28px 24px",
              borderRadius: 10, minWidth: 360,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              color: "var(--text-primary, #2C2C2C)",
            }}
          >
            <button
              data-no-export="true"
              onClick={handleCancel}
              title="취소"
              style={{
                position: "absolute", top: 10, right: 10,
                width: 28, height: 28, borderRadius: 6,
                background: "transparent", border: "none",
                color: "#888", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, paddingRight: 24 }}>
              {cancelRef.current ? "취소 중…" : "PDF 생성 중…"}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
              {progress.done}/{progress.total} · {progress.label}
            </div>
            <div style={{ height: 6, background: "#EEE", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                  background: "#E87722", transition: "width 0.3s",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 10 }}>
              중단하려면 우측 상단 X를 누르세요.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "8px 10px", background: "transparent", border: "none",
        borderRadius: 4, fontSize: 12.5, fontWeight: 500,
        color: "var(--text-primary, #2C2C2C)",
        cursor: "pointer", fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,119,34,0.08)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

const smallBtn: React.CSSProperties = {
  padding: "3px 8px", fontSize: 10.5, fontWeight: 600,
  background: "transparent", border: "1px solid var(--border, #E0E0E0)",
  borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
  color: "var(--text-primary, #2C2C2C)",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "5px 12px", fontSize: 12, fontWeight: 600,
  background: "transparent", border: "1px solid var(--border, #E0E0E0)",
  borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
  color: "var(--text-primary, #2C2C2C)",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "5px 12px", fontSize: 12, fontWeight: 700,
  background: "#E87722", border: "none", color: "#fff",
  borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
};
