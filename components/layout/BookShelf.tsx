"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const PAGES = [
  { tab: "summary", sub: "summary",     label: "Summary",      wall: "#FDE68A", roof: "#F59E0B", door: "#92400E" },
  { tab: "pl",      sub: "pl-sum",       label: "손익분석",     wall: "#FECDD3", roof: "#F43F5E", door: "#9F1239" },
  { tab: "bs",      sub: "bs-sum",       label: "재무상태분석", wall: "#BAE6FD", roof: "#0EA5E9", door: "#0C4A6E" },
  { tab: "vch",     sub: "vch-analysis", label: "전표분석",     wall: "#BBF7D0", roof: "#22C55E", door: "#14532D" },
  { tab: "sc",      sub: "sc-dup",       label: "시나리오분석", wall: "#DDD6FE", roof: "#8B5CF6", door: "#4C1D95" },
  { tab: "qa",      sub: "inquiry",      label: "Q&A",          wall: "#CFFAFE", roof: "#06B6D4", door: "#164E63" },
];

type Phase = "idle" | "running" | "entering";

/* ── Floating Dashboard Panels ── */
const PANEL_DATA = [
  {
    label: "손익 현황",
    sub: "Revenue vs Cost",
    accent: "#4f7cff",
    bg: "#0f1e4a",
    bars: [55, 72, 48, 80, 63, 91, 70],
    stats: [{ k: "매출액", v: "₩248B" }, { k: "영업이익률", v: "12.4%" }],
  },
  {
    label: "재무 상태",
    sub: "Balance Sheet",
    accent: "#22d3ee",
    bg: "#071e2b",
    bars: [42, 58, 74, 50, 68, 82, 55],
    stats: [{ k: "총자산", v: "₩1.2T" }, { k: "부채비율", v: "68%" }],
  },
  {
    label: "시나리오",
    sub: "Scenario Analysis",
    accent: "#a78bfa",
    bg: "#130e2e",
    bars: [30, 65, 45, 78, 52, 88, 60],
    stats: [{ k: "Best Case", v: "+23%" }, { k: "Base Case", v: "+11%" }],
  },
];

const SPREAD = [
  { tx: -240, ty: 50,   tz: -120, rx: 14, ry: -28, scale: 0.86 },
  { tx: 0,    ty: -30,  tz: 0,    rx: 4,  ry: 0,   scale: 1.0  },
  { tx: 240,  ty: 60,   tz: -90,  rx: 11, ry: 28,  scale: 0.88 },
];

