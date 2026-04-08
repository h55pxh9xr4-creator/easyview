"use client";

import { useEffect, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import {
  fetchVCHDisclosureAccts, fetchVCHKpi, fetchVCHDaily,
  fetchVCHAccountBar, fetchVCHTopCounterparty, fetchVCHVouchers,
  VCHVoucherItem,
} from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarController, BarElement,
  DoughnutController, ArcElement,
  Tooltip, Legend, Plugin,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, DoughnutController, ArcElement, Tooltip, Legend);

const ORANGE     = "#E87722";
const ORANGE_DIM = "rgba(232,119,34,0.25)";
const BLUE       = "rgba(37,99,235,1)";
const RED        = "rgba(220,38,38,1)";

const DONUT_COLORS = [
  "#E87722","#2563EB","#16A34A","#9333EA","#EF4444",
  "#0891B2","#D97706","#059669","#7C3AED","#DB2777","#94a3b8",
];

const fmtN = (n: number) => n.toLocaleString("ko-KR");
const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

// ── 폴리라인 외부 라벨 플러그인 (BSTrend 동일) ─────────────────
const MIN_PCT_LABEL = 2;
const LINE_GAP = 14;

const polylineLabelPlugin: Plugin<"doughnut"> = {
  id: "polylineLabel",
  afterDraw(chart) {
    const { ctx } = chart;
    const ds    = chart.data.datasets[0];
    const meta  = chart.getDatasetMeta(0);
    const total = (ds.data as number[]).reduce((s, v) => s + v, 0) || 1;
    const colors = ds.backgroundColor as string[];
    const labels = (chart.data.labels ?? []) as string[];

    type Lbl = {
      pct: number; color: string; name: string; isRight: boolean;
      x1: number; y1: number; x2: number; y2: number; x3: number; y3: number;
    };
    const all: Lbl[] = [];
    meta.data.forEach((arc, i) => {
      const val = (ds.data as number[])[i];
      const pct = val / total * 100;
      if (pct < MIN_PCT_LABEL) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a   = arc as any;
      const mid = (a.startAngle + a.endAngle) / 2;
      const r   = a.outerRadius;
      const cx  = a.x, cy = a.y;
      const isRight = Math.cos(mid) >= 0;
      const x1 = cx + Math.cos(mid) * (r + 3);
      const y1 = cy + Math.sin(mid) * (r + 3);
      const x2 = cx + Math.cos(mid) * (r + 18);
      const y2 = cy + Math.sin(mid) * (r + 18);
      const x3 = x2 + (isRight ? 16 : -16);
      all.push({ pct, color: colors[i], name: labels[i] ?? "", isRight, x1, y1, x2, y2, x3, y3: y2 });
    });

    const settle = (group: Lbl[]) => {
      group.sort((a, b) => a.y3 - b.y3);
      for (let k = 1; k < group.length; k++)
        if (group[k].y3 - group[k - 1].y3 < LINE_GAP) group[k].y3 = group[k - 1].y3 + LINE_GAP;
      for (let k = group.length - 2; k >= 0; k--)
        if (group[k + 1].y3 - group[k].y3 < LINE_GAP) group[k].y3 = group[k + 1].y3 - LINE_GAP;
    };
    settle(all.filter(l =>  l.isRight));
    settle(all.filter(l => !l.isRight));

    ctx.save();
    all.forEach(lbl => {
      const short = lbl.name.length > 10 ? lbl.name.slice(0, 10) + "…" : lbl.name;
      ctx.beginPath();
      ctx.moveTo(lbl.x1, lbl.y1);
      ctx.lineTo(lbl.x2, lbl.y2);
      ctx.lineTo(lbl.x3, lbl.y3);
      ctx.strokeStyle = lbl.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#333";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = lbl.isRight ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${short} ${lbl.pct.toFixed(1)}%`, lbl.x3 + (lbl.isRight ? 3 : -3), lbl.y3);
    });
    ctx.restore();
  },
};

