"use client";

import { useEffect, useState } from "react";
import { fetchFaqs, fetchFaq, submitFaqFeedback, type FaqItem, type FaqCategory } from "@/lib/api";
import { useDarkMode } from "@/hooks/useDarkMode";

// Action handler 실행기 (ChatBot.tsx와 동일 로직)
function executeHandler(handler: string) {
  try {
    const themeMatch = handler.match(/applyTheme\(['"](dark|light)['"]\)/);
    if (themeMatch) {
      const theme = themeMatch[1];
      localStorage.setItem("ev_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      return;
    }
    if (handler === "scrollToTop()") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch {}
}

function navigateTo(route: string) {
  if (route.includes("?")) {
    window.location.hash = route.split("?")[1];
  } else {
    window.location.href = route;
  }
}

export default function FaqPanel() {
  const isDark = useDarkMode();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // 다크모드 색상
  const bgCard = isDark ? "#1C1F26" : "#fff";
  const bdr = isDark ? "#2E3039" : "#E8E8E8";
  const txt = isDark ? "#E2E5EC" : "#2C2C2C";
  const txtSec = isDark ? "#9198A8" : "#666";
  const txtDim = isDark ? "#5A6070" : "#999";
  const accent = "#E87722";

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCat]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFaqs(selectedCat || undefined, search || undefined);
      setFaqs(res.faqs);
      setCategories(res.categories);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (faqId: number) => {
    if (openId === faqId) {
      setOpenId(null);
    } else {
      setOpenId(faqId);
      // 조회수 증가 트리거
      try { await fetchFaq(faqId); } catch {}
    }
  };

  const handleFeedback = async (faqId: number, helpful: boolean) => {
    if (feedbackGiven.has(faqId)) return;
    try {
      await submitFaqFeedback(faqId, helpful);
      setFeedbackGiven(prev => new Set(prev).add(faqId));
      // 로컬 카운트 업데이트
      setFaqs(prev => prev.map(f => {
        if (f.id !== faqId) return f;
        return {
          ...f,
          helpful_count: helpful ? f.helpful_count + 1 : f.helpful_count,
          not_helpful_count: helpful ? f.not_helpful_count : f.not_helpful_count + 1,
        };
      }));
    } catch {}
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: txt, margin: 0, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E87722" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          자주 묻는 질문
        </h2>
        <p style={{ fontSize: 13, color: txtSec, margin: 0 }}>
          궁금한 점을 카테고리별로 빠르게 찾아보세요. 없는 내용은 김삼일 매니저에게 물어봐도 좋아요!
        </p>
      </div>

      {/* 검색 + 카테고리 필터 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={txtDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            placeholder="검색어 입력 후 Enter…"
            style={{
              width: "100%", padding: "9px 14px 9px 36px", borderRadius: 8,
              border: `1px solid ${bdr}`, background: bgCard, color: txt,
              fontSize: 13, fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        <button
          onClick={load}
          style={{
            padding: "9px 18px", background: accent, color: "#fff", border: "none",
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          검색
        </button>
      </div>

      {/* 카테고리 칩 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setSelectedCat("")}
          style={chipStyle(selectedCat === "", isDark)}>
          전체 ({categories.reduce((s, c) => s + c.count, 0)})
        </button>
        {categories.map(c => (
          <button key={c.name} onClick={() => setSelectedCat(c.name)}
            style={chipStyle(selectedCat === c.name, isDark)}>
            {c.name} ({c.count})
          </button>
        ))}
      </div>

      {/* FAQ 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: txtDim, fontSize: 13 }}>로딩 중...</div>
      ) : faqs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: txtDim, fontSize: 13 }}>
          조건에 맞는 FAQ가 없어요. 김삼일 매니저에게 직접 물어보세요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {faqs.map(f => {
            const isOpen = openId === f.id;
            const gaveFeedback = feedbackGiven.has(f.id);
            return (
              <div key={f.id}
                style={{
                  background: bgCard, border: `1px solid ${isOpen ? accent : bdr}`,
                  borderRadius: 10, overflow: "hidden",
                  boxShadow: isOpen ? "0 4px 16px rgba(232,119,34,.12)" : "none",
                  transition: "all .2s",
                }}
              >
                <button onClick={() => handleToggle(f.id)}
                  style={{
                    width: "100%", padding: "14px 18px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: accent, background: "#FFF3E8",
                    padding: "3px 8px", borderRadius: 10, flexShrink: 0,
                  }}>{f.category}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: txt }}>
                    {f.question}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={txtDim}
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                       style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${bdr}` }}>
                    <div style={{
                      fontSize: 13, color: txt, lineHeight: 1.7, whiteSpace: "pre-wrap",
                      padding: "14px 0",
                    }}>
                      {f.answer}
                    </div>
                    {/* Actions (navigate/execute) */}
                    {(f.action_route || f.action_handler) && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {f.action_route && (
                          <button onClick={() => navigateTo(f.action_route!)}
                            className="chatbot-action-btn">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                            </svg>
                            <span>바로가기</span>
                          </button>
                        )}
                        {f.action_handler && (
                          <button onClick={() => executeHandler(f.action_handler!)}
                            className="chatbot-action-btn chatbot-action-execute">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                            </svg>
                            <span>지금 실행</span>
                          </button>
                        )}
                      </div>
                    )}
                    {/* 피드백 */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      marginTop: 16, paddingTop: 12, borderTop: `1px solid ${bdr}`,
                      fontSize: 11, color: txtDim,
                    }}>
                      {gaveFeedback ? (
                        <span style={{ color: "#22C55E" }}>피드백 감사합니다.</span>
                      ) : (
                        <>
                          <span>이 답변이 도움 됐나요?</span>
                          <button onClick={() => handleFeedback(f.id, true)} style={feedbackBtn(isDark, true)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "-2px" }}>
                              <path d="M7 10v12"/>
                              <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l5-8h1a2 2 0 0 1 2 2v1.88z"/>
                            </svg>
                            예 ({f.helpful_count})
                          </button>
                          <button onClick={() => handleFeedback(f.id, false)} style={feedbackBtn(isDark, false)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "-2px" }}>
                              <path d="M17 14V2"/>
                              <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-5 8h-1a2 2 0 0 1-2-2v-1.88z"/>
                            </svg>
                            아니오 ({f.not_helpful_count})
                          </button>
                        </>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 10 }}>조회 {f.view_count}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function chipStyle(active: boolean, isDark: boolean): React.CSSProperties {
  return {
    padding: "6px 14px", background: active ? "#E87722" : (isDark ? "#252830" : "#fff"),
    color: active ? "#fff" : (isDark ? "#9198A8" : "#666"),
    border: `1px solid ${active ? "#E87722" : (isDark ? "#2E3039" : "#E0E0E0")}`,
    borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", transition: "all .15s",
  };
}

function feedbackBtn(isDark: boolean, isThumbsUp: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", background: isDark ? "#252830" : "#fff",
    color: isDark ? "#9198A8" : "#666",
    border: `1px solid ${isDark ? "#2E3039" : "#E0E0E0"}`,
    borderRadius: 12, fontSize: 11, cursor: "pointer",
    fontFamily: "inherit", transition: "all .15s",
  };
}
