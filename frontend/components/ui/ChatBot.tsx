"use client";

import { useState, useRef, useEffect } from "react";
import SAMILKIM_IMG from "@/lib/samilkimImg";
import { sendChatMessage, type ChatMessage } from "@/lib/api";
import { useFilter } from "@/hooks/useFilter";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

interface ChatBotProps {
  activePage?: string;
}

export default function ChatBot({ activePage = "summary" }: ChatBotProps) {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pos, setPos]           = useState<{ x: number; y: number } | null>(null);
  const [grabbed, setGrabbed]       = useState(false);
  const [speechText, setSpeechText] = useState<string | null>(null);
  const [speechForced, setSpeechForced] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const fabRef     = useRef<HTMLDivElement>(null);
  const dragging    = useRef(false);
  const didDrag     = useRef(false);
  const dragOffset  = useRef({ x: 0, y: 0 });
  const pressTime   = useRef(0);
  const pressStart  = useRef({ x: 0, y: 0 });
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 현재 페이지/필터 컨텍스트
  const filter = useFilter();
  const currentPage = activePage;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // 페이지 변경 시 추천 질문 닫기
  useEffect(() => {
    setShowSuggestions(false);
  }, [currentPage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const showHyu = () => {
      setSpeechText("휴..."); setSpeechForced(true);
      speechTimer.current = setTimeout(() => { setSpeechForced(false); setTimeout(() => setSpeechText(null), 250); }, 2000);
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      if (e.buttons === 0) { dragging.current = false; setGrabbed(false); if (didDrag.current) showHyu(); return; }
      if (!didDrag.current) {
        const dx = e.clientX - pressStart.current.x;
        const dy = e.clientY - pressStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < 8) return;
        didDrag.current = true;
        setGrabbed(true);
        setOpen(false);
        setSpeechText("악 놔주세요!"); setSpeechForced(true);
      }
      const w = fabRef.current?.offsetWidth  ?? 88;
      const h = fabRef.current?.offsetHeight ?? 88;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - w, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - h, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false; setGrabbed(false);
      if (didDrag.current) {
        showHyu();
      } else {
        setSpeechText(null); setSpeechForced(false);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const handleFabMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    didDrag.current  = false;
    pressTime.current = Date.now();
    pressStart.current = { x: e.clientX, y: e.clientY };
    if (speechTimer.current) { clearTimeout(speechTimer.current); speechTimer.current = null; }
    setSpeechText(null); setSpeechForced(false);
    const rect = fabRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  const handleFabClick = () => {
    if (didDrag.current) return;
    setOpen(p => !p);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // 대화 기록 구성 (최근 10개)
    const history: ChatMessage[] = messages.slice(-10).map(m => ({
      role: m.role,
      text: m.text,
    }));

    try {
      const res = await sendChatMessage({
        message: text,
        base_ym: filter.baseYm,
        period_type: filter.periodType,
        page: currentPage,
        history,
      });

      setMessages(prev => [
        ...prev,
        { id: Date.now(), role: "assistant", text: res.reply },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: Date.now(), role: "assistant", text: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // 페이지별 추천 질문
  const SUGGESTIONS: Record<string, string[]> = {
    summary:       ["전체 KPI 요약해줘", "전기 대비 주요 변동 사항은?", "이상 전표 있어?"],
    "pl-sum":      ["매출액이 전기 대비 얼마나 변했어?", "영업이익률 분석해줘", "손익 항목별 증감 알려줘"],
    "pl-trend":    ["매출 추이가 어때?", "월별 영업이익 변동 분석해줘"],
    "pl-acct":     ["비용 증가가 큰 계정은?", "관리계정별 증감 분석해줘"],
    "pl-sale":     ["거래처별 매출 순위 알려줘", "매출 급감한 거래처 있어?", "Top 거래처 변동 분석해줘"],
    "pl-item":     ["손익항목별 당기/전기 비교해줘", "매출원가율 어때?"],
    "bs-sum":      ["자산/부채/자본 현황 알려줘", "재무비율 분석해줘", "유동비율이 안전한 수준이야?"],
    "bs-trend":    ["자산 구성 변동 추이 분석해줘", "부채비율 추이는?"],
    "bs-acct":     ["자산 중 증감이 큰 항목은?", "부채 구성 분석해줘"],
    "vch-analysis":["전표 건수 요약해줘", "주요 계정별 전표 현황은?"],
    "sc-dup":      ["중복 전표 현황 알려줘", "중복 금액이 큰 건 뭐야?"],
    "sc-weekend":  ["주말 현금지급 건 있어?", "주말 전표 상세 보여줘"],
    "sc-big-cash": ["고액 현금지급 현황 알려줘", "100만원 이상 현금지급 건수는?"],
    "resource":    ["자료 요청 현황 알려줘", "마감일 임박한 요청 있어?"],
    "inquiry":     ["문의 현황 요약해줘", "답변 대기 중인 문의 있어?"],
  };
  const defaultSuggestions = ["매출액 알려줘", "재무비율 분석해줘", "이상 전표 있어?", "전기 대비 주요 변동은?"];
  const currentSuggestions = SUGGESTIONS[currentPage] ?? defaultSuggestions;

  const handleSuggestionClick = (question: string) => {
    setShowSuggestions(false);
    setInput("");
    const userMsg: Message = { id: Date.now(), role: "user", text: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    sendChatMessage({
      message: question,
      base_ym: filter.baseYm,
      period_type: filter.periodType,
      page: currentPage,
      history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
    }).then(res => {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", text: res.reply }]);
    }).catch(() => {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", text: "죄송합니다. 일시적인 오류가 발생했습니다." }]);
    }).finally(() => setLoading(false));
  };

  const fabStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, bottom: "auto", right: "auto", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center" }
    : {};

  const panelStyle: React.CSSProperties = pos
    ? { bottom: "auto", right: "auto", left: Math.max(0, Math.min(window.innerWidth - 360, pos.x - 136)), top: Math.max(0, pos.y - 510) }
    : {};

  return (
    <>
      {/* ── 채팅 패널 ── */}
      {open && (
        <div className="chatbot-panel" style={panelStyle}>
          <div className="chatbot-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="logo" style={{ width: 24, height: 24, objectFit: "contain" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#2C2C2C" }}>김삼일 매니저</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {messages.length > 0 && (
                <button className="chatbot-header-btn" onClick={() => { setMessages([]); setShowSuggestions(false); }} title="새 대화">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/>
                  </svg>
                </button>
              )}
              <button className="chatbot-close" onClick={() => setOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="chatbot-empty">
                <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="logo" style={{ height: 36, objectFit: "contain", marginBottom: 12, opacity: 0.25 }} />
                <p>안녕하세요! 궁금한 점을<br />자유롭게 질문해주세요.</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`chatbot-msg chatbot-msg-${m.role}`}>

                <div className="chatbot-msg-bubble" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div className="chatbot-msg chatbot-msg-assistant">

                <div className="chatbot-msg-bubble chatbot-typing">
                  <span className="chatbot-dot" /><span className="chatbot-dot" /><span className="chatbot-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {showSuggestions && (
            <div className="chatbot-suggestions-popover">
              {currentSuggestions.map((q, i) => (
                <button key={i} className="chatbot-suggestion-btn" onClick={() => handleSuggestionClick(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="chatbot-input-area">
            <button className={`chatbot-suggest-toggle${showSuggestions ? " active" : ""}`} onClick={() => setShowSuggestions(prev => !prev)}>
              <span className="chatbot-tooltip">추천 질문</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
            <textarea
              ref={inputRef}
              className="chatbot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="질문을 입력하세요… (Enter로 전송)"
              rows={1}
              disabled={loading}
            />
            <button className="chatbot-send" onClick={handleSend} disabled={!input.trim() || loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── 플로팅 버튼 ── */}
      <div
        ref={fabRef}
        className={`chatbot-fab-wrap${grabbed ? " chatbot-fab-grabbed" : ""}${open ? " chatbot-fab-open" : ""}`}
        style={{ ...fabStyle, cursor: grabbed ? "grabbing" : "grab" }}
        onMouseDown={handleFabMouseDown}
      >
        <div className="chatbot-speech" style={speechForced && !open ? { opacity: 1, transform: "translateY(0)", pointerEvents: "auto" } : undefined}>
          {speechText ?? <>안녕하세요?<br/>삼일회계법인 김삼일입니다.</>}
        </div>
        <button className="chatbot-fab" onClick={handleFabClick}>
          <img src={SAMILKIM_IMG} alt="김삼일" style={{ width: 88, height: 88, objectFit: "contain" }} />
        </button>
      </div>
    </>
  );
}
