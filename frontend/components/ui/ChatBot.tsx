"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

// ── 픽셀 아트 회계사 (상반신) ──────────────────────────────────
function AccountantPixel() {
  return (
    <svg width="36" height="40" viewBox="0 0 14 18" shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(1px 3px 4px rgba(0,0,0,0.25))" }}>
      {/* Hair */}
      <rect x="2" y="0" width="10" height="1" fill="#3D2008"/>
      <rect x="1" y="1" width="12" height="2" fill="#3D2008"/>
      <rect x="1" y="3" width="1"  height="5" fill="#3D2008"/>
      <rect x="12" y="3" width="1" height="5" fill="#3D2008"/>
      {/* Face */}
      <rect x="2" y="2" width="10" height="8" fill="#FFD5A8"/>
      {/* Ears */}
      <rect x="1" y="5" width="1"  height="2" fill="#FFC090"/>
      <rect x="12" y="5" width="1" height="2" fill="#FFC090"/>
      {/* Left glasses */}
      <rect x="2" y="3" width="4"  height="4" fill="#1A1A1A"/>
      <rect x="3" y="4" width="2"  height="2" fill="#7EC8F0"/>
      <rect x="3" y="4" width="1"  height="1" fill="#C4E8FF"/>
      {/* Right glasses */}
      <rect x="8" y="3" width="4"  height="4" fill="#1A1A1A"/>
      <rect x="9" y="4" width="2"  height="2" fill="#7EC8F0"/>
      <rect x="9" y="4" width="1"  height="1" fill="#C4E8FF"/>
      {/* Bridge */}
      <rect x="6" y="5" width="2"  height="1" fill="#1A1A1A"/>
      {/* Nose */}
      <rect x="6" y="8" width="2"  height="1" fill="#E09070"/>
      {/* Cheeks */}
      <rect x="2" y="7" width="2"  height="1" fill="#FFB0C0" opacity="0.75"/>
      <rect x="10" y="7" width="2" height="1" fill="#FFB0C0" opacity="0.75"/>
      {/* Smile */}
      <rect x="4" y="8" width="1"  height="1" fill="#CC4040"/>
      <rect x="5" y="9" width="4"  height="1" fill="#CC4040"/>
      <rect x="9" y="8" width="1"  height="1" fill="#CC4040"/>
      {/* Neck */}
      <rect x="5" y="10" width="4" height="1" fill="#FFD5A8"/>
      {/* Jacket */}
      <rect x="0" y="11" width="14" height="7" fill="#1E2D40"/>
      {/* White shirt */}
      <rect x="4" y="11" width="6"  height="7" fill="#F0F0F0"/>
      {/* Left lapel */}
      <rect x="4" y="13" width="1"  height="5" fill="#1E2D40"/>
      <rect x="4" y="12" width="2"  height="1" fill="#1E2D40"/>
      {/* Right lapel */}
      <rect x="9" y="13" width="1"  height="5" fill="#1E2D40"/>
      <rect x="8" y="12" width="2"  height="1" fill="#1E2D40"/>
      {/* Tie */}
      <rect x="6" y="11" width="2"  height="7" fill="#E87722"/>
      <rect x="6" y="11" width="2"  height="1" fill="#FF9944"/>
      {/* Pocket square */}
      <rect x="1" y="12" width="2"  height="1" fill="#E87722"/>
      <rect x="2" y="13" width="1"  height="1" fill="#E87722"/>
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
