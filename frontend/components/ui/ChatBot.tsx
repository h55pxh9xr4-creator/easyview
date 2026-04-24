"use client";

import { useState, useRef, useEffect } from "react";
import SAMILKIM_IMG from "@/lib/samilkimImg";
import { sendChatMessageStream, fetchChatSessions, fetchChatSession, deleteChatSession, type ChatMessage, type ChatAction, type ChatSessionInfo } from "@/lib/api";
import { useFilter } from "@/hooks/useFilter";
import { useChatAttachment } from "@/hooks/useChatAttachment";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: ChatAction[];      // 🆕 Actions
  suggestions?: string[];       // 🆕 Follow-up suggestions
}

// 부분 JSON 스트림에서 "reply" 필드의 값만 추출 (스트리밍 중 진행형 표시용)
function extractReplyFromPartialJson(raw: string): string {
  // 코드펜스 제거 (```json ... ``` 형태 대응)
  let text = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const keyMatch = text.match(/"reply"\s*:\s*"/);
  if (!keyMatch) {
    // 아직 "reply" 키가 안 나옴 — 빈 문자열로 대기
    // 단, 모델이 JSON이 아닌 평문으로 응답하는 예외 상황은 그대로 노출
    return text.trim().startsWith("{") || text.trim().startsWith("```") ? "" : text;
  }
  const start = keyMatch.index! + keyMatch[0].length;
  let result = "";
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      const next = text[i + 1];
      if (next === undefined) break; // 불완전 이스케이프 — 다음 청크 대기
      if (next === "n") { result += "\n"; i += 2; continue; }
      if (next === "t") { result += "\t"; i += 2; continue; }
      if (next === "r") { result += "\r"; i += 2; continue; }
      if (next === '"') { result += '"'; i += 2; continue; }
      if (next === "\\") { result += "\\"; i += 2; continue; }
      if (next === "/") { result += "/"; i += 2; continue; }
      if (next === "u") {
        if (i + 6 > text.length) break;
        const code = parseInt(text.slice(i + 2, i + 6), 16);
        if (!Number.isNaN(code)) { result += String.fromCharCode(code); i += 6; continue; }
      }
      result += next; i += 2; continue;
    }
    if (ch === '"') break; // reply 값 종료
    result += ch;
    i++;
  }
  return result;
}

