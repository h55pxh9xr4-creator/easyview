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

/* ─────────────────────────────────────
   Panel data
───────────────────────────────────── */
const PANELS = [
  {
    title: "손익 현황", subtitle: "P&L Summary", accent: "#818cf8",
    kpis: [{ l: "매출액", v: "₩248B" }, { l: "영업이익률", v: "12.4%" }, { l: "YoY", v: "+8.3%" }],
    bars: [44, 60, 52, 78, 55, 88, 66, 72, 58],
    line: [30, 45, 38, 62, 48, 74, 55, 82, 60, 75],
  },
  {
    title: "재무 상태", subtitle: "Balance Sheet", accent: "#34d399",
    kpis: [{ l: "총자산", v: "₩1.2T" }, { l: "부채비율", v: "68%" }, { l: "유동비율", v: "142%" }],
    bars: [55, 42, 70, 48, 65, 80, 58, 74, 62],
    line: [50, 40, 60, 45, 68, 52, 72, 58, 80, 65],
  },
  {
    title: "시나리오", subtitle: "Scenario Analysis", accent: "#f472b6",
    kpis: [{ l: "Best Case", v: "+23%" }, { l: "Base Case", v: "+11%" }, { l: "Bear Case", v: "-4%" }],
    bars: [30, 50, 42, 68, 38, 72, 54, 65, 44],
    line: [20, 38, 28, 55, 35, 65, 42, 76, 50, 68],
  },
];