interface Kpi     { total_cnt: number; dr_sum: number; cr_sum: number }
interface Daily   { date: string; cnt: number }
interface AcctBar { disclosure_acct: string; cnt: number }
interface Cp      { name: string; cnt: number; pct: number }

export default function VCHAnalysis() {
  const filter = useFilter();

  // ── 계정 필터 ─────────────────────────────────────────────────
  const [acctList,   setAcctList]   = useState<string[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── 선택 상태 (cross-filter) ──────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedAcct, setSelectedAcct] = useState<string | null>(null);

  // ── 데이터 상태 ────────────────────────────────────────────────
  const [kpi,     setKpi]     = useState<Kpi | null>(null);
  const [daily,   setDaily]   = useState<Daily[] | null>(null);
  const [acctBar, setAcctBar] = useState<AcctBar[] | null>(null);
  const [topCp,   setTopCp]   = useState<Cp[] | null>(null);
  const [topN,    setTopN]    = useState(10);
  const [vouchers, setVouchers] = useState<{ total: number; items: VCHVoucherItem[] } | null>(null);
  const [vchPage,  setVchPage]  = useState(1);
  const VCH_PAGE_SIZE = 100;

  // ── 필터 패널 외부 클릭 닫기 ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    if (filterOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // ── 계정 목록 로드 ────────────────────────────────────────────
  useEffect(() => {
    setSelectedDate(null); setSelectedAcct(null);
    fetchVCHDisclosureAccts(filter).then(list => {
      setAcctList(list);
      setSelected(new Set(list));
    }).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  // ── base disc_accts 파라미터 ──────────────────────────────────
  const discParam = selected.size === acctList.length || selected.size === 0
    ? undefined
    : Array.from(selected).join(",");

  // ── cross-filter 적용 파라미터 ────────────────────────────────
  // selectedAcct가 있으면 daily/topCp/vouchers는 해당 계정으로 좁힘
  const effectiveDisc = selectedAcct ?? discParam;
  const effectiveDate = selectedDate ?? undefined;

  // ── 인터랙티브 데이터 로드 ────────────────────────────────────
  useEffect(() => {
    if (acctList.length === 0) return;
    setKpi(null); setDaily(null); setAcctBar(null); setTopCp(null); setVouchers(null); setVchPage(1);
    Promise.all([
      fetchVCHKpi(filter, effectiveDisc, effectiveDate),
      fetchVCHDaily(filter, effectiveDisc),
      fetchVCHAccountBar(filter, discParam, effectiveDate),
      fetchVCHTopCounterparty(filter, effectiveDisc, topN, effectiveDate),
      fetchVCHVouchers(filter, effectiveDisc, 1, VCH_PAGE_SIZE, effectiveDate),
    ]).then(([k, d, a, c, v]) => {
      setKpi(k as Kpi);
      setDaily(d as Daily[]);
      setAcctBar(a as AcctBar[]);
      setTopCp(c as Cp[]);
      setVouchers(v as { total: number; items: VCHVoucherItem[] });
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.baseYm, filter.periodType, discParam, topN, selectedDate, selectedAcct, acctList.length]);

  // ── 기표내역 페이지 이동 ──────────────────────────────────────
  const loadVchPage = (p: number) => {
    fetchVCHVouchers(filter, effectiveDisc, p, VCH_PAGE_SIZE, effectiveDate)
      .then(v => { setVouchers(v as { total: number; items: VCHVoucherItem[] }); setVchPage(p); })
      .catch(console.error);
  };

  // ── 계정 체크박스 ─────────────────────────────────────────────
  const toggleAcct = (acct: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(acct) ? n.delete(acct) : n.add(acct); return n; });
    setSelectedDate(null); setSelectedAcct(null);
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === acctList.length ? new Set() : new Set(acctList));
    setSelectedDate(null); setSelectedAcct(null);
  };

  // ── 차트 클릭 핸들러 ──────────────────────────────────────────
  const handleDailyClick = (_evt: unknown, elements: { index: number }[]) => {
    if (!elements.length || !daily) { setSelectedDate(null); return; }
    const date = daily[elements[0].index]?.date;
    if (!date) return;
    setSelectedDate(prev => prev === date ? null : date);
    setSelectedAcct(null);
  };
  const handleAcctClick = (_evt: unknown, elements: { index: number }[]) => {
    if (!elements.length || !acctBar) { setSelectedAcct(null); return; }
    const acct = acctBar[elements[0].index]?.disclosure_acct;
    if (!acct) return;
    setSelectedAcct(prev => prev === acct ? null : acct);
    setSelectedDate(null);
  };

  // ── 차트 색상 (선택 하이라이트) ───────────────────────────────
  const dailyColors = (daily ?? []).map(d =>
    selectedDate && d.date !== selectedDate ? ORANGE_DIM : ORANGE
  );
  const acctColors = (acctBar ?? []).map(a =>
    selectedAcct && a.disclosure_acct !== selectedAcct ? ORANGE_DIM : ORANGE
  );

  // ── 도넛 데이터 ───────────────────────────────────────────────
  const donutTop = (topCp ?? []).filter(c => c.name !== "기타");
  const donutOther = (topCp ?? []).find(c => c.name === "기타");
  const donutItems = donutOther ? [...donutTop, donutOther] : donutTop;

  return (
    <div className="wrap">

      {/* ── 헤더 + 선택 뱃지 + 계정 필터 버튼 ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div className="sec-hd" style={{ margin: 0, flex: 1 }}>전표분석내역</div>

        {/* 선택 상태 뱃지 */}
        {(selectedDate || selectedAcct) && (
          <div style={{ display: "flex", gap: 6 }}>
            {selectedDate && (
              <span style={{ fontSize: 11, background: "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 12, padding: "3px 10px", fontWeight: 600 }}>
                📅 {selectedDate}
                <button onClick={() => setSelectedDate(null)} style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", color: ORANGE, fontWeight: 700, fontSize: 11 }}>✕</button>
              </span>
            )}
            {selectedAcct && (
              <span style={{ fontSize: 11, background: "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 12, padding: "3px 10px", fontWeight: 600 }}>
                📊 {selectedAcct}
                <button onClick={() => setSelectedAcct(null)} style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", color: ORANGE, fontWeight: 700, fontSize: 11 }}>✕</button>
              </span>
            )}
          </div>
        )}

        {/* 계정 필터 버튼 */}
        <div ref={filterRef} style={{ position: "relative" }}>
          <button
            onClick={() => setFilterOpen(p => !p)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              background: filterOpen ? ORANGE : "#FFF",
              color: filterOpen ? "#FFF" : ORANGE,
              border: `1.5px solid ${ORANGE}`, borderRadius: 6, cursor: "pointer",
            }}
          >
            ☰ 계정 필터
            {selected.size < acctList.length && (
              <span style={{ background: filterOpen ? "rgba(255,255,255,0.3)" : "#FFF4EC", color: ORANGE, borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>
                {selected.size}/{acctList.length}
              </span>
            )}
          </button>

          {filterOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
              background: "#FFF", border: "1px solid #E0E0E0", borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 220, maxHeight: 360, display: "flex", flexDirection: "column",
            }}>
              <div onClick={toggleAll} style={{ padding: "9px 14px", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: "#FAFAFA", borderRadius: "8px 8px 0 0" }}>
                <Checkbox checked={selected.size === acctList.length} />
                모두 선택
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {acctList.map(acct => (
                  <div key={acct} onClick={() => toggleAcct(acct)} style={{ padding: "8px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: selected.has(acct) ? "#FFF8F3" : "#FFF", borderBottom: "1px solid #F8F8F8" }}>
                    <Checkbox checked={selected.has(acct)} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#333" }}>{acct}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 상단: 일자별 전표수 + KPI ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>일자별 전표수</div>
            {selectedAcct && <span style={{ fontSize: 10, color: "#999" }}>— {selectedAcct}</span>}
            {selectedDate && <span style={{ fontSize: 10, color: ORANGE, marginLeft: "auto" }}>클릭하여 날짜 변경</span>}
            {!selectedDate && <span style={{ fontSize: 10, color: "#bbb", marginLeft: "auto" }}>막대 클릭 → 날짜 필터</span>}
          </div>
          <div style={{ height: 160 }}>
            {daily === null ? <ChartLoading /> : (
              <Bar
                data={{
                  labels: daily.map(d => {
                    const [, m, day] = d.date.split("-");
                    return `${parseInt(m)}/${parseInt(day)}`;
                  }),
                  datasets: [{
                    label: "전표수", data: daily.map(d => d.cnt),
                    backgroundColor: dailyColors, borderRadius: 2, barPercentage: 0.8,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { title: ctx => daily[ctx[0].dataIndex]?.date ?? "", label: ctx => ` ${fmtN(ctx.parsed.y as number)}건` } },
                  },
                  scales: {
                    x: { ticks: { color: "#bbb", font: { size: 9 }, maxTicksLimit: 20 }, grid: { display: false } },
                    y: { ticks: { color: "#bbb", font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: "#f5f5f5" } },
                  },
                  onClick: (_evt, elements) => handleDailyClick(_evt, elements as { index: number }[]),
                  cursor: "pointer",
                } as Parameters<typeof Bar>[0]["options"]}
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">전표내역 요약</div>
          {kpi === null ? <KpiLoading /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "전표수",   value: fmtN(kpi.total_cnt), unit: "건",  color: "#2C2C2C" },
                { label: "차변합계", value: fmtB(kpi.dr_sum),    unit: "백만", color: BLUE },
                { label: "대변합계", value: fmtB(kpi.cr_sum),    unit: "백만", color: RED },
              ].map(({ label, value, unit, color }) => (
                <div key={label} style={{ background: "#FAFAFA", borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#999", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>
                    {value}<span style={{ fontSize: 11, color: "#bbb", marginLeft: 3 }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 중단: 계정과목별 전표수 + 상위 거래처 ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>계정과목별 전표수</div>
            {selectedDate && <span style={{ fontSize: 10, color: "#999" }}>— {selectedDate}</span>}
            {selectedAcct && <span style={{ fontSize: 10, color: ORANGE, marginLeft: "auto" }}>클릭하여 계정 변경</span>}
            {!selectedAcct && <span style={{ fontSize: 10, color: "#bbb", marginLeft: "auto" }}>막대 클릭 → 계정 필터</span>}
          </div>
          <div style={{ height: 240 }}>
            {acctBar === null ? <ChartLoading /> : (
              <Bar
                data={{
                  labels: acctBar.map(a => a.disclosure_acct),
                  datasets: [{
                    label: "전표수", data: acctBar.map(a => a.cnt),
                    backgroundColor: acctColors, borderRadius: 2, barPercentage: 0.7,
                  }],
                }}
                options={{
                  indexAxis: "y" as const,
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ` ${fmtN(ctx.parsed.x as number)}건` } },
                  },
                  scales: {
                    x: { ticks: { color: "#bbb", font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: "#f5f5f5" } },
                    y: { ticks: { color: "#444", font: { size: 10 } }, grid: { display: false } },
                  },
                  onClick: (_evt, elements) => handleAcctClick(_evt, elements as { index: number }[]),
                } as Parameters<typeof Bar>[0]["options"]}
              />
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0, flex: 1 }}>
              전표수 기준 상위 거래처
              {(selectedDate || selectedAcct) && (
                <span style={{ fontSize: 10, color: "#999", fontWeight: 400, marginLeft: 6 }}>
                  {[selectedAcct, selectedDate].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888" }}>
              상위 N
              <select value={topN} onChange={e => setTopN(Number(e.target.value))} className="fsel" style={{ width: 60, padding: "2px 4px" }}>
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ height: 220 }}>
            {topCp === null ? <ChartLoading /> : (
              <Doughnut
                data={{
                  labels: donutItems.map(c => c.name),
                  datasets: [{
                    data: donutItems.map(c => c.cnt),
                    backgroundColor: DONUT_COLORS.slice(0, donutItems.length),
                    borderWidth: 2, borderColor: "#fff", hoverOffset: 6,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  animation: false,
                  cutout: "50%",
                  layout: { padding: 55 },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx => {
                          const item = donutItems[ctx.dataIndex];
                          return item ? ` ${fmtN(item.cnt)}건 (${item.pct.toFixed(1)}%)` : "";
                        },
                      },
                    },
                  },
                }}
                plugins={[polylineLabelPlugin]}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── 기표내역 ─── */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 10 }}>
          <div className="card-title" style={{ margin: 0 }}>기표 내역</div>
          {vouchers && (
            <span style={{ fontSize: 12, color: "#aaa" }}>총 {fmtN(vouchers.total)}건</span>
          )}
          {(selectedDate || selectedAcct) && (
            <button
              onClick={() => { setSelectedDate(null); setSelectedAcct(null); }}
              style={{ marginLeft: "auto", fontSize: 11, color: "#aaa", background: "none", border: "1px solid #E0E0E0", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
            >
              필터 초기화
            </button>
          )}
        </div>

        <div style={{ height: 380, overflowY: "auto", overflowX: "auto" }}>
          {vouchers === null ? (
            <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>데이터 로딩 중...</div>
          ) : (
            <table>
              <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                <tr>
                  <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>일자</th>
                  <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>전표번호</th>
                  <th style={{ textAlign: "left" }}>계정과목</th>
                  <th style={{ textAlign: "left" }}>거래처</th>
                  <th style={{ textAlign: "left" }}>적요</th>
                  <th style={{ whiteSpace: "nowrap" }}>차변</th>
                  <th style={{ whiteSpace: "nowrap" }}>대변</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.items.map((v, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap", color: "#888", fontSize: 11 }}>{v.date}</td>
                    <td style={{ color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>{v.voucher_no}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{v.account_name}</td>
                    <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#666" }}>{v.description}</td>
                    <td style={{ textAlign: "right", color: v.dr_cr === "차변" ? BLUE : "#DDD", whiteSpace: "nowrap" }}>
                      {v.dr_cr === "차변" ? fmtN(v.amount) : "-"}
                    </td>
                    <td style={{ textAlign: "right", color: v.dr_cr === "대변" ? RED : "#DDD", whiteSpace: "nowrap" }}>
                      {v.dr_cr === "대변" ? fmtN(v.amount) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: "#FFF7F0" }}>
                  <td colSpan={5}>합계</td>
                  <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap" }}>
                    {fmtN(vouchers.items.filter(v => v.dr_cr === "차변").reduce((s, v) => s + v.amount, 0))}
                  </td>
                  <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>
                    {fmtN(vouchers.items.filter(v => v.dr_cr === "대변").reduce((s, v) => s + v.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {vouchers && Math.ceil(vouchers.total / VCH_PAGE_SIZE) > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", justifyContent: "center" }}>
            <button className="ftbtn" disabled={vchPage <= 1} onClick={() => loadVchPage(vchPage - 1)}>◀ 이전</button>
            <span style={{ color: "#aaa", fontSize: 13 }}>{vchPage} / {Math.ceil(vouchers.total / VCH_PAGE_SIZE)}</span>
            <button className="ftbtn" disabled={vchPage >= Math.ceil(vouchers.total / VCH_PAGE_SIZE)} onClick={() => loadVchPage(vchPage + 1)}>다음 ▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 체크박스 ────────────────────────────────────────────────────
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span style={{
      width: 14, height: 14, border: `1.5px solid ${checked ? ORANGE : "#CCC"}`,
      borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: checked ? ORANGE : "#FFF", flexShrink: 0,
    }}>
      {checked && <span style={{ color: "#FFF", fontSize: 10, lineHeight: 1 }}>✓</span>}
    </span>
  );
}

function ChartLoading() {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 12 }}>
      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 8 }} />
      로딩 중...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function KpiLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: "#F5F5F5", borderRadius: 8, height: 58, animation: "pulse 1.2s ease-in-out infinite" }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