// Action handler 실행기 — execute 타입 action의 handler 문자열을 실행
function executeActionHandler(handler: string) {
  try {
    // applyTheme('dark'), applyTheme('light')
    const themeMatch = handler.match(/applyTheme\(['"](dark|light)['"]\)/);
    if (themeMatch) {
      const theme = themeMatch[1];
      localStorage.setItem("ev_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      return;
    }
    // scrollToTop
    if (handler === "scrollToTop()") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // openCommentPanel
    if (handler === "openCommentPanel()") {
      // 현재 페이지에 이미 triggerComment 사용 중이면 외부에서 연결
      return;
    }
  } catch (e) {
    console.warn("Action handler 실행 실패:", handler, e);
  }
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
  const [sessionId, setSessionId] = useState<number | null>(null);  // 🆕 현재 세션
  const [showHistory, setShowHistory] = useState(false);  // 🆕 세션 히스토리 패널
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [streamingText, setStreamingText] = useState("");  // 🆕 스트리밍 중인 텍스트
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

  // 첨부 데이터 (Add to Chat)
  const attachments = useChatAttachment(s => s.attachments);
  const removeAttachment = useChatAttachment(s => s.remove);
  const clearAttachments = useChatAttachment(s => s.clear);
  const shouldOpen = useChatAttachment(s => s.open);
  const markOpened = useChatAttachment(s => s.markOpened);

  // 첨부 추가 시 챗봇 자동 열기
  useEffect(() => {
    if (shouldOpen) {
      setOpen(true);
      markOpened();
    }
  }, [shouldOpen, markOpened]);

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreamingText("");

    const history: ChatMessage[] = messages.slice(-10).map(m => ({
      role: m.role,
      text: m.text,
    }));

    let accumulated = "";
    try {
      await sendChatMessageStream({
        message: text,
        base_ym: filter.baseYm,
        period_type: filter.periodType,
        page: currentPage,
        history,
        session_id: sessionId ?? undefined,
        user_name: typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? undefined) : undefined,
        amount_unit: filter.amountUnit,
        currency: filter.currency,
        attachments: attachments.map(a => ({ label: a.label, summary: a.summary, source: a.source })),
      }, {
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreamingText(extractReplyFromPartialJson(accumulated));
        },
        onDone: (final) => {
          // 최종 파싱된 응답으로 대체 (JSON 코드블록 정리된 상태)
          setMessages(prev => [...prev, {
            id: Date.now(),
            role: "assistant",
            text: final.reply,
            actions: final.actions,
            suggestions: final.suggestions,
          }]);
          if (final.session_id) setSessionId(final.session_id);
          clearAttachments();
          setStreamingText("");
        },
        onError: (err) => {
          setMessages(prev => [...prev, {
            id: Date.now(), role: "assistant",
            text: `죄송합니다. 오류가 발생했습니다: ${err}`,
          }]);
          setStreamingText("");
        },
      });
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now(), role: "assistant",
        text: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      }]);
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  // 새 대화 시작
  const startNewSession = () => {
    setMessages([]);
    setSessionId(null);
    setShowHistory(false);
    setShowSuggestions(false);
  };

  // 세션 히스토리 토글 + 목록 로드
  const toggleHistory = async () => {
    if (!showHistory) {
      try {
        const userName = typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? undefined) : undefined;
        const res = await fetchChatSessions(userName);
        setSessions(res.sessions);
      } catch { setSessions([]); }
    }
    setShowHistory(p => !p);
  };

  // 세션 로드
  const loadSession = async (sid: number) => {
    try {
      const res = await fetchChatSession(sid);
      const msgs: Message[] = res.messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          text: m.content,
          actions: m.actions,
          suggestions: m.suggestions,
        }));
      setMessages(msgs);
      setSessionId(sid);
      setShowHistory(false);
    } catch { /* ignore */ }
  };

  const deleteSession = async (sid: number) => {
    try {
      await deleteChatSession(sid);
      setSessions(prev => prev.filter(s => s.id !== sid));
      if (sid === sessionId) startNewSession();
    } catch { /* ignore */ }
  };

  // Action 클릭 핸들러
  const handleActionClick = (action: ChatAction) => {
    if (action.type === "navigate" && action.route) {
      // /easyview/?page=... 형태 → hash 방식으로 변환
      const url = action.route;
      if (url.includes("?")) {
        const qs = url.split("?")[1];
        window.location.hash = qs;
      } else {
        window.location.href = url;
      }
    } else if (action.type === "execute" && action.handler) {
      executeActionHandler(action.handler);
    } else if (action.type === "quick_reply") {
      // 바로 메시지로 전송
      setInput(action.label);
      setTimeout(() => handleSend(), 50);
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
  const attachmentSuggestions = attachments.length > 0
    ? ["이 데이터에 대해 분석해줘", "전기/전년 대비 어떻게 변했어?", "이상 징후가 있나?", "개선 방안을 제안해줘"]
    : null;
  const currentSuggestions = attachmentSuggestions ?? SUGGESTIONS[currentPage] ?? defaultSuggestions;

  const handleSuggestionClick = (question: string) => {
    setShowSuggestions(false);
    sendMessage(question);
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
              <span className="chatbot-title" style={{ fontWeight: 700, fontSize: 14 }}>김삼일 매니저</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button className="chatbot-header-btn" onClick={toggleHistory} title="대화 내역">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
              {messages.length > 0 && (
                <button className="chatbot-header-btn" onClick={startNewSession} title="새 대화 시작">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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

          {showHistory && (
            <div className="chatbot-history">
              <div className="chatbot-history-header">
                <span>최근 대화</span>
                <button className="chatbot-header-btn" onClick={() => setShowHistory(false)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {sessions.length === 0 ? (
                <div className="chatbot-history-empty">저장된 대화가 없어요.</div>
              ) : (
                <div className="chatbot-history-list">
                  {sessions.map(s => (
                    <div key={s.id} className={`chatbot-history-item ${s.id === sessionId ? "active" : ""}`}>
                      <button className="chatbot-history-item-main" onClick={() => loadSession(s.id)}>
                        <div className="chatbot-history-title">{s.title || "(제목 없음)"}</div>
                        <div className="chatbot-history-meta">
                          💬 {s.message_count} · {s.last_active_at?.slice(5, 16).replace("T", " ")}
                        </div>
                      </button>
                      <button className="chatbot-history-delete" onClick={() => deleteSession(s.id)} title="삭제">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="chatbot-empty">
                <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="logo" style={{ height: 36, objectFit: "contain", marginBottom: 12, opacity: 0.25 }} />
                <p>안녕하세요! 궁금한 점을<br />자유롭게 질문해주세요.</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id}>
                <div className={`chatbot-msg chatbot-msg-${m.role}`}>
                  <div className="chatbot-msg-bubble" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
                {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                  <div className="chatbot-actions">
                    {m.actions.map((a, i) => (
                      <button
                        key={i}
                        className={`chatbot-action-btn chatbot-action-${a.type}`}
                        onClick={() => handleActionClick(a)}
                      >
                        {a.type === "navigate" && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        )}
                        {a.type === "execute" && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                          </svg>
                        )}
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && m.suggestions && m.suggestions.length > 0 && (
                  <div className="chatbot-followup">
                    <div className="chatbot-followup-label">이어서 물어보기</div>
                    <div className="chatbot-followup-list">
                      {m.suggestions.map((s, i) => (
                        <button
                          key={i}
                          className="chatbot-followup-btn"
                          onClick={() => handleSuggestionClick(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && streamingText ? (
              <div className="chatbot-msg chatbot-msg-assistant">
                <div className="chatbot-msg-bubble" style={{ whiteSpace: "pre-wrap" }}>
                  {streamingText}
                  <span className="chatbot-stream-cursor" />
                </div>
              </div>
            ) : loading ? (
              <div className="chatbot-msg chatbot-msg-assistant">
                <div className="chatbot-msg-bubble chatbot-typing">
                  <span className="chatbot-dot" /><span className="chatbot-dot" /><span className="chatbot-dot" />
                </div>
              </div>
            ) : null}
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

          {attachments.length > 0 && (
            <div className="chatbot-attachments">
              {attachments.map(a => (
                <div key={a.id} className="chatbot-attachment-chip" title={a.source}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                  <span className="chatbot-attachment-label">{a.label}</span>
                  <button className="chatbot-attachment-remove" onClick={() => removeAttachment(a.id)} aria-label="제거">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="chatbot-input-area">
            <button className={`chatbot-suggest-toggle${showSuggestions ? " active" : ""}`} onClick={() => setShowSuggestions(prev => !prev)}>
              <span className="chatbot-tooltip">추천 질문</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                <path d="M9 18h6"/>
                <path d="M10 22h4"/>
                <path d="M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2z"/>
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
