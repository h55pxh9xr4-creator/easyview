"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

// ── 픽셀 아트 회계사 (전신 · 메이플 치비 스타일) ──────────────
function AccountantPixel() {
  return (
    <svg
      width="54" height="99" viewBox="0 0 18 33"
      shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(1px 3px 5px rgba(0,0,0,0.35))" }}
    >
      {/* ── 머리카락 ── */}
      <rect x="4"  y="0" width="10" height="1" fill="#3D2008"/>
      <rect x="3"  y="1" width="12" height="1" fill="#3D2008"/>
      <rect x="3"  y="2" width="1"  height="6" fill="#3D2008"/>
      <rect x="14" y="2" width="1"  height="6" fill="#3D2008"/>
      {/* 옆머리 볼륨 */}
      <rect x="3"  y="8" width="2"  height="1" fill="#3D2008"/>
      <rect x="13" y="8" width="2"  height="1" fill="#3D2008"/>

      {/* ── 얼굴 ── */}
      <rect x="4"  y="1" width="10" height="9" fill="#FFD5A8"/>

      {/* 귀 */}
      <rect x="3"  y="4" width="1"  height="3" fill="#FFC090"/>
      <rect x="14" y="4" width="1"  height="3" fill="#FFC090"/>

      {/* 왼쪽 안경 프레임 */}
      <rect x="4"  y="2" width="4"  height="4" fill="#222"/>
      <rect x="5"  y="3" width="2"  height="2" fill="#7EC8F0"/>
      <rect x="5"  y="3" width="1"  height="1" fill="#C4E8FF"/>

      {/* 오른쪽 안경 프레임 */}
      <rect x="10" y="2" width="4"  height="4" fill="#222"/>
      <rect x="11" y="3" width="2"  height="2" fill="#7EC8F0"/>
      <rect x="11" y="3" width="1"  height="1" fill="#C4E8FF"/>

      {/* 안경 브릿지 */}
      <rect x="8"  y="4" width="2"  height="1" fill="#222"/>

      {/* 코 */}
      <rect x="8"  y="7" width="2"  height="1" fill="#D9845A"/>

      {/* 볼터치 */}
      <rect x="4"  y="6" width="2"  height="1" fill="#FFB0C0" opacity="0.8"/>
      <rect x="12" y="6" width="2"  height="1" fill="#FFB0C0" opacity="0.8"/>

      {/* 미소 */}
      <rect x="6"  y="7" width="1"  height="1" fill="#CC3030"/>
      <rect x="7"  y="8" width="4"  height="1" fill="#CC3030"/>
      <rect x="11" y="7" width="1"  height="1" fill="#CC3030"/>

      {/* ── 목 ── */}
      <rect x="7"  y="10" width="4" height="2" fill="#FFD5A8"/>

      {/* ── 상체 (재킷) ── */}
      <rect x="2"  y="12" width="14" height="9" fill="#1E2D40"/>

      {/* 왼팔 */}
      <rect x="0"  y="12" width="2"  height="8" fill="#1E2D40"/>
      {/* 오른팔 */}
      <rect x="16" y="12" width="2"  height="8" fill="#1E2D40"/>

      {/* 왼손 */}
      <rect x="0"  y="20" width="2"  height="2" fill="#FFD5A8"/>
      {/* 오른손 */}
      <rect x="16" y="20" width="2"  height="2" fill="#FFD5A8"/>

      {/* 흰 셔츠 */}
      <rect x="6"  y="12" width="6"  height="9" fill="#F0F0F0"/>

      {/* 왼쪽 라펠 */}
      <rect x="6"  y="13" width="2"  height="1" fill="#1E2D40"/>
      <rect x="6"  y="14" width="1"  height="7" fill="#1E2D40"/>

      {/* 오른쪽 라펠 */}
      <rect x="10" y="13" width="2"  height="1" fill="#1E2D40"/>
      <rect x="11" y="14" width="1"  height="7" fill="#1E2D40"/>

      {/* 넥타이 */}
      <rect x="8"  y="12" width="2"  height="9" fill="#E87722"/>
      {/* 넥타이 매듭 */}
      <rect x="8"  y="12" width="2"  height="1" fill="#FF9944"/>

      {/* 포켓 스퀘어 */}
      <rect x="3"  y="13" width="2"  height="1" fill="#E87722"/>
      <rect x="4"  y="14" width="1"  height="1" fill="#E87722"/>

      {/* ── 허리띠 ── */}
      <rect x="4"  y="21" width="10" height="1" fill="#111"/>
      <rect x="8"  y="21" width="2"  height="1" fill="#888"/>

      {/* ── 바지 ── */}
      {/* 왼다리 */}
      <rect x="4"  y="22" width="4"  height="5" fill="#1E3A5F"/>
      {/* 오른다리 */}
      <rect x="10" y="22" width="4"  height="5" fill="#1E3A5F"/>
      {/* 가랑이 그림자 */}
      <rect x="8"  y="22" width="2"  height="4" fill="#0D1F33"/>

      {/* ── 구두 ── */}
      {/* 왼쪽 구두 */}
      <rect x="3"  y="27" width="6"  height="3" fill="#111"/>
      <rect x="3"  y="27" width="4"  height="1" fill="#2A2A2A"/>
      <rect x="3"  y="29" width="5"  height="1" fill="#080808"/>
      {/* 오른쪽 구두 */}
      <rect x="9"  y="27" width="6"  height="3" fill="#111"/>
      <rect x="9"  y="27" width="4"  height="1" fill="#2A2A2A"/>
      <rect x="10" y="29" width="5"  height="1" fill="#080808"/>

      {/* 구두 굽 */}
      <rect x="4"  y="30" width="4"  height="1" fill="#080808"/>
      <rect x="10" y="30" width="4"  height="1" fill="#080808"/>
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
          <AccountantPixel />
        </button>
      </div>
    </>
  );
}