function FloatingPanels() {
  const [progress, setProgress] = useState(0);
  const dragging  = useRef(false);
  const startY    = useRef(0);
  const startP    = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current   = e.clientY;
    startP.current   = progress;
  };
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startY.current   = e.touches[0].clientY;
    startP.current   = progress;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dy = e.clientY - startY.current;
      setProgress(p => Math.max(0, Math.min(1, startP.current + dy / 180)));
    };
    const onTMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const dy = e.touches[0].clientY - startY.current;
      setProgress(Math.max(0, Math.min(1, startP.current + dy / 180)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onTMove);
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onTMove);
      window.removeEventListener("touchend",  onUp);
    };
  }, []);

  const getTransform = (idx: number) => {
    const s = SPREAD[idx];
    const p = 1 - progress;          // p=1 → spread, p=0 → merged
    return [
      `translateX(${s.tx * p}px)`,
      `translateY(${s.ty * p}px)`,
      `translateZ(${s.tz * p}px)`,
      `rotateX(${s.rx * p}deg)`,
      `rotateY(${s.ry * p}deg)`,
      `scale(${1 - (1 - s.scale) * p})`,
    ].join(" ");
  };

  const merged = progress > 0.85;

  return (
    <div
      style={{
        perspective: 1100,
        perspectiveOrigin: "50% 45%",
        height: 260,
        position: "relative",
        userSelect: "none",
        cursor: dragging.current ? "grabbing" : "grab",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {PANEL_DATA.map((panel, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 300, height: 190,
            marginLeft: -150, marginTop: -95,
            background: `linear-gradient(135deg, ${panel.bg} 0%, #0a0f1e 100%)`,
            border: `1px solid ${panel.accent}44`,
            borderRadius: 16,
            transform: getTransform(i),
            transition: dragging.current ? "none" : "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            boxShadow: `0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 ${panel.accent}33`,
            padding: "18px 20px",
            zIndex: i === 1 ? 3 : i === 0 ? 1 : 2,
            opacity: merged && i !== 1 ? 0 : 1,
            pointerEvents: "none",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: -0.3 }}>
                {panel.label}
              </div>
              <div style={{ color: `${panel.accent}99`, fontSize: 10, marginTop: 2, letterSpacing: 1 }}>
                {panel.sub.toUpperCase()}
              </div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${panel.accent}22`,
              border: `1px solid ${panel.accent}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: panel.accent, opacity: 0.8 }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            {panel.stats.map((s, j) => (
              <div key={j}>
                <div style={{ color: `${panel.accent}88`, fontSize: 9, letterSpacing: 1 }}>{s.k}</div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 5,
            marginTop: 14, height: 54,
          }}>
            {panel.bars.map((h, j) => (
              <div key={j} style={{
                flex: 1, height: `${h}%`,
                background: `linear-gradient(180deg, ${panel.accent} 0%, ${panel.accent}55 100%)`,
                borderRadius: "3px 3px 0 0",
                opacity: 0.85,
              }} />
            ))}
          </div>

          {/* Bottom line */}
          <div style={{
            marginTop: 10,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${panel.accent}44, transparent)`,
          }} />
        </div>
      ))}

      {/* Drag hint */}
      <div style={{
        position: "absolute",
        bottom: 0, left: "50%",
        transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.28)",
        fontSize: 10,
        letterSpacing: 2.5,
        pointerEvents: "none",
        transition: "opacity 0.3s",
        opacity: progress > 0.05 && progress < 0.9 ? 0 : 1,
        textTransform: "uppercase",
      }}>
        {merged ? "↑ drag up to spread" : "↓ drag to merge"}
      </div>

      {/* Merge progress bar */}
      <div style={{
        position: "absolute",
        bottom: -16, left: "50%",
        transform: "translateX(-50%)",
        width: 80, height: 2,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 2,
        overflow: "hidden",
        opacity: progress > 0.05 && progress < 0.95 ? 1 : 0,
        transition: "opacity 0.3s",
      }}>
        <div style={{
          width: `${progress * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, #4f7cff, #a78bfa)`,
          borderRadius: 2,
          transition: dragging.current ? "none" : "width 0.1s",
        }} />
      </div>
    </div>
  );
}

/* ── Main BookShelf ── */
export default function BookShelf({
  onNavigate,
}: {
  onNavigate: (tab: string, sub: string, label: string) => void;
}) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const houseRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [dogLeft,  setDogLeft]  = useState<number>(0);
  const [flipDog,  setFlipDog]  = useState(false);

  const handleClick = useCallback((page: (typeof PAGES)[0], idx: number) => {
    if (phase !== "idle") return;
    const house = houseRefs.current[idx];
    const cont  = containerRef.current;
    if (!house || !cont) return;

    const hr = house.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    const doorX = hr.left - cr.left + hr.width / 2 - 32;
    setFlipDog(doorX < dogLeft);
    setDogLeft(doorX);
    setPhase("running");

    setTimeout(() => setPhase("entering"), 750);
    setTimeout(() => onNavigate(page.tab, page.sub, page.label), 1250);
  }, [phase, dogLeft, onNavigate]);

  return (
    <div style={{
      minHeight: "calc(100vh - 88px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#faf8f5", gap: 40,
      paddingTop: 32, paddingBottom: 32,
    }}>
      <style>{`
        @keyframes dogIdle   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes dogRun    { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} 70%{transform:translateY(-5px)} }
        @keyframes dogEnter  { 0%{transform:scale(1);opacity:1} 100%{transform:scale(0.05);opacity:0} }
      `}</style>

      {/* 타이틀 */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#bbb", textTransform: "uppercase", marginBottom: 10 }}>
          PwC EasyView
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#1d1d1d", letterSpacing: -1 }}>
          어느 집으로 갈까요?
        </div>
      </div>

      {/* 플로팅 대시보드 패널 */}
      <div style={{
        background: "linear-gradient(160deg, #0b1120 0%, #111827 60%, #0f172a 100%)",
        borderRadius: 28,
        padding: "32px 48px 48px",
        width: 480,
        position: "relative",
        boxShadow: "0 32px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{
          color: "rgba(255,255,255,0.28)",
          fontSize: 9,
          letterSpacing: 3,
          textTransform: "uppercase",
          textAlign: "center",
          marginBottom: 8,
        }}>
          Dashboard Preview
        </div>
        <FloatingPanels />
      </div>

      {/* 마을 */}
      <div ref={containerRef} style={{ position: "relative" }}>

        {/* 집들 */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, padding: "0 24px" }}>
          {PAGES.map((p, i) => (
            <div key={p.sub} ref={el => { houseRefs.current[i] = el; }}>
              <House
                page={p}
                disabled={phase !== "idle"}
                onClick={() => handleClick(p, i)}
              />
            </div>
          ))}
        </div>

        {/* 잔디 + 땅 */}
        <div style={{
          height: 18,
          background: "linear-gradient(180deg, #6ECC5A 0%, #4aaa38 100%)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        }} />
        <div style={{
          height: 10,
          background: "linear-gradient(180deg, #c8a97a, #b5935e)",
        }} />

        {/* 🐶 강아지 */}
        <div style={{
          position: "absolute",
          bottom: 28,
          left: dogLeft,
          width: 64,
          transition: phase === "running" ? "left 0.75s cubic-bezier(0.4,0,0.2,1)" : "none",
          transform: flipDog ? "scaleX(-1)" : "scaleX(1)",
          animation:
            phase === "idle"     ? "dogIdle 1.4s ease-in-out infinite" :
            phase === "running"  ? "dogRun 0.25s ease-in-out infinite" :
            phase === "entering" ? "dogEnter 0.5s ease-in-out forwards" : "",
          zIndex: 10,
        }}>
          <DogSVG />
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#bbb" }}>집을 클릭하면 강아지가 들어가요 🐾</div>
    </div>
  );
}

/* ── 집 컴포넌트 ── */
function House({ page, disabled, onClick }: {
  page: (typeof PAGES)[0];
  disabled: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "opacity .3s, transform .25s",
        transform: hovered && !disabled ? "translateY(-10px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* 굴뚝 */}
      <div style={{
        width: 14, height: 22,
        background: "#a0826d",
        marginBottom: -8,
        marginRight: -54,
        borderRadius: "3px 3px 0 0",
        alignSelf: "flex-start",
        marginLeft: 68,
        zIndex: 1,
      }} />

      {/* 지붕 */}
      <div style={{
        width: 0, height: 0,
        borderLeft: "68px solid transparent",
        borderRight: "68px solid transparent",
        borderBottom: `56px solid ${page.roof}`,
      }} />

      {/* 벽 */}
      <div style={{
        width: 116, height: 100,
        background: page.wall,
        marginTop: -1,
        position: "relative",
        boxShadow: hovered ? "0 14px 32px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.1)",
        transition: "box-shadow .25s",
      }}>
        {/* 왼쪽 창문 */}
        <Window top={14} left={10} />
        {/* 오른쪽 창문 */}
        <Window top={14} right={10} />
        {/* 문 */}
        <div style={{
          position: "absolute", bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 32, height: 52,
          background: page.door,
          borderRadius: "16px 16px 0 0",
        }}>
          {/* 문고리 */}
          <div style={{
            position: "absolute", right: 7, top: "55%",
            width: 5, height: 5, borderRadius: "50%",
            background: "rgba(255,255,255,0.65)",
          }} />
        </div>
      </div>

      {/* 레이블 */}
      <div style={{
        marginTop: 10, fontSize: 12, fontWeight: 700,
        color: "#444", letterSpacing: -0.3, textAlign: "center",
      }}>
        {page.label}
      </div>
    </div>
  );
}

function Window({ top, left, right }: { top: number; left?: number; right?: number }) {
  return (
    <div style={{
      position: "absolute", top, left, right,
      width: 26, height: 26,
      background: "rgba(255,255,255,0.8)",
      borderRadius: 3,
      border: "2px solid rgba(0,0,0,0.07)",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.1)" }} />
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.1)" }} />
    </div>
  );
}

/* ── 강아지 SVG ── */
function DogSVG() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" fill="none">
      {/* 꼬리 */}
      <path d="M9 30 Q2 20 9 11" stroke="#C4956A" strokeWidth="5" strokeLinecap="round"/>
      {/* 몸통 */}
      <ellipse cx="31" cy="36" rx="20" ry="13" fill="#D4A574"/>
      {/* 머리 */}
      <circle cx="51" cy="25" r="13" fill="#D4A574"/>
      {/* 귀 */}
      <ellipse cx="57" cy="13" rx="7" ry="10" fill="#C4956A" transform="rotate(18 57 13)"/>
      <ellipse cx="44" cy="13" rx="5" ry="8" fill="#C4956A" transform="rotate(-12 44 13)"/>
      {/* 눈 */}
      <circle cx="55" cy="22" r="3" fill="#2d1a00"/>
      <circle cx="56" cy="21" r="1.1" fill="white"/>
      {/* 코 */}
      <ellipse cx="60" cy="28" rx="3.2" ry="2.2" fill="#2d1a00"/>
      {/* 입 */}
      <path d="M58 31 Q60 34 62 31" stroke="#2d1a00" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* 혀 */}
      <ellipse cx="60" cy="34" rx="2.5" ry="1.8" fill="#F472B6"/>
      {/* 앞다리 */}
      <rect x="36" y="45" width="8" height="12" rx="4" fill="#C4956A"/>
      <rect x="46" y="45" width="8" height="12" rx="4" fill="#C4956A"/>
      {/* 뒷다리 */}
      <rect x="14" y="45" width="8" height="12" rx="4" fill="#C4956A"/>
      <rect x="24" y="46" width="8" height="11" rx="4" fill="#C4956A"/>
    </svg>
  );
}
