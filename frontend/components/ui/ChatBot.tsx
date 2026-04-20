"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

// ── 메이플 운영자 모방 (흰 모자·검은 머리·초록눈·흰 유니폼·가방) ──
function AccountantPixel() {
  return (
    <svg width="78" height="126" viewBox="0 0 26 42"
      shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(2px 4px 6px rgba(0,0,0,0.3))" }}>

      {/* ══ 모자 (흰 주름 모자) ══ */}
      <rect x="9"  y="0" width="8"  height="1" fill="#F4F4F4"/>
      <rect x="8"  y="1" width="10" height="3" fill="#F4F4F4"/>
      <rect x="7"  y="4" width="12" height="1" fill="#E2E2E2"/>
      <rect x="6"  y="5" width="14" height="1" fill="#D4D4D4"/>
      {/* W 글자 (파란색) */}
      <rect x="11" y="1" width="1"  height="3" fill="#3344BB"/>
      <rect x="15" y="1" width="1"  height="3" fill="#3344BB"/>
      <rect x="12" y="3" width="1"  height="1" fill="#3344BB"/>
      <rect x="14" y="3" width="1"  height="1" fill="#3344BB"/>
      <rect x="13" y="2" width="1"  height="2" fill="#3344BB"/>

      {/* ══ 머리카락 (진한 자주빛 흑발) ══ */}
      {/* 모자 아래 양 옆 */}
      <rect x="7"  y="3" width="2"  height="3" fill="#1C0F2E"/>
      <rect x="17" y="3" width="2"  height="2" fill="#1C0F2E"/>
      {/* 왼쪽 긴 머리 */}
      <rect x="5"  y="6" width="3"  height="4" fill="#1C0F2E"/>
      <rect x="4"  y="8" width="3"  height="6" fill="#1C0F2E"/>
      <rect x="3"  y="11" width="3" height="8"  fill="#1C0F2E"/>
      <rect x="3"  y="18" width="2" height="8"  fill="#1C0F2E"/>
      <rect x="4"  y="23" width="2" height="5"  fill="#1C0F2E"/>
      {/* 오른쪽 짧은 머리 */}
      <rect x="18" y="5" width="3"  height="8"  fill="#1C0F2E"/>
      <rect x="19" y="11" width="2" height="5"  fill="#1C0F2E"/>

      {/* ══ 얼굴 ══ */}
      <rect x="7"  y="6" width="12" height="14" fill="#FFD5A8"/>
      {/* 귀 */}
      <rect x="6"  y="11" width="1" height="3"  fill="#FFC090"/>
      <rect x="19" y="11" width="1" height="3"  fill="#FFC090"/>
      {/* 귀걸이 */}
      <rect x="6"  y="13" width="1" height="2"  fill="#FFD700"/>

      {/* ══ 눈썹 ══ */}
      <rect x="9"  y="8"  width="4"  height="1" fill="#2A1A0E"/>
      <rect x="14" y="8"  width="4"  height="1" fill="#2A1A0E"/>

      {/* ══ 왼쪽 눈 (초록) ══ */}
      <rect x="9"  y="9"  width="4"  height="1" fill="#0A080F"/>  {/* 위 속눈썹 */}
      <rect x="8"  y="10" width="5"  height="4" fill="#0A080F"/>  {/* 외곽 */}
      <rect x="9"  y="10" width="3"  height="3" fill="#FFFFFF"/>  {/* 흰자 */}
      <rect x="9"  y="10" width="3"  height="3" fill="#38A050"/>  {/* 홍채 */}
      <rect x="9"  y="10" width="2"  height="2" fill="#55CC6A"/>  {/* 밝은 홍채 */}
      <rect x="10" y="11" width="1"  height="1" fill="#0A180A"/>  {/* 동공 */}
      <rect x="9"  y="10" width="1"  height="1" fill="#C0FFD0"/>  {/* 하이라이트 */}
      <rect x="9"  y="13" width="3"  height="1" fill="#0A080F"/>  {/* 아래 속눈썹 */}

      {/* ══ 오른쪽 눈 (초록) ══ */}
      <rect x="14" y="9"  width="4"  height="1" fill="#0A080F"/>
      <rect x="13" y="10" width="5"  height="4" fill="#0A080F"/>
      <rect x="14" y="10" width="3"  height="3" fill="#FFFFFF"/>
      <rect x="14" y="10" width="3"  height="3" fill="#38A050"/>
      <rect x="14" y="10" width="2"  height="2" fill="#55CC6A"/>
      <rect x="15" y="11" width="1"  height="1" fill="#0A180A"/>
      <rect x="14" y="10" width="1"  height="1" fill="#C0FFD0"/>
      <rect x="14" y="13" width="3"  height="1" fill="#0A080F"/>

      {/* ══ 코 ══ */}
      <rect x="12" y="15" width="2"  height="1" fill="#CC8860"/>

      {/* ══ 볼터치 ══ */}
      <rect x="7"  y="14" width="3"  height="2" fill="#FF9999" opacity="0.4"/>
      <rect x="16" y="14" width="3"  height="2" fill="#FF9999" opacity="0.4"/>

      {/* ══ 입 ══ */}
      <rect x="11" y="17" width="4"  height="1" fill="#CC4040"/>
      <rect x="10" y="18" width="6"  height="1" fill="#CC3030"/>

      {/* ══ 목 ══ */}
      <rect x="10" y="20" width="6"  height="3" fill="#FFD5A8"/>

      {/* ══ 흰 유니폼 상의 ══ */}
      <rect x="7"  y="23" width="12" height="9" fill="#F2F2F2"/>
      {/* 칼라 / 라펠 */}
      <rect x="10" y="23" width="3"  height="3" fill="#E4E4E4"/>
      <rect x="13" y="23" width="3"  height="3" fill="#E4E4E4"/>
      <rect x="11" y="24" width="1"  height="5" fill="#D0D0D0"/>
      <rect x="14" y="24" width="1"  height="5" fill="#D0D0D0"/>

      {/* ══ 왼팔 (위로 들어 손 흔들기) ══ */}
      <rect x="3"  y="23" width="4"  height="2" fill="#F2F2F2"/>
      <rect x="2"  y="21" width="3"  height="3" fill="#F2F2F2"/>
      <rect x="1"  y="19" width="3"  height="3" fill="#F2F2F2"/>
      {/* 왼손 */}
      <rect x="0"  y="16" width="3"  height="4" fill="#FFD5A8"/>
      <rect x="1"  y="15" width="2"  height="2" fill="#FFD5A8"/>

      {/* ══ 오른팔 (가방 들기) ══ */}
      <rect x="19" y="23" width="4"  height="4" fill="#F2F2F2"/>
      <rect x="21" y="27" width="3"  height="3" fill="#FFD5A8"/>
      {/* 가방 */}
      <rect x="20" y="30" width="5"  height="4" fill="#222222"/>
      <rect x="21" y="29" width="3"  height="2" fill="#333333"/>
      <rect x="22" y="28" width="1"  height="2" fill="#444444"/>
      <rect x="22" y="30" width="1"  height="1" fill="#888888"/>

      {/* ══ 스커트 ══ */}
      <rect x="7"  y="32" width="12" height="2" fill="#ECECEC"/>
      <rect x="6"  y="34" width="14" height="2" fill="#E4E4E4"/>

      {/* ══ 다리 ══ */}
      <rect x="9"  y="36" width="3"  height="3" fill="#FFD5A8"/>
      <rect x="14" y="36" width="3"  height="3" fill="#FFD5A8"/>

      {/* ══ 구두 ══ */}
      <rect x="8"  y="39" width="5"  height="2" fill="#2A1808"/>
      <rect x="14" y="39" width="5"  height="2" fill="#2A1808"/>
      <rect x="8"  y="39" width="3"  height="1" fill="#4A3018"/>
      <rect x="14" y="39" width="3"  height="1" fill="#4A3018"/>
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
