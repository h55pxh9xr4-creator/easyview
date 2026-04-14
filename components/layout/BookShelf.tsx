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

/* ═══════════════════════════════════════════════
   DASHBOARD PANELS — assembled position + scatter
═══════════════════════════════════════════════ */
const DW = 860, DH = 490;

const PANEL_DEFS = [
  { id: "hdr",    top: 0,   left: 0,   w: DW,  h: 44,  z: 5, scatter: { tx:   0, ty: -160, tz:  -60, rx: 18, ry:  0,  sc: 0.88 } },
  { id: "eq",     top: 52,  left: 0,   w: 548, h: 210, z: 3, scatter: { tx: -260, ty:  -80, tz: -200, rx:  8, ry: -28, sc: 0.76 } },
  { id: "pl",     top: 270, left: 0,   w: 548, h: 188, z: 3, scatter: { tx: -220, ty:  160, tz: -170, rx: 10, ry: -24, sc: 0.78 } },
  { id: "task",   top: 52,  left: 556, w: 304, h: 164, z: 2, scatter: { tx:  280, ty: -130, tz: -190, rx: 12, ry:  30, sc: 0.74 } },
  { id: "margin", top: 224, left: 556, w: 304, h: 92,  z: 2, scatter: { tx:  320, ty:   60, tz: -140, rx:  6, ry:  26, sc: 0.78 } },
  { id: "house",  top: 324, left: 556, w: 304, h: 134, z: 2, scatter: { tx:  300, ty:  200, tz: -120, rx:  4, ry:  22, sc: 0.80 } },
];

type PanelId = "hdr" | "eq" | "pl" | "task" | "margin" | "house";

/* ── helpers ── */
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

type Scatter = { tx: number; ty: number; tz: number; rx: number; ry: number; sc: number };
function getTransform(scatter: Scatter, progress: number) {
  const t = 1 - ease(progress);
  return [
    `translateX(${scatter.tx * t}px)`,
    `translateY(${scatter.ty * t}px)`,
    `translateZ(${scatter.tz * t}px)`,
    `rotateX(${scatter.rx * t}deg)`,
    `rotateY(${scatter.ry * t}deg)`,
    `scale(${lerp(1, scatter.sc, t)})`,
  ].join(" ");
}

