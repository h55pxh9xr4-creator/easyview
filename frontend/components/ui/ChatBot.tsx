"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

// ── 픽셀 아트 회계사 (전신 · 흰 셔츠 + 바지 + 구두) ──────────
function AccountantPixel() {
  return (
    <svg
      width="54" height="90" viewBox="0 0 18 30"
      shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(1px 3px 5px rgba(0,0,0,0.25))" }}
    >
      {/* ── 머리카락 ── */}
      <rect x="4"  y="0" width="10" height="1" fill="#5C3317"/>
      <rect x="3"  y="1" width="12" height="1" fill="#5C3317"/>
      <rect x="3"  y="2" width="1"  height="6" fill="#5C3317"/>
      <rect x="14" y="2" width="1"  height="6" fill="#5C3317"/>
      <rect x="3"  y="7" width="2"  height="1" fill="#5C3317"/>
      <rect x="13" y="7" width="2"  height="1" fill="#5C3317"/>

      {/* ── 얼굴 ── */}
      <rect x="4"  y="1" width="10" height="9" fill="#FFCFA0"/>

      {/* 귀 */}
      <rect x="3"  y="4" width="1"  height="3" fill="#FFB888"/>
      <rect x="14" y="4" width="1"  height="3" fill="#FFB888"/>

      {/* 왼쪽 둥근 안경 */}
      <rect x="5"  y="2" width="3"  height="1" fill="#5599CC"/>
      <rect x="4"  y="3" width="1"  height="3" fill="#5599CC"/>
      <rect x="8"  y="3" width="1"  height="3" fill="#5599CC"/>
      <rect x="5"  y="6" width="3"  height="1" fill="#5599CC"/>
      <rect x="5"  y="3" width="3"  height="3" fill="#C8EEFF"/>
      <rect x="5"  y="3" width="1"  height="1" fill="#E8F8FF"/>

      {/* 오른쪽 둥근 안경 */}
      <rect x="10" y="2" width="3"  height="1" fill="#5599CC"/>
      <rect x="9"  y="3" width="1"  height="3" fill="#5599CC"/>
      <rect x="13" y="3" width="1"  height="3" fill="#5599CC"/>
      <rect x="10" y="6" width="3"  height="1" fill="#5599CC"/>
      <rect x="10" y="3" width="3"  height="3" fill="#C8EEFF"/>
      <rect x="10" y="3" width="1"  height="1" fill="#E8F8FF"/>

      {/* 브릿지 */}
      <rect x="8"  y="5" width="2"  height="1" fill="#5599CC"/>

      {/* 코 */}
      <rect x="8"  y="7" width="2"  height="1" fill="#D9885A"/>

      {/* 볼터치 */}
      <rect x="4"  y="6" width="2"  height="2" fill="#FF9999" opacity="0.6"/>
      <rect x="12" y="6" width="2"  height="2" fill="#FF9999" opacity="0.6"/>

      {/* 웃음 */}
      <rect x="6"  y="8" width="1"  height="1" fill="#CC3333"/>
      <rect x="7"  y="9" width="4"  height="1" fill="#CC3333"/>
      <rect x="11" y="8" width="1"  height="1" fill="#CC3333"/>

      {/* ── 목 ── */}
      <rect x="7"  y="10" width="4" height="2" fill="#FFCFA0"/>

      {/* ── 흰 셔츠 (재킷 없음) ── */}
      <rect x="2"  y="12" width="14" height="8" fill="#F5F5F5"/>

      {/* 팔 */}
      <rect x="0"  y="12" width="2"  height="7" fill="#F0F0F0"/>
      <rect x="16" y="12" width="2"  height="7" fill="#F0F0F0"/>

      {/* 소매 끝단 */}
      <rect x="0"  y="18" width="2"  height="1" fill="#D8D8D8"/>
      <rect x="16" y="18" width="2"  height="1" fill="#D8D8D8"/>

      {/* 손 */}
      <rect x="0"  y="19" width="2"  height="2" fill="#FFCFA0"/>
      <rect x="16" y="19" width="2"  height="2" fill="#FFCFA0"/>

      {/* 셔츠 칼라 (스프레드) */}
      <rect x="7"  y="12" width="4"  height="1" fill="#E0E0E0"/>
      <rect x="6"  y="12" width="2"  height="1" fill="#E8E8E8"/>
      <rect x="10" y="12" width="2"  height="1" fill="#E8E8E8"/>
      <rect x="6"  y="13" width="1"  height="2" fill="#E0E0E0"/>
      <rect x="11" y="13" width="1"  height="2" fill="#E0E0E0"/>

      {/* 단추 */}
      <rect x="8"  y="14" width="2"  height="1" fill="#CCCCCC"/>
      <rect x="8"  y="16" width="2"  height="1" fill="#CCCCCC"/>
      <rect x="8"  y="18" width="2"  height="1" fill="#CCCCCC"/>

      {/* 넥타이 */}
      <rect x="8"  y="12" width="2"  height="8" fill="#E87722"/>
      <rect x="8"  y="12" width="2"  height="1" fill="#FFAA44"/>
      <rect x="9"  y="18" width="1"  height="1" fill="#C85500"/>

      {/* ── 벨트 ── */}
      <rect x="3"  y="20" width="12" height="1" fill="#555"/>
      <rect x="8"  y="20" width="2"  height="1" fill="#AAA"/>

      {/* ── 바지 (미디엄 네이비) ── */}
      <rect x="3"  y="21" width="5"  height="5" fill="#2A4F82"/>
      <rect x="10" y="21" width="5"  height="5" fill="#2A4F82"/>
      <rect x="8"  y="21" width="2"  height="4" fill="#1A3255"/>

      {/* ── 구두 (다크 브라운) ── */}
      <rect x="2"  y="26" width="7"  height="2" fill="#3A2510"/>
      <rect x="9"  y="26" width="7"  height="2" fill="#3A2510"/>
      <rect x="2"  y="26" width="5"  height="1" fill="#5A3D20"/>
      <rect x="9"  y="26" width="5"  height="1" fill="#5A3D20"/>
      <rect x="2"  y="27" width="6"  height="1" fill="#2A1A08"/>
      <rect x="10" y="27" width="6"  height="1" fill="#2A1A08"/>
    </svg>
  );
}

export default function ChatBot() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [
      ...prev,
      { id: Date.now(), role: "user", text },
      { id: Date.now() + 1, role: "assistant", text: "AI 응답 기능은 준비 중입니다." },
    ]);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      {/* ── 채팅 패널 ── */}
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="chatbot-icon-sm">✦</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#2C2C2C" }}>AI 어시스턴트</span>
            </div>
            <button className="chatbot-close" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="chatbot-empty">
                <span className="chatbot-icon-lg">✦</span>
                <p>안녕하세요! 재무 데이터에 대해<br />궁금한 점을 질문해 주세요.</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`chatbot-msg chatbot-msg-${m.role}`}>
                {m.role === "assistant" && <span className="chatbot-msg-avatar">✦</span>}
                <div className="chatbot-msg-bubble">{m.text}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="chatbot-input-area">
            <textarea
              ref={inputRef}
              className="chatbot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="질문을 입력하세요… (Enter로 전송)"
              rows={1}
            />
            <button
              className="chatbot-send"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── 플로팅 버튼 ── */}
      <div className="chatbot-fab-wrap">
        <div className="chatbot-speech">
          안녕하세요?<br/>삼일회계법인 김삼일입니다.
        </div>
        <button
          className="chatbot-fab"
          onClick={() => setOpen(p => !p)}
        >
          <AccountantPixel />
        </button>
      </div>
    </>
  );
}
