"use client";

import Loading from "@/components/ui/Loading";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  fetchVCHDisclosureAccts, fetchVCHKpi, fetchVCHDaily,
  fetchVCHAccountBar, fetchVCHTopCounterparty, fetchVCHVouchers,
  VCHVoucherItem,
} from "@/lib/api";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarController, BarElement,
  Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import ReactECharts from "echarts-for-react";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend);

const ORANGE     = "#E87722";
const ORANGE_DIM = "rgba(232,119,34,0.25)";
const BLUE       = "rgba(37,99,235,1)";
const RED        = "rgba(220,38,38,1)";

const TREEMAP_COLORS = [
  "#E87722","#2563EB","#16A34A","#9333EA","#EF4444",
  "#0891B2","#D97706","#059669","#7C3AED","#DB2777","#94a3b8",
];

const fmtN = (n: number) => n.toLocaleString("ko-KR");
const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

interface Kpi     { total_cnt: number; dr_sum: number; cr_sum: number }
interface Daily   { date: string; cnt: number }
interface AcctBar { disclosure_acct: string; cnt: number }
interface Cp      { name: string; cnt: number; pct: number }

const PAGE = "전표분석내역";

export default function VCHAnalysis() {
  const isDark = useDarkMode();
  const filter = useFilter();
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);

  const [acctList,   setAcctList]   = useState<string[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef   = useRef<HTMLDivElement>(null);
  const vchTableRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedAcct, setSelectedAcct] = useState<string | null>(null);
  const [selectedCp,   setSelectedCp]   = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCp || !vchTableRef.current) return;
    const row = vchTableRef.current.querySelector(`tr[data-cp="${CSS.escape(selectedCp)}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCp]);

  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd,   setRangeEnd]   = useState(0);

  const [kpi,     setKpi]     = useState<Kpi | null>(null);
  const [daily,   setDaily]   = useState<Daily[] | null>(null);
  const [acctBar, setAcctBar] = useState<AcctBar[] | null>(null);
  const [topCp,   setTopCp]   = useState<Cp[] | null>(null);
  const [topN,    setTopN]    = useState(10);
  const [vouchers, setVouchers] = useState<{ total: number; items: VCHVoucherItem[] } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    if (filterOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  useEffect(() => {
    setSelectedDate(null); setSelectedAcct(null);
    fetchVCHDisclosureAccts(filter).then(list => {
      setAcctList(list);
      setSelected(new Set(list));
    }).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  const discParam = selected.size === acctList.length || selected.size === 0
    ? undefined : Array.from(selected).join(",");

  const effectiveDisc = selectedAcct ?? discParam;
  const effectiveDate = selectedDate ?? undefined;

  useEffect(() => {
    if (acctList.length === 0) return;
    setKpi(null); setDaily(null); setAcctBar(null); setTopCp(null); setVouchers(null);
    Promise.all([
      fetchVCHKpi(filter, effectiveDisc, effectiveDate),
      fetchVCHDaily(filter, effectiveDisc),
      fetchVCHAccountBar(filter, discParam, effectiveDate),
      fetchVCHTopCounterparty(filter, effectiveDisc, topN, effectiveDate),
      fetchVCHVouchers(filter, effectiveDisc, 1, 9999, effectiveDate),
    ]).then(([k, d, a, c, v]) => {
      setKpi(k as Kpi);
      const rows = d as Daily[];
      setDaily(rows);
      setRangeStart(0);
      setRangeEnd(rows.length > 0 ? rows.length - 1 : 0);
      setAcctBar(a as AcctBar[]);
      setTopCp(c as Cp[]);
      setVouchers(v as { total: number; items: VCHVoucherItem[] });
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.baseYm, filter.periodType, discParam, topN, selectedDate, selectedAcct, acctList.length]);

  const toggleAcct = (acct: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(acct) ? n.delete(acct) : n.add(acct); return n; });
    setSelectedDate(null); setSelectedAcct(null);
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === acctList.length ? new Set() : new Set(acctList));
    setSelectedDate(null); setSelectedAcct(null);
  };

  const handleDailyClick = (_evt: unknown, elements: { index: number }[]) => {
    if (!elements.length || !daily) { setSelectedDate(null); return; }
    const date = daily[rangeStart + elements[0].index]?.date;
    if (!date) return;
    setSelectedDate(prev => prev === date ? null : date);
  };
  const handleAcctClick = (_evt: unknown, elements: { index: number }[]) => {
    if (!elements.length || !acctBar) { setSelectedAcct(null); return; }
    const acct = acctBar[elements[0].index]?.disclosure_acct;
    if (!acct) return;
    setSelectedAcct(prev => prev === acct ? null : acct);
  };

  const visibleDaily  = (daily ?? []).slice(rangeStart, rangeEnd + 1);
  const totalDailyLen = (daily ?? []).length;

  const dailyColors = visibleDaily.map(d =>
    selectedDate && d.date !== selectedDate ? ORANGE_DIM : ORANGE
  );
  const acctColors = (acctBar ?? []).map(a =>
    selectedAcct && a.disclosure_acct !== selectedAcct ? ORANGE_DIM : ORANGE
  );

  const treemapData = (topCp ?? [])
    .filter(c => c.name !== "기타")
    .map((c, i) => ({
      name: c.name, value: c.cnt, pct: c.pct,
      itemStyle: { color: TREEMAP_COLORS[i % TREEMAP_COLORS.length] },
    }));

  const firstCpIndices = useMemo(() => {
    const seen = new Set<string>();
    const result = new Set<number>();
    (vouchers?.items ?? []).forEach((v, i) => {
      if (!seen.has(v.counterparty)) { seen.add(v.counterparty); result.add(i); }
    });
    return result;
  }, [vouchers]);

  // 다크모드 색상
  const tickClr      = isDark ? "#9198A8" : "#bbb";
  const gridClr      = isDark ? "#2E3039" : "#f5f5f5";
  const acctTickClr  = isDark ? "#C8CCDA" : "#444";
  const tipBg        = isDark ? "#1C1F26" : "#fff";
  const tipBdr       = isDark ? "#2E3039" : "#eee";
  const tipTxt       = isDark ? "#E2E5EC" : "#333";
  const subTxt       = isDark ? "#9198A8" : "#999";
  const dimTxt       = isDark ? "#5A6070" : "#aaa";
  const zeroClr      = isDark ? "#3A3F4A" : "#DDD";
  const valTxt       = isDark ? "#C8CCDA" : "#666";
  const kpiCardBg    = isDark ? "#252830" : "#FAFAFA";
  const kpiValClr    = isDark ? "#E2E5EC" : "#2C2C2C";
  const sliderTrack  = isDark ? "#2E3039" : "#EEE";
  const dropBg       = isDark ? "#1C1F26" : "#FFF";
  const dropBdr      = isDark ? "#2E3039" : "#E0E0E0";
  const dropHdrBg    = isDark ? "#252830" : "#FAFAFA";
  const dropRowBg    = isDark ? "#1C1F26" : "#FFF";
  const dropRowSel   = isDark ? "rgba(232,119,34,0.10)" : "#FFF8F3";
  const dropDivClr   = isDark ? "#252830" : "#F8F8F8";
  const theadBg      = isDark ? "#1C1F26" : "#FFF";
  const tfootBg      = isDark ? "rgba(232,119,34,0.10)" : "#FFF7F0";
  const btnBdr       = isDark ? "#2E3039" : "#E0E0E0";
  const handleBg     = isDark ? "#252830" : "#fff";
  const treemapBdr   = isDark ? "#1C1F26" : "#fff";

  const barTooltipOpts = {
    backgroundColor: tipBg, borderColor: tipBdr, borderWidth: 1,
    titleColor: tipTxt, bodyColor: tipTxt,
  };

  return (
    <div className="wrap">

      {/* ── 상단: KPI + 일자별 전표수 ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div className="card-title">전표내역 요약</div>
          {kpi === null ? <KpiLoading isDark={isDark} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "전표수",   value: fmtN(kpi.total_cnt), unit: "건",  color: kpiValClr },
                { label: "차변합계", value: fmtB(kpi.dr_sum),    unit: "백만", color: BLUE },
                { label: "대변합계", value: fmtB(kpi.cr_sum),    unit: "백만", color: RED },
              ].map(({ label, value, unit, color }) => (
                <div key={label} style={{ background: kpiCardBg, borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: subTxt, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>
                    {value}<span style={{ fontSize: 11, color, marginLeft: 3 }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>일자별 전표수</div>
            {selectedAcct && <span style={{ fontSize: 10, color: subTxt }}>— {selectedAcct}</span>}
            {selectedDate && (
              <span style={{ fontSize: 11, background: isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 12, padding: "2px 8px", fontWeight: 600 }}>
                {selectedDate}
                <button onClick={() => setSelectedDate(null)} style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: ORANGE, fontWeight: 700, fontSize: 11 }}>✕</button>
              </span>
            )}
            {selectedAcct && (
              <span style={{ fontSize: 11, background: isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 12, padding: "2px 8px", fontWeight: 600 }}>
                {selectedAcct}
                <button onClick={() => setSelectedAcct(null)} style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: ORANGE, fontWeight: 700, fontSize: 11 }}>✕</button>
              </span>
            )}
            <div style={{ flex: 1 }} />
            {!selectedDate && <span style={{ fontSize: 10, color: dimTxt }}>막대 클릭 → 날짜 필터</span>}
            {/* 계정 필터 버튼 */}
            <div ref={filterRef} style={{ position: "relative" }}>
              <button
                onClick={() => setFilterOpen(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", fontSize: 11, fontWeight: 600,
                  background: filterOpen ? ORANGE : (isDark ? "#1C1F26" : "#FFF"),
                  color: filterOpen ? "#FFF" : ORANGE,
                  border: `1.5px solid ${ORANGE}`, borderRadius: 6, cursor: "pointer",
                }}
              >
                ☰ 계정 필터
                {selected.size < acctList.length && (
                  <span style={{ background: filterOpen ? "rgba(255,255,255,0.3)" : (isDark ? "rgba(232,119,34,0.2)" : "#FFF4EC"), color: ORANGE, borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>
                    {selected.size}/{acctList.length}
                  </span>
                )}
              </button>
              {filterOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                  background: dropBg, border: `1px solid ${dropBdr}`, borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.24)",
                  minWidth: 220, maxHeight: 360, display: "flex", flexDirection: "column",
                }}>
                  <div onClick={toggleAll} style={{ padding: "9px 14px", borderBottom: `1px solid ${dropBdr}`, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: dropHdrBg, borderRadius: "8px 8px 0 0", color: tipTxt }}>
                    <Checkbox checked={selected.size === acctList.length} isDark={isDark} />
                    모두 선택
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {acctList.map(acct => (
                      <div key={acct} onClick={() => toggleAcct(acct)} style={{ padding: "8px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: selected.has(acct) ? dropRowSel : dropRowBg, borderBottom: `1px solid ${dropDivClr}` }}>
                        <Checkbox checked={selected.has(acct)} isDark={isDark} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: tipTxt }}>{acct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 160 }}>
            {daily === null ? <ChartLoading isDark={isDark} /> : (
              <Bar
                data={{
                  labels: visibleDaily.map(d => {
                    const [, m, day] = d.date.split("-");
                    return `${parseInt(m)}/${parseInt(day)}`;
                  }),
                  datasets: [{
                    label: "전표수", data: visibleDaily.map(d => d.cnt),
                    backgroundColor: dailyColors, borderRadius: 2, barPercentage: 0.8,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { ...barTooltipOpts, callbacks: { title: ctx => visibleDaily[ctx[0].dataIndex]?.date ?? "", label: ctx => ` ${fmtN(ctx.parsed.y as number)}건` } },
                  },
                  scales: {
                    x: { ticks: { color: tickClr, font: { size: 9 }, maxTicksLimit: 20 }, grid: { display: false } },
                    y: { ticks: { color: tickClr, font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: gridClr } },
                  },
                  onClick: (_evt, elements) => handleDailyClick(_evt, elements as { index: number }[]),
                  cursor: "pointer",
                } as Parameters<typeof Bar>[0]["options"]}
              />
            )}
          </div>
          {/* ── X축 슬라이더 ── */}
          {daily !== null && totalDailyLen > 1 && (
            <div style={{ marginTop: 10, paddingBottom: 2 }}>
              <div style={{ position: "relative", height: 20 }}>
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 0, right: 0, height: 4, background: sliderTrack, borderRadius: 2 }} />
                <div style={{
                  position: "absolute", top: "50%", transform: "translateY(-50%)",
                  left: `${rangeStart / (totalDailyLen - 1) * 100}%`,
                  right: `${(1 - rangeEnd / (totalDailyLen - 1)) * 100}%`,
                  height: 4, background: ORANGE, borderRadius: 2, opacity: 0.6,
                }} />
                <input type="range" min={0} max={totalDailyLen - 1} value={rangeStart}
                  onChange={e => { const v = +e.target.value; if (v < rangeEnd) setRangeStart(v); }}
                  style={{ position: "absolute", width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer", zIndex: rangeStart > totalDailyLen - 10 ? 5 : 3 }}
                />
                <input type="range" min={0} max={totalDailyLen - 1} value={rangeEnd}
                  onChange={e => { const v = +e.target.value; if (v > rangeStart) setRangeEnd(v); }}
                  style={{ position: "absolute", width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer", zIndex: 4 }}
                />
                <div style={{ position: "absolute", top: "50%", transform: "translate(-50%, -50%)", left: `${rangeStart / (totalDailyLen - 1) * 100}%`, width: 12, height: 12, borderRadius: "50%", background: handleBg, border: `2px solid ${ORANGE}`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: "50%", transform: "translate(-50%, -50%)", left: `${rangeEnd / (totalDailyLen - 1) * 100}%`, width: 12, height: 12, borderRadius: "50%", background: handleBg, border: `2px solid ${ORANGE}`, pointerEvents: "none" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: tickClr, marginTop: 4 }}>
                <span>{daily[rangeStart]?.date}</span>
                <span>{daily[rangeEnd]?.date}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 중단: 계정과목별 전표수 + 상위 거래처 ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>계정과목별 전표수</div>
            {selectedDate && <span style={{ fontSize: 10, color: subTxt }}>— {selectedDate}</span>}
            {selectedAcct && <span style={{ fontSize: 10, color: ORANGE, marginLeft: "auto" }}>클릭하여 계정 변경</span>}
            {!selectedAcct && <span style={{ fontSize: 10, color: dimTxt, marginLeft: "auto" }}>막대 클릭 → 계정 필터</span>}
          </div>
          <div style={{ height: 240 }}>
            {acctBar === null ? <ChartLoading isDark={isDark} /> : (
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
                    tooltip: { ...barTooltipOpts, callbacks: { label: ctx => ` ${fmtN(ctx.parsed.x as number)}건` } },
                  },
                  scales: {
                    x: { ticks: { color: tickClr, font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: gridClr } },
                    y: { ticks: { color: acctTickClr, font: { size: 10 } }, grid: { display: false }, afterFit: (axis: { width: number }) => { axis.width = 130; } },
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
                <span style={{ fontSize: 10, color: subTxt, fontWeight: 400, marginLeft: 6 }}>
                  {[selectedAcct, selectedDate].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: subTxt }}>
              상위 N
              <select value={topN} onChange={e => setTopN(Number(e.target.value))} className="fsel" style={{ width: 60, padding: "2px 4px" }}>
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ height: 260 }}>
            {topCp === null ? <ChartLoading isDark={isDark} /> : (
              <ReactECharts
                style={{ height: "100%", width: "100%" }}
                onEvents={{
                  click: (p: { name: string }) => {
                    if (p.name === "root") return;
                    setSelectedCp(prev => prev === p.name ? null : p.name);
                  },
                }}
                option={{
                  backgroundColor: "transparent",
                  animation: false,
                  tooltip: {
                    backgroundColor: tipBg,
                    borderColor: tipBdr,
                    textStyle: { color: tipTxt, fontSize: 11 },
                    formatter: (p: { name: string; value: number; data?: { pct?: number } }) => {
                      if (!p.data?.pct) return "";
                      return `${p.name}<br/>${fmtN(p.value)}건 (${p.data.pct.toFixed(1)}%)`;
                    },
                  },
                  series: [{
                    type: "treemap",
                    roam: false,
                    nodeClick: false,
                    breadcrumb: { show: false },
                    top: 0, left: 0, right: 0, bottom: 0,
                    width: "100%", height: "100%",
                    label: {
                      show: true,
                      formatter: (p: { name: string; data?: { pct?: number } }) =>
                        p.data?.pct ? `${p.name}\n${p.data.pct.toFixed(1)}%` : p.name,
                      fontSize: 11, color: "#fff", fontWeight: 600,
                    },
                    upperLabel: { show: false },
                    visibleMin: 300,
                    itemStyle: { borderWidth: 2, borderColor: treemapBdr, gapWidth: 2 },
                    data: [{ name: "root", children: treemapData }],
                  }],
                }}
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
            <span style={{ fontSize: 12, color: dimTxt }}>총 {fmtN(vouchers.total)}건</span>
          )}
          {(selectedDate || selectedAcct) && (
            <button
              onClick={() => { setSelectedDate(null); setSelectedAcct(null); }}
              style={{ marginLeft: "auto", fontSize: 11, color: dimTxt, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
            >
              필터 초기화
            </button>
          )}
        </div>

        <div ref={vchTableRef} style={{ height: 380, overflowY: "auto", overflowX: "auto" }}>
          {vouchers === null ? (
            <Loading />
          ) : (
            <table>
              <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
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
                {vouchers.items.map((v, i) => {
                  const cpIdx = treemapData.findIndex(d => d.name === v.counterparty);
                  const cpColor = cpIdx >= 0 ? TREEMAP_COLORS[cpIdx % TREEMAP_COLORS.length] : null;
                  const isHighlighted = selectedCp !== null && v.counterparty === selectedCp;
                  return (
                    <tr key={i}
                      data-cp={firstCpIndices.has(i) ? v.counterparty : undefined}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        triggerComment(
                          {
                            page: PAGE, label: v.voucher_no, value: `${fmtN(v.amount)}원`,
                            bodyTemplate: `페이지: ${PAGE}\n일자: ${v.date}\n전표번호: ${v.voucher_no}\n계정과목: ${v.account_name}\n거래처: ${v.counterparty}\n적요: ${v.description}\n금액: ${fmtN(v.amount)}원\n\n문의내용:\n`,
                          },
                          { top: rect.top, right: rect.right },
                          e.currentTarget
                        );
                      }}
                      style={{ cursor: "pointer", ...(isHighlighted && cpColor ? { background: cpColor + "22" } : {}) }}>
                      <td style={{ whiteSpace: "nowrap", color: subTxt, fontSize: 11 }}>{v.date}</td>
                      <td style={{ color: subTxt, fontSize: 11, whiteSpace: "nowrap" }}>
                        {v.voucher_no}
                        {ck.has(commentKey(PAGE, v.voucher_no)) && <CommentDot inline inquiryId={ck.get(commentKey(PAGE, v.voucher_no))!} />}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{v.account_name}</td>
                      <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: valTxt }}>{v.description}</td>
                      <td style={{ textAlign: "right", color: v.dr_cr === "차변" ? BLUE : zeroClr, whiteSpace: "nowrap" }}>
                        {v.dr_cr === "차변" ? fmtN(v.amount) : "-"}
                      </td>
                      <td style={{ textAlign: "right", color: v.dr_cr === "대변" ? RED : zeroClr, whiteSpace: "nowrap" }}>
                        {v.dr_cr === "대변" ? fmtN(v.amount) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: tfootBg }}>
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
      </div>
    </div>
  );
}

// ── 체크박스 ────────────────────────────────────────────────────
function Checkbox({ checked, isDark }: { checked: boolean; isDark: boolean }) {
  return (
    <span style={{
      width: 14, height: 14,
      border: `1.5px solid ${checked ? ORANGE : (isDark ? "#3A3F4A" : "#CCC")}`,
      borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: checked ? ORANGE : (isDark ? "#252830" : "#FFF"),
      flexShrink: 0,
    }}>
      {checked && <span style={{ color: "#FFF", fontSize: 10, lineHeight: 1 }}>✓</span>}
    </span>
  );
}

function ChartLoading({ isDark = false }: { isDark?: boolean }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#5A6070" : "#bbb", fontSize: 12 }}>
      <div className="spinner" style={{ width:14, height:14, marginRight: 8 }} />
      로딩 중...
    </div>
  );
}

function KpiLoading({ isDark = false }: { isDark?: boolean }) {
  const bg = isDark ? "#252830" : "#F5F5F5";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: bg, borderRadius: 8, height: 58, animation: "pulse 1.2s ease-in-out infinite" }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
