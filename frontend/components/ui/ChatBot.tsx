"use client";

import { useState, useRef, useEffect } from "react";


interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

// ── 픽셀 아트 회계사 (전신 · 밝고 귀여운 치비 스타일) ──────────
function AccountantPixel() {
  return (
    <svg
      width="40" height="65" viewBox="0 0 16 26"
      shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(1px 3px 4px rgba(0,0,0,0.22))" }}
    >
      {/* ── 머리카락 (따뜻한 밤색) ── */}
      <rect x="3"  y="0" width="10" height="1" fill="#7B4520"/>
      <rect x="2"  y="1" width="12" height="1" fill="#7B4520"/>
      <rect x="2"  y="2" width="1"  height="5" fill="#7B4520"/>
      <rect x="13" y="2" width="1"  height="5" fill="#7B4520"/>

      {/* ── 얼굴 (밝은 복숭아) ── */}
      <rect x="3"  y="1" width="10" height="8" fill="#FFCFA0"/>

      {/* 귀 */}
      <rect x="2"  y="4" width="1"  height="2" fill="#FFB888"/>
      <rect x="13" y="4" width="1"  height="2" fill="#FFB888"/>

      {/* 왼쪽 둥근 안경 (하늘색 프레임) */}
      <rect x="4"  y="2" width="1"  height="1" fill="#5599CC"/>
      <rect x="5"  y="2" width="2"  height="1" fill="#5599CC"/>
      <rect x="6"  y="2" width="1"  height="1" fill="#5599CC"/>
      <rect x="3"  y="3" width="1"  height="2" fill="#5599CC"/>
      <rect x="7"  y="3" width="1"  height="2" fill="#5599CC"/>
      <rect x="4"  y="5" width="1"  height="1" fill="#5599CC"/>
      <rect x="5"  y="5" width="2"  height="1" fill="#5599CC"/>
      <rect x="6"  y="5" width="1"  height="1" fill="#5599CC"/>
      {/* 왼쪽 렌즈 */}
      <rect x="4"  y="3" width="3"  height="2" fill="#C8EEFF"/>
      <rect x="4"  y="3" width="1"  height="1" fill="#E8F8FF"/>

      {/* 오른쪽 둥근 안경 */}
      <rect x="9"  y="2" width="1"  height="1" fill="#5599CC"/>
      <rect x="10" y="2" width="2"  height="1" fill="#5599CC"/>
      <rect x="11" y="2" width="1"  height="1" fill="#5599CC"/>
      <rect x="8"  y="3" width="1"  height="2" fill="#5599CC"/>
      <rect x="12" y="3" width="1"  height="2" fill="#5599CC"/>
      <rect x="9"  y="5" width="1"  height="1" fill="#5599CC"/>
      <rect x="10" y="5" width="2"  height="1" fill="#5599CC"/>
      <rect x="11" y="5" width="1"  height="1" fill="#5599CC"/>
      {/* 오른쪽 렌즈 */}
      <rect x="9"  y="3" width="3"  height="2" fill="#C8EEFF"/>
      <rect x="9"  y="3" width="1"  height="1" fill="#E8F8FF"/>

      {/* 브릿지 */}
      <rect x="7"  y="4" width="2"  height="1" fill="#5599CC"/>

      {/* 코 */}
      <rect x="7"  y="6" width="2"  height="1" fill="#D9885A"/>

      {/* 큼직한 볼터치 */}
      <rect x="3"  y="5" width="2"  height="2" fill="#FF9999" opacity="0.65"/>
      <rect x="11" y="5" width="2"  height="2" fill="#FF9999" opacity="0.65"/>

      {/* 웃음 */}
      <rect x="5"  y="7" width="1"  height="1" fill="#CC3333"/>
      <rect x="6"  y="8" width="4"  height="1" fill="#CC3333"/>
      <rect x="10" y="7" width="1"  height="1" fill="#CC3333"/>

      {/* ── 목 ── */}
      <rect x="6"  y="9" width="4"  height="2" fill="#FFCFA0"/>

      {/* ── 재킷 (밝은 네이비) ── */}
      <rect x="1"  y="11" width="14" height="7" fill="#2E5C8A"/>
      <rect x="0"  y="11" width="1"  height="6" fill="#2E5C8A"/>
      <rect x="15" y="11" width="1"  height="6" fill="#2E5C8A"/>

      {/* 손 */}
      <rect x="0"  y="17" width="1"  height="2" fill="#FFCFA0"/>
      <rect x="15" y="17" width="1"  height="2" fill="#FFCFA0"/>

      {/* 흰 셔츠 */}
      <rect x="5"  y="11" width="6"  height="7" fill="#F8F8F8"/>

      {/* 왼쪽 라펠 */}
      <rect x="5"  y="12" width="2"  height="1" fill="#2E5C8A"/>
      <rect x="5"  y="13" width="1"  height="5" fill="#2E5C8A"/>

      {/* 오른쪽 라펠 */}
      <rect x="9"  y="12" width="2"  height="1" fill="#2E5C8A"/>
      <rect x="10" y="13" width="1"  height="5" fill="#2E5C8A"/>

      {/* 넥타이 */}
      <rect x="7"  y="11" width="2"  height="7" fill="#E87722"/>
      <rect x="7"  y="11" width="2"  height="1" fill="#FFAA44"/>

      {/* 포켓 스퀘어 */}
      <rect x="2"  y="12" width="2"  height="1" fill="#FFAA44"/>

      {/* ── 벨트 ── */}
      <rect x="3"  y="18" width="10" height="1" fill="#555"/>
      <rect x="7"  y="18" width="2"  height="1" fill="#AAA"/>

      {/* ── 바지 (중간 블루) ── */}
      <rect x="3"  y="19" width="4"  height="3" fill="#2A4F82"/>
      <rect x="9"  y="19" width="4"  height="3" fill="#2A4F82"/>
      <rect x="7"  y="19" width="2"  height="2" fill="#1A3255"/>

      {/* ── 구두 (짙은 회색, 너무 검지 않게) ── */}
      <rect x="2"  y="22" width="5"  height="2" fill="#444"/>
      <rect x="9"  y="22" width="5"  height="2" fill="#444"/>
      <rect x="2"  y="23" width="4"  height="1" fill="#333"/>
      <rect x="10" y="23" width="4"  height="1" fill="#333"/>
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
          title="AI 어시스턴트"
        >
          <img src="/samilkim_nobg.png" alt="김삼일" style={{ width: 64, height: 64, objectFit: "contain" }} />
        </button>
      </div>
    </>
  );
}
