"use client";

import { useState, useRef, useEffect } from "react";

const SAMILKIM_IMG = "data:image/png;base64,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";

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
          <img src={SAMILKIM_IMG} alt="김삼일" style={{ width: 64, height: 64, objectFit: "contain" }} />
        </button>
      </div>
    </>
  );
}