/* ── SVG Area Chart ── */
function AreaChart({ data, color, h = 100 }: { data: number[]; color: string; h?: number }) {
  const W = 500;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    h - ((v - mn) / rng) * (h - 12) - 6,
  ] as [number, number]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `M${pts[0][0]},${h} ${pts.map(([x, y]) => `L${x},${y}`).join(" ")} L${pts[pts.length - 1][0]},${h} Z`;
  const gid  = `ag${color.replace(/#/g, "")}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={color} stopOpacity="0.45" />
          <stop offset="90%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── SVG Donut Chart ── */
function Donut({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 14) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  );
}

/* ── Panel contents ── */
const CELL: React.CSSProperties = { background: "rgba(10,16,50,0.92)", border: "1px solid rgba(80,110,220,0.18)", borderRadius: 10, overflow: "hidden" };

function HeaderPanel() {
  const stats = [
    { l: "Client",             v: "DEMO" },
    { l: "Equity",             v: "₩74,572,318",   sub: "+1.1%" },
    { l: "Gross Market Value", v: "₩210,251,474" },
    { l: "Short Market Value", v: "-₩99,588,414" },
    { l: "Long Market Value",  v: "₩10,575,914" },
    { l: "Total P&L",          v: "₩27,407",        sub: "+0.04%", pos: true },
  ];
  return (
    <div style={{ ...CELL, display: "flex", alignItems: "center", height: "100%", padding: "0 18px", gap: 28, borderRadius: 10 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8.5, letterSpacing: 0.8 }}>{s.l}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{s.v}</span>
            {s.sub && <span style={{ fontSize: 9, color: s.pos ? "#10b981" : "#94a3b8", fontWeight: 600 }}>{s.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const EQ_DATA  = [62,65,60,70,68,78,74,85,80,92,88,96,90,102,98,108,104,112,108,118,114,125,120,130];
const PL_DATA  = [30,28,33,31,36,34,40,37,44,42,48,45,50,48,54,51,57,55,60,58,64,61,68,65];

function EquityPanel() {
  const tabs = ["Daily","Weekly","Monthly"];
  const ranges = ["7 days","MTD","Last month","QTD","YTD","1m","2m","3m"];
  return (
    <div style={{ ...CELL, height: "100%", padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Equity</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginLeft: 4 }}>Frequency</span>
        {tabs.map(t => (
          <span key={t} style={{ fontSize: 9, color: t === "Daily" ? "#1a1a3a" : "rgba(255,255,255,0.4)", background: t === "Daily" ? "#22d3ee" : "transparent", padding: "2px 7px", borderRadius: 4, cursor: "pointer", fontWeight: t === "Daily" ? 700 : 400 }}>{t}</span>
        ))}
        <span style={{ flex: 1 }} />
        {ranges.map((r, i) => (
          <span key={r} style={{ fontSize: 8.5, color: i === 0 ? "#1a1a3a" : "rgba(255,255,255,0.3)", background: i === 0 ? "#22d3ee" : "transparent", padding: "2px 6px", borderRadius: 4, cursor: "pointer" }}>{r}</span>
        ))}
      </div>
      <div>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>₩68,006,603.58</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Total margin requirement <span style={{ color: "#f43f5e" }}>-₩23,468k</span> <span style={{ color: "#10b981" }}>+3.4%</span></div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AreaChart data={EQ_DATA} color="#22d3ee" h={110} />
      </div>
    </div>
  );
}

function PLPanel() {
  return (
    <div style={{ ...CELL, height: "100%", padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>P&L performance</span>
        {["Show","Time","Symbol"].map((t, i) => (
          <span key={t} style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{t}</span>
        ))}
        <span style={{ fontSize: 8.5, color: "#1a1a3a", background: "#22d3ee", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>MTD</span>
        {["Last month","QTD","YTD","Custom"].map(t => (
          <span key={t} style={{ fontSize: 8.5, color: "rgba(255,255,255,0.3)" }}>{t}</span>
        ))}
      </div>
      <div>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: -0.5 }}>(-₩346,012.97)</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Total margin requirement <span style={{ color: "#f43f5e" }}>-₩23,486k</span> <span style={{ color: "#10b981" }}>+3.1%</span></div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AreaChart data={PL_DATA} color="#10b981" h={95} />
      </div>
    </div>
  );
}

function TaskPanel() {
  const tasks = [
    { label: "Margin call", urgent: true,  count: null, desc: "₩3,887 House call. Please contact us." },
    { label: "Options to exercise",         urgent: false, count: 33 },
    { label: "Voluntary corporate actions", urgent: false, count: 41 },
    { label: "Away trade breaks",           urgent: false, count: 21 },
  ];
  return (
    <div style={{ ...CELL, height: "100%", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Priority task</div>
      {tasks.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          {t.urgent
            ? <div style={{ background: "#f43f5e", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", marginTop: 1 }}>Due in 3 days</div>
            : <div style={{ minWidth: 20, color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700 }}>{t.count}</div>
          }
          <div>
            <div style={{ color: "#fff", fontSize: 10, fontWeight: 600 }}>{t.label}</div>
            {t.desc && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8.5, marginTop: 2 }}>{t.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MarginPanel() {
  return (
    <div style={{ ...CELL, height: "100%", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase" }}>Margin excess (deficit)</div>
        <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 8.5, padding: "3px 10px", borderRadius: 5, cursor: "pointer" }}>Risk details →</div>
      </div>
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: -0.4 }}>₩2,067,643 <span style={{ color: "#10b981", fontSize: 10, fontWeight: 600 }}>3.41%</span></div>
      <div style={{ position: "relative", height: 10, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "30%", background: "linear-gradient(90deg, #10b981, #22d3ee)", borderRadius: 5 }} />
        <div style={{ position: "absolute", left: 0, top: "30%", bottom: "30%", width: 1, background: "rgba(255,255,255,0.2)" }} />
        <div style={{ position: "absolute", right: 0, top: "30%", bottom: "30%", width: 1, background: "rgba(255,255,255,0.2)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5 }}>Excess</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5 }}>Deficit</span>
      </div>
    </div>
  );
}

function HousePanel() {
  return (
    <div style={{ ...CELL, height: "100%", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase" }}>House requirements</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5 }}>Excess</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5 }}>Deficit</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
        <Donut pct={0.63} color="#f59e0b" size={76} />
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>₩42,749,375</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 8.5 }}>Risk-based req</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 4, fontWeight: 600 }}>₩24,277,848</div>
        </div>
      </div>
    </div>
  );
}

const PANEL_CONTENT: Record<PanelId, React.ReactNode> = {
  hdr:    <HeaderPanel />,
  eq:     <EquityPanel />,
  pl:     <PLPanel />,
  task:   <TaskPanel />,
  margin: <MarginPanel />,
  house:  <HousePanel />,
};

/* ═══════════════════════════════════════════════
   FLOATING PANELS HERO SECTION
═══════════════════════════════════════════════ */
function FloatingPanels() {
  const [progress, setProgress] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const progRef = useRef(0);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const down = e.deltaY > 0;
      const up   = e.deltaY < 0;
      // 스크롤 다운 + 아직 합체 안됨 → 합체 진행 (페이지 스크롤 막기)
      if (down && progRef.current < 1) {
        e.preventDefault();
        const next = Math.min(1, progRef.current + e.deltaY / 500);
        progRef.current = next;
        setProgress(next);
      }
      // 스크롤 업 + 페이지 최상단 + 이미 일부 합체됨 → 흩어지기 (페이지 스크롤 막기)
      else if (up && window.scrollY === 0 && progRef.current > 0) {
        e.preventDefault();
        const next = Math.max(0, progRef.current + e.deltaY / 500);
        progRef.current = next;
        setProgress(next);
      }
      // 완전히 합체됐고 스크롤 다운 → 자연스럽게 아래로 스크롤
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const assembled = progress > 0.85;

  return (
    <div
      ref={heroRef}
      style={{
        width: "100%",
        height: "calc(100vh - 88px)",
        minHeight: 600,
        background: "linear-gradient(150deg, #060a1c 0%, #0e1440 50%, #06091a 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
      }}
    >
      {/* ambient glows */}
      <div style={{ position:"absolute", top:"5%",  left:"10%",  width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 65%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"0%",right:"8%",  width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 65%)", pointerEvents:"none" }} />

      {/* eyebrow */}
      <div style={{ position:"absolute", top:28, color:"rgba(255,255,255,0.2)", fontSize:9, letterSpacing:4, textTransform:"uppercase" }}>
        PwC EasyView — Dashboard Preview
      </div>

      {/* 3D dashboard scene */}
      <div style={{
        perspective: 1300,
        perspectiveOrigin: "50% 44%",
        width: DW,
        maxWidth: "92vw",
        position: "relative",
      }}>
        {/* scale helper so it fits on smaller screens */}
        <div style={{
          position: "relative",
          width: DW,
          height: DH,
          transformOrigin: "top center",
        }}>
          {PANEL_DEFS.map(panel => (
            <div
              key={panel.id}
              style={{
                position: "absolute",
                top: panel.top, left: panel.left,
                width: panel.w, height: panel.h,
                zIndex: panel.z,
                transform: getTransform(panel.scatter, progress),
                transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)",
                willChange: "transform",
              }}
            >
              {PANEL_CONTENT[panel.id as PanelId]}
            </div>
          ))}
        </div>
      </div>

      {/* bottom hints */}
      <div style={{
        position: "absolute", bottom: 28,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        pointerEvents: "none",
        transition: "opacity 0.4s",
        opacity: progress < 0.05 ? 1 : 0,
      }}>
        <div style={{ color:"rgba(255,255,255,0.22)", fontSize:9, letterSpacing:3, textTransform:"uppercase" }}>scroll to assemble</div>
        <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width:1.5, height:6, borderRadius:2, background:"rgba(255,255,255,0.25)", animation:`sd 1.2s ease-in-out ${i*0.2}s infinite` }} />
          ))}
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 28,
        color: "rgba(255,255,255,0.22)", fontSize: 9, letterSpacing: 3, textTransform: "uppercase",
        pointerEvents: "none", transition: "opacity 0.4s",
        opacity: assembled ? 1 : 0,
      }}>
        scroll up to scatter
      </div>

      {/* progress bar */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:"rgba(255,255,255,0.05)" }}>
        <div style={{ height:"100%", width:`${progress*100}%`, background:"linear-gradient(90deg,#22d3ee,#818cf8)", transition:"width 0.08s" }} />
      </div>

      <style>{`@keyframes sd{0%,100%{opacity:0.15}50%{opacity:0.65}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN BOOKSHELF
═══════════════════════════════════════════════ */
export default function BookShelf({ onNavigate }: { onNavigate: (tab: string, sub: string, label: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const houseRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const [phase,   setPhase]   = useState<Phase>("idle");
  const [dogLeft, setDogLeft] = useState<number>(0);
  const [flipDog, setFlipDog] = useState(false);

  const handleClick = useCallback((page: typeof PAGES[0], idx: number) => {
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
    <div style={{ background: "#faf8f5", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes dogIdle  {0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes dogRun   {0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}70%{transform:translateY(-5px)}}
        @keyframes dogEnter {0%{transform:scale(1);opacity:1}100%{transform:scale(0.05);opacity:0}}
      `}</style>

      {/* HERO */}
      <FloatingPanels />

      {/* VILLAGE */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:"48px 0 36px" }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#1d1d1d", letterSpacing:-0.8 }}>어느 집으로 갈까요?</div>
        </div>

        <div ref={containerRef} style={{ position:"relative" }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap:16, padding:"0 24px" }}>
            {PAGES.map((p, i) => (
              <div key={p.sub} ref={el => { houseRefs.current[i] = el; }}>
                <House page={p} disabled={phase !== "idle"} onClick={() => handleClick(p, i)} />
              </div>
            ))}
          </div>
          <div style={{ height:18, background:"linear-gradient(180deg,#6ECC5A 0%,#4aaa38 100%)", boxShadow:"0 4px 14px rgba(0,0,0,0.12)" }} />
          <div style={{ height:10, background:"linear-gradient(180deg,#c8a97a,#b5935e)" }} />
          <div style={{
            position:"absolute", bottom:28, left:dogLeft, width:64,
            transition: phase === "running" ? "left 0.75s cubic-bezier(0.4,0,0.2,1)" : "none",
            transform: flipDog ? "scaleX(-1)" : "scaleX(1)",
            animation:
              phase === "idle"     ? "dogIdle 1.4s ease-in-out infinite" :
              phase === "running"  ? "dogRun 0.25s ease-in-out infinite" :
              phase === "entering" ? "dogEnter 0.5s ease-in-out forwards" : "",
            zIndex:10,
          }}>
            <DogSVG />
          </div>
        </div>

        <div style={{ fontSize:12, color:"#bbb", marginTop:8 }}>집을 클릭하면 강아지가 들어가요 🐾</div>
      </div>
    </div>
  );
}

function House({ page, disabled, onClick }: { page: typeof PAGES[0]; disabled: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", cursor:disabled?"default":"pointer", opacity:disabled?0.35:1, transition:"opacity .3s, transform .25s", transform:hovered&&!disabled?"translateY(-10px)":"translateY(0)" }}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onClick={onClick}>
      <div style={{ width:14, height:22, background:"#a0826d", marginBottom:-8, marginRight:-54, borderRadius:"3px 3px 0 0", alignSelf:"flex-start", marginLeft:68, zIndex:1 }} />
      <div style={{ width:0, height:0, borderLeft:"68px solid transparent", borderRight:"68px solid transparent", borderBottom:`56px solid ${page.roof}` }} />
      <div style={{ width:116, height:100, background:page.wall, marginTop:-1, position:"relative", boxShadow:hovered?"0 14px 32px rgba(0,0,0,0.15)":"0 6px 16px rgba(0,0,0,0.1)", transition:"box-shadow .25s" }}>
        <Window top={14} left={10} /><Window top={14} right={10} />
        <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:32, height:52, background:page.door, borderRadius:"16px 16px 0 0" }}>
          <div style={{ position:"absolute", right:7, top:"55%", width:5, height:5, borderRadius:"50%", background:"rgba(255,255,255,0.65)" }} />
        </div>
      </div>
      <div style={{ marginTop:10, fontSize:12, fontWeight:700, color:"#444", letterSpacing:-0.3, textAlign:"center" }}>{page.label}</div>
    </div>
  );
}

function Window({ top, left, right }: { top: number; left?: number; right?: number }) {
  return (
    <div style={{ position:"absolute", top, left, right, width:26, height:26, background:"rgba(255,255,255,0.8)", borderRadius:3, border:"2px solid rgba(0,0,0,0.07)", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:"rgba(0,0,0,0.1)" }} />
      <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:"rgba(0,0,0,0.1)" }} />
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