/* spread state for each card */
const SPREAD = [
  { tx: -520, ty:  40, tz: -200, rx: 10, ry: -40, rz: -3, sc: 0.75 },
  { tx:    0, ty: -30, tz:    0, rx:  4, ry:   0, rz:  0, sc: 1.00 },
  { tx:  520, ty:  55, tz: -160, rx:  8, ry:  40, rz:  3, sc: 0.77 },
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/* ── Mini SVG line chart ── */
function LineChart({ values, accent }: { values: number[]; accent: string }) {
  const W = 220, H = 52;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - mn) / rng) * (H - 4) - 2}`);
  const area = `M0,${H} L${pts.join(" L")} L${W},${H} Z`;
  const id = `g${accent.replace(/#/g, "")}`;
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Single dashboard card ── */
function DashCard({ p, style }: { p: typeof PANELS[0]; style: React.CSSProperties }) {
  return (
    <div style={{
      position: "absolute",
      width: 420, height: 270,
      top: "50%", left: "50%",
      marginLeft: -210, marginTop: -135,
      background: "rgba(8, 12, 30, 0.88)",
      backdropFilter: "blur(32px)",
      border: `1px solid ${p.accent}38`,
      borderRadius: 24,
      padding: "24px 28px",
      boxShadow: `0 0 0 1px ${p.accent}14, 0 48px 96px rgba(0,0,0,0.75), 0 0 80px ${p.accent}14`,
      display: "flex", flexDirection: "column", gap: 16,
      pointerEvents: "none",
      ...style,
    }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: -0.5 }}>{p.title}</div>
          <div style={{ color: `${p.accent}88`, fontSize: 10, letterSpacing: 2, marginTop: 3 }}>{p.subtitle.toUpperCase()}</div>
        </div>
        <div style={{ padding: "4px 12px", borderRadius: 20, background: `${p.accent}20`, border: `1px solid ${p.accent}40`, color: p.accent, fontSize: 10, fontWeight: 700, letterSpacing: 0.8 }}>LIVE</div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 24 }}>
        {p.kpis.map((k, i) => (
          <div key={i}>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 1.2 }}>{k.l}</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginTop: 4, letterSpacing: -0.5 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* line chart */}
      <LineChart values={p.line} accent={p.accent} />

      {/* bar chart */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 30 }}>
        {p.bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}%`,
            background: `linear-gradient(180deg, ${p.accent} 0%, ${p.accent}44 100%)`,
            borderRadius: "2px 2px 0 0", opacity: 0.8,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Floating panels section ── */
function FloatingPanels() {
  const [progress, setProgress] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const progRef = useRef(0);

  /* wheel → merge / spread */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.max(0, Math.min(1, progRef.current + e.deltaY / 400));
      progRef.current = next;
      setProgress(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const cardStyle = (idx: number): React.CSSProperties => {
    const s = SPREAD[idx];
    const t = progress;
    const tx = lerp(s.tx, 0, t), ty = lerp(s.ty, 0, t), tz = lerp(s.tz, 0, t);
    const rx = lerp(s.rx, 0, t), ry = lerp(s.ry, 0, t), rz = lerp(s.rz, 0, t), sc = lerp(s.sc, 1, t);
    const zi = idx === 1 ? 3 : idx === 0 ? 1 : 2;
    const op = idx !== 1 && t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    return {
      transform: `translateX(${tx}px) translateY(${ty}px) translateZ(${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`,
      transition: "transform 0.55s cubic-bezier(0.34,1.2,0.64,1), opacity 0.3s",
      zIndex: zi, opacity: op,
    };
  };

  return (
    <div
      ref={heroRef}
      style={{
        width: "100%",
        height: "70vh",
        minHeight: 520,
        background: "linear-gradient(145deg, #0c0a2e 0%, #1e1060 45%, #0a1028 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "ns-resize",
      }}
    >
      {/* ambient glows */}
      <div style={{ position: "absolute", top: "10%", left: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "5%", right: "10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "30%", right: "20%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* eyebrow */}
      <div style={{ position: "absolute", top: 36, color: "rgba(255,255,255,0.25)", fontSize: 10, letterSpacing: 4, textTransform: "uppercase" }}>
        PwC EasyView — Dashboard Preview
      </div>

      {/* 3D scene */}
      <div style={{ perspective: 1400, perspectiveOrigin: "50% 46%", position: "relative", width: "100%", height: 340 }}>
        {PANELS.map((panel, i) => (
          <DashCard key={i} p={panel} style={cardStyle(i)} />
        ))}
      </div>

      {/* scroll hint */}
      <div style={{
        position: "absolute", bottom: 32,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        color: "rgba(255,255,255,0.25)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
        pointerEvents: "none",
        transition: "opacity 0.4s",
        opacity: progress > 0.05 ? 0 : 1,
      }}>
        <span>scroll to merge</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 1.5, height: 6, borderRadius: 2, background: "rgba(255,255,255,0.3)", animation: `scrollDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>

      {/* merged hint */}
      <div style={{
        position: "absolute", bottom: 32,
        color: "rgba(255,255,255,0.25)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
        pointerEvents: "none",
        transition: "opacity 0.4s",
        opacity: progress > 0.9 ? 1 : 0,
      }}>
        scroll up to spread
      </div>

      {/* progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, background: "linear-gradient(90deg, #818cf8, #34d399, #f472b6)", transition: "width 0.1s" }} />
      </div>

      <style>{`
        @keyframes scrollDot { 0%,100%{opacity:0.15} 50%{opacity:0.7} }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────
   Main BookShelf
───────────────────────────────────── */
export default function BookShelf({
  onNavigate,
}: {
  onNavigate: (tab: string, sub: string, label: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const houseRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const [phase,   setPhase]   = useState<Phase>("idle");
  const [dogLeft, setDogLeft] = useState<number>(0);
  const [flipDog, setFlipDog] = useState(false);

  const handleClick = useCallback((page: (typeof PAGES)[0], idx: number) => {
    if (phase !== "idle") return;
    const house = houseRefs.current[idx];
    const cont  = containerRef.current;
    if (!house || !cont) return;
    const hr    = house.getBoundingClientRect();
    const cr    = cont.getBoundingClientRect();
    const doorX = hr.left - cr.left + hr.width / 2 - 32;
    setFlipDog(doorX < dogLeft);
    setDogLeft(doorX);
    setPhase("running");
    setTimeout(() => setPhase("entering"), 750);
    setTimeout(() => onNavigate(page.tab, page.sub, page.label), 1250);
  }, [phase, dogLeft, onNavigate]);

  return (
    <div style={{ minHeight: "calc(100vh - 88px)", background: "#faf8f5", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes dogIdle   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes dogRun    { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} 70%{transform:translateY(-5px)} }
        @keyframes dogEnter  { 0%{transform:scale(1);opacity:1} 100%{transform:scale(0.05);opacity:0} }
      `}</style>

      {/* ── HERO ── */}
      <FloatingPanels />

      {/* ── VILLAGE ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 12, padding: "40px 0 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1d1d1d", letterSpacing: -0.8 }}>어느 집으로 갈까요?</div>
        </div>

        <div ref={containerRef} style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, padding: "0 24px" }}>
            {PAGES.map((p, i) => (
              <div key={p.sub} ref={el => { houseRefs.current[i] = el; }}>
                <House page={p} disabled={phase !== "idle"} onClick={() => handleClick(p, i)} />
              </div>
            ))}
          </div>

          <div style={{ height: 18, background: "linear-gradient(180deg, #6ECC5A 0%, #4aaa38 100%)", boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }} />
          <div style={{ height: 10, background: "linear-gradient(180deg, #c8a97a, #b5935e)" }} />

          <div style={{
            position: "absolute", bottom: 28, left: dogLeft, width: 64,
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

        <div style={{ fontSize: 12, color: "#bbb", marginTop: 8 }}>집을 클릭하면 강아지가 들어가요 🐾</div>
      </div>
    </div>
  );
}

function House({ page, disabled, onClick }: { page: typeof PAGES[0]; disabled: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, transition: "opacity .3s, transform .25s", transform: hovered && !disabled ? "translateY(-10px)" : "translateY(0)" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onClick}
    >
      <div style={{ width: 14, height: 22, background: "#a0826d", marginBottom: -8, marginRight: -54, borderRadius: "3px 3px 0 0", alignSelf: "flex-start", marginLeft: 68, zIndex: 1 }} />
      <div style={{ width: 0, height: 0, borderLeft: "68px solid transparent", borderRight: "68px solid transparent", borderBottom: `56px solid ${page.roof}` }} />
      <div style={{ width: 116, height: 100, background: page.wall, marginTop: -1, position: "relative", boxShadow: hovered ? "0 14px 32px rgba(0,0,0,0.15)" : "0 6px 16px rgba(0,0,0,0.1)", transition: "box-shadow .25s" }}>
        <Window top={14} left={10} />
        <Window top={14} right={10} />
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 32, height: 52, background: page.door, borderRadius: "16px 16px 0 0" }}>
          <div style={{ position: "absolute", right: 7, top: "55%", width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.65)" }} />
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#444", letterSpacing: -0.3, textAlign: "center" }}>{page.label}</div>
    </div>
  );
}

function Window({ top, left, right }: { top: number; left?: number; right?: number }) {
  return (
    <div style={{ position: "absolute", top, left, right, width: 26, height: 26, background: "rgba(255,255,255,0.8)", borderRadius: 3, border: "2px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.1)" }} />
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.1)" }} />
    </div>
  );
}

function DogSVG() {
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" fill="none">
      <path d="M9 30 Q2 20 9 11" stroke="#C4956A" strokeWidth="5" strokeLinecap="round"/>
      <ellipse cx="31" cy="36" rx="20" ry="13" fill="#D4A574"/>
      <circle cx="51" cy="25" r="13" fill="#D4A574"/>
      <ellipse cx="57" cy="13" rx="7" ry="10" fill="#C4956A" transform="rotate(18 57 13)"/>
      <ellipse cx="44" cy="13" rx="5" ry="8" fill="#C4956A" transform="rotate(-12 44 13)"/>
      <circle cx="55" cy="22" r="3" fill="#2d1a00"/>
      <circle cx="56" cy="21" r="1.1" fill="white"/>
      <ellipse cx="60" cy="28" rx="3.2" ry="2.2" fill="#2d1a00"/>
      <path d="M58 31 Q60 34 62 31" stroke="#2d1a00" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="60" cy="34" rx="2.5" ry="1.8" fill="#F472B6"/>
      <rect x="36" y="45" width="8" height="12" rx="4" fill="#C4956A"/>
      <rect x="46" y="45" width="8" height="12" rx="4" fill="#C4956A"/>
      <rect x="14" y="45" width="8" height="12" rx="4" fill="#C4956A"/>
      <rect x="24" y="46" width="8" height="11" rx="4" fill="#C4956A"/>
    </svg>
  );
}
