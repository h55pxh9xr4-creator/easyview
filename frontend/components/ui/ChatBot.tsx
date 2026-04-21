"use client";

import { useState, useRef, useEffect } from "react";
import SAMILKIM_IMG from "@/lib/samilkimImg";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export default function ChatBot() {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
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

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="logo" style={{ height: 14, objectFit: "contain" }} />
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
                <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="logo" style={{ height: 36, objectFit: "contain", marginBottom: 12, opacity: 0.25 }} />
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
            <button className="chatbot-send" onClick={handleSend} disabled={!input.trim()}>
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
