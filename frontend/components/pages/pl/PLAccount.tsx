"use client";

import Loading from "@/components/ui/Loading";
import DrillButtons from "@/components/ui/DrillButtons";
import { useEffect, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { fetchPLAccount, fetchPLAccountDetail } from "@/lib/api";
import { fmtByUnit, unitSuffix, useAmountFormat } from "@/lib/fmtAmount";
import { useDarkMode } from "@/hooks/useDarkMode";
import ReactECharts from "echarts-for-react";

const fmt    = (n: number) => Math.round(n).toLocaleString("ko-KR");

const PL_ORDER = ["매출액","매출원가","판매비와관리비","기타수익","기타비용","금융수익","금융비용","법인세비용"];

interface AcctRow {
  disclosure_acct: string; mgmt_acct: string; account_name: string;
  category: string; current: number; prior: number; change_pct: number;
}
interface Voucher { date: string; voucher_no: string; counterparty: string; description: string; amount: number; dr_cr: string }
interface Detail {
  mgmt_acct: string;
  counterparty: { name: string; cur: number; pri: number; change: number }[];
  cur_vouchers: Voucher[];
  pri_vouchers: Voucher[];
}

const DONUT_COLORS = [
  "#E87722","#F5A623","#D5476E","#2563EB","#16A34A",
  "#7C3AED","#0891B2","#EF4444","#78716C","#CA8A04",
];

// ── 상위 거래처 당기 비중 (ECharts 도넛) ────────────────────────
function TopCounterpartyPie({
  data, isDark = false, selectedCp = null, onCpClick,
}: {
  data: Detail["counterparty"];
  isDark?: boolean;
  selectedCp?: string | null;
  onCpClick?: (name: string | null) => void;
}) {
  const ORANGE = "#E87722";
  const { fmtAmt, unitLabel } = useAmountFormat();
  const tooltipBg  = isDark ? "#1C1F26" : "#fff";
  const tooltipBdr = isDark ? "#2E3039" : "#eee";
  const tooltipTxt = isDark ? "#E2E5EC" : "#333";
  const borderClr  = isDark ? "#1C1F26" : "#fff";

  const [hoverDonut, setHoverDonut] = useState<{ name: string; value: number; percent: number } | null>(null);
  const selectedDonutRef = useRef<{ name: string; value: number; percent: number } | null>(null);

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: tooltipBg,
      borderColor: tooltipBdr,
      textStyle: { color: tooltipTxt, fontSize: 11 },
      position: (point: number[], _p: unknown, _d: unknown, _r: unknown, size: { contentSize: number[]; viewSize: number[] }) => {
        const [x, y] = point;
        const [w, h] = size.contentSize;
        const isTop = y < size.viewSize[1] / 2;
        return [x - w / 2, isTop ? y - h - 16 : y + 16];
      },
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/>${fmtAmt(p.value)}${unitLabel} (${p.percent.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`,
    },
    legend: { show: false },
    graphic: hoverDonut ? [{
      type: "group",
      left: "center",
      top: "center",
      children: [
        { type: "text", z: 100, left: "center", top: -22, style: { text: hoverDonut.name.length > 10 ? hoverDonut.name.slice(0, 10) + "…" : hoverDonut.name, font: `700 12px sans-serif`, fill: isDark ? "#E2E5EC" : "#222", textAlign: "center" } },
        { type: "text", z: 100, left: "center", top: 2,   style: { text: `${fmtAmt(hoverDonut.value)}${unitLabel}`, font: `800 15px sans-serif`, fill: ORANGE, textAlign: "center" } },
        { type: "text", z: 100, left: "center", top: 24,  style: { text: `(${hoverDonut.percent.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`, font: `400 11px sans-serif`, fill: isDark ? "#9198A8" : "#888", textAlign: "center" } },
      ],
    }] : [],
    series: [{
      name: "당기 비중",
      type: "pie",
      selectedMode: "single",
      radius: ["38%", "55%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      minShowLabelAngle: 20,
      itemStyle: { borderRadius: 6, borderColor: borderClr, borderWidth: 2 },
      label: {
        show: true,
        position: "outside",
        formatter: (p: { name: string; percent: number }) => {
          const n = p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name;
          return `${n}\n${p.percent.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
        },
        fontSize: 10,
        lineHeight: 15,
        color: isDark ? "#C8CDD8" : "#444",
      },
      emphasis: {
        label: { show: false },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.28)" },
      },
      labelLine: { show: true, length: 8, length2: 12 },
      data: data.map((d, i) => ({
        value: Math.abs(d.cur),
        name: d.name,
        selected: d.name === selectedCp,
        itemStyle: {
          color: DONUT_COLORS[i % DONUT_COLORS.length],
          opacity: selectedCp && d.name !== selectedCp ? 0.35 : 1,
        },
      })),
    }],
  };

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: 380 }}
      notMerge
      onEvents={{
        click: (params: { name: string; value: number; percent: number }) => {
          const isDeselecting = params.name === selectedCp;
          onCpClick?.(isDeselecting ? null : params.name);
          const info = isDeselecting ? null : { name: params.name, value: params.value, percent: params.percent };
          selectedDonutRef.current = info;
          setHoverDonut(info);
        },
        mouseover: (p: { name: string; value: number; percent: number }) => {
          if (p.name) setHoverDonut({ name: p.name, value: p.value, percent: p.percent });
        },
        mouseout: () => setHoverDonut(selectedDonutRef.current),
      }}
    />
  );
}

// ── 거래처별 당기/전기 증감 바 ────────────────────────────────
function CounterpartyChangeBar({ data, isDark = false, selectedCp = null }: { data: Detail["counterparty"]; isDark?: boolean; selectedCp?: string | null }) {
  const { fmtAmt, unitLabel } = useAmountFormat();
  const maxVal    = Math.max(...data.flatMap(d => [Math.abs(d.cur), Math.abs(d.pri)]), 1);
  const trackBg   = isDark ? "#252830" : "#F0F0F0";
  const priBarBg  = isDark ? "rgba(100,110,130,0.55)" : "rgba(160,160,160,0.4)";
  const priBarBdr = isDark ? "#3A3F4A" : "#D0D0D0";
  const labelClr  = isDark ? "#9198A8" : "#555";
  const valClr    = isDark ? "#7A8295" : "#777";
  const legendClr = isDark ? "#9198A8" : "#888";

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 10, color: legendClr, justifyContent: "flex-end" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#E87722", borderRadius: 2 }} />당기금액
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: priBarBg, border: `1px solid ${priBarBdr}`, borderRadius: 2 }} />전기금액
        </span>
      </div>
      {data.map((d) => {
        const curPct = Math.abs(d.cur) / maxVal * 100;
        const priPct = Math.abs(d.pri) / maxVal * 100;
        const isSelected = selectedCp === d.name;
        const isDimmed   = selectedCp !== null && !isSelected;
        return (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, opacity: isDimmed ? 0.3 : 1, transition: "opacity .2s" }}>
            <div style={{ width: 140, fontSize: 11, color: isSelected ? "#E87722" : labelClr, fontWeight: isSelected ? 700 : undefined, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ flex: 1, position: "relative", height: 28 }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 12, background: trackBg, borderRadius: 3 }}>
                <div style={{ width: `${priPct}%`, height: "100%", background: priBarBg, border: `1px solid ${priBarBdr}`, borderRadius: 3, boxSizing: "border-box" }} />
              </div>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, background: trackBg, borderRadius: 3 }}>
                <div style={{ width: `${curPct}%`, height: "100%", background: "#E87722", borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ width: 70, fontSize: 10, color: valClr, textAlign: "right", flexShrink: 0, lineHeight: 1.6 }}>
              <div style={{ color: "#E87722", fontWeight: 700 }}>{fmtAmt(Math.abs(d.cur))}{unitLabel}</div>
              <div>{fmtAmt(Math.abs(d.pri))}{unitLabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PLAccount() {
  const isDark  = useDarkMode();
  const filter  = useFilter();
  const { amountUnit } = useFilter();
  const fmt = (n: number) => fmtByUnit(n, amountUnit);
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const [rows,       setRows]       = useState<AcctRow[] | null>(null);
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [selected,   setSelected]   = useState<string | null>(null);
  const [detail,     setDetail]     = useState<Detail | null>(null);
  const [loadingD,   setLoadingD]   = useState(false);
  const [leftH,      setLeftH]      = useState<number | undefined>(undefined);
  const [selectedCp, setSelectedCp] = useState<string | null>(null);
  const leftRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => setLeftH(entries[0].contentRect.height));
    obs.observe(el);
    return () => obs.disconnect();
  }, [selected]);

  useEffect(() => {
    setRows(null); setSelected(null); setDetail(null);
    fetchPLAccount(filter).then((d) => setRows(d as AcctRow[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  useEffect(() => {
    setSelectedCp(null);
    if (!selected) { setDetail(null); return; }
    setLoadingD(true);
    fetchPLAccountDetail(filter, selected)
      .then(d => { setDetail(d as Detail); setLoadingD(false); })
      .catch(() => setLoadingD(false));
  }, [selected, filter.baseYm, filter.periodType]);

  if (!rows) return <Loading />;

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));
  const selectMgmt = (mgmt: string) => setSelected(prev => prev === mgmt ? null : mgmt);

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    orderedDisc.forEach(disc => {
      next[`d-${disc}`] = true;
      Object.keys(byDisclosure[disc] || {}).forEach(mgmt => {
        next[`m-${disc}-${mgmt}`] = true;
      });
    });
    setExpanded(next);
  };
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    orderedDisc.forEach(disc => {
      next[`d-${disc}`] = false;
      Object.keys(byDisclosure[disc] || {}).forEach(mgmt => {
        next[`m-${disc}-${mgmt}`] = false;
      });
    });
    setExpanded(next);
  };

  const byDisclosure = rows.reduce<Record<string, Record<string, AcctRow[]>>>((acc, r) => {
    if (!acc[r.disclosure_acct]) acc[r.disclosure_acct] = {};
    if (!acc[r.disclosure_acct][r.mgmt_acct]) acc[r.disclosure_acct][r.mgmt_acct] = [];
    acc[r.disclosure_acct][r.mgmt_acct].push(r);
    return acc;
  }, {});
  const orderedDisc = PL_ORDER.filter(d => byDisclosure[d]);

  const month = filter.baseYm.split("-")[1].replace(/^0/, "");
  const periodLabel = filter.periodType === "cumulative" ? `${month}월 누적` : `${month}월 당월`;

  const selRows = selected ? rows.filter(r => r.mgmt_acct === selected) : [];
  const selCur  = selRows.reduce((s, r) => s + r.current, 0);
  const selPri  = selRows.reduce((s, r) => s + r.prior, 0);
  const selChg  = selCur - selPri;

  // 다크모드 테이블 행 색상
  const rowMgmtBg     = isDark ? "rgba(232,119,34,0.10)" : "#FFF8F3";
  const rowMgmtActive = isDark ? "rgba(232,119,34,0.18)" : "#FFF4EC";
  const rowAcctBg     = isDark ? "#13151A"               : "#FFFAF6";
  const rowAcctClr    = isDark ? "#5A6070"               : "#999";
  const btnBdr        = isDark ? "#2E3039"               : "#E0E0E0";
  const btnClr        = isDark ? "#9198A8"               : "#aaa";
  const arrowClr      = isDark ? "#5A6070"               : "#bbb";
  const kpiCardBg     = isDark ? "#252830"               : "#F9F9F9";
  const kpiLabelClr   = isDark ? "#9198A8"               : "#aaa";
  const kpiValClr     = isDark ? "#E2E5EC"               : "#2C2C2C";

  return (
    <div className="wrap">

      <div style={{ display: "grid", gridTemplateColumns: selected ? "2fr 3fr" : "1fr", gap: 14, alignItems: "start" }}>

        {/* ── 손익계산서 테이블 ── */}
        <div ref={leftRef} className="card" style={{ minWidth: 0, position: "relative" }}>
          {selected && (
            <button
              onClick={() => { setSelected(null); setDetail(null); }}
              style={{ position: "absolute", top: 12, right: 12, fontSize: 10, color: btnClr, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", zIndex: 1 }}
            >선택 해제</button>
          )}
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>손익항목</div>
            <DrillButtons onExpandAll={expandAll} onCollapseAll={collapseAll} isDark={isDark} />
          </div>
          {!selected && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: isDark ? "rgba(232,119,34,0.10)" : "rgba(232,119,34,0.07)",
              borderRadius: 6,
              padding: "7px 12px", marginBottom: 10, fontSize: 11, color: "#E87722",
            }}>
              <span style={{ fontSize: 14 }}>👆</span>
              계정명을 클릭하면 상세 확인, 숫자를 클릭하면 코멘트를 달 수 있습니다.
            </div>
          )}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "center" }}>계정</th>
                  <th style={{ textAlign: "center" }}>당기<span style={{ fontSize: 9, fontWeight: 400, color: isDark ? "#5A6070" : "#bbb", marginLeft: 3 }}>({unitSuffix(amountUnit)})</span></th>
                  <th style={{ textAlign: "center" }}>전기<span style={{ fontSize: 9, fontWeight: 400, color: isDark ? "#5A6070" : "#bbb", marginLeft: 3 }}>({unitSuffix(amountUnit)})</span></th>
                  <th style={{ textAlign: "center" }}>증감률</th>
                </tr>
              </thead>
              <tbody>
                {orderedDisc.map(disc => {
                  const mgmtMap = byDisclosure[disc];
                  const discCur = Object.values(mgmtMap).flat().reduce((s, r) => s + r.current, 0);
                  const discPri = Object.values(mgmtMap).flat().reduce((s, r) => s + r.prior, 0);
                  const discChg = discPri ? (discCur - discPri) / Math.abs(discPri) : 0;
                  const discKey = `d-${disc}`;
                  const discOpen = expanded[discKey] ?? true;

                  return [
                    <tr key={discKey} className="tr-sum" style={{ cursor: "pointer" }} onClick={() => toggle(discKey)}>
                      <td>{discOpen ? "▼" : "▶"} {disc}</td>
                      <td>{fmt(discCur)}</td>
                      <td>{fmt(discPri)}</td>
                      <td className={discChg >= 0 ? "up-t" : "dn-t"}>
                        {discChg >= 0 ? "▲" : "▼"}{Math.abs(discChg * 100).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </td>
                    </tr>,
                    ...(!discOpen ? [] : Object.entries(mgmtMap).map(([mgmt, accts]) => {
                      const mgmtCur = accts.reduce((s, r) => s + r.current, 0);
                      const mgmtPri = accts.reduce((s, r) => s + r.prior, 0);
                      const mgmtChg = mgmtPri ? (mgmtCur - mgmtPri) / Math.abs(mgmtPri) : 0;
                      const mgmtKey = `m-${disc}-${mgmt}`;
                      const mgmtOpen = expanded[mgmtKey];
                      const isActive = selected === mgmt;

                      const cmtCellStyle = (label: string): React.CSSProperties => ({
                        textAlign: "right", cursor: "pointer",
                        background: ck.has(commentKey("PL 계정분석", label))
                          ? (isDark ? "rgba(232,119,34,0.12)" : "rgba(232,119,34,0.06)") : undefined,
                      });
                      return [
                        <tr
                          key={mgmtKey}
                          style={{
                            background: isActive ? rowMgmtActive : rowMgmtBg,
                            borderLeft: "3px solid transparent",
                          }}
                        >
                          <td className="td-s1" style={{ color: isActive ? "#E87722" : undefined, fontWeight: isActive ? 700 : undefined, cursor: "pointer" }}
                            onClick={() => selectMgmt(mgmt)}>
                            <span
                              style={{ marginRight: 4, fontSize: 10, color: arrowClr }}
                              onClick={(e) => { e.stopPropagation(); toggle(mgmtKey); }}
                            >
                              {mgmtOpen ? "▼" : "▶"}
                            </span>
                            {mgmt}
                          </td>
                          <td style={cmtCellStyle(`${mgmt} 당기`)}
                            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "PL 계정분석", label: `${mgmt} 당기`, value: fmt(mgmtCur) }, { top: r.top, right: r.right }, e.currentTarget); }}>
                            {fmt(mgmtCur)}
                          </td>
                          <td style={cmtCellStyle(`${mgmt} 전기`)}
                            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "PL 계정분석", label: `${mgmt} 전기`, value: fmt(mgmtPri) }, { top: r.top, right: r.right }, e.currentTarget); }}>
                            {fmt(mgmtPri)}
                          </td>
                          <td style={cmtCellStyle(`${mgmt} 증감`)} className={mgmtChg >= 0 ? "up-t" : "dn-t"}
                            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "PL 계정분석", label: `${mgmt} 증감`, value: `${mgmtChg >= 0 ? "▲" : "▼"}${Math.abs(mgmtChg * 100).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` }, { top: r.top, right: r.right }, e.currentTarget); }}>
                            {mgmtChg >= 0 ? "▲" : "▼"}{Math.abs(mgmtChg * 100).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                          </td>
                        </tr>,
                        ...(!mgmtOpen ? [] : accts.map(r => (
                          <tr key={`${r.mgmt_acct}-${r.account_name}`} style={{ background: rowAcctBg }}>
                            <td style={{ paddingLeft: 40, color: rowAcctClr }}>{r.account_name}</td>
                            <td>{fmt(r.current)}</td>
                            <td>{fmt(r.prior)}</td>
                            <td className={r.change_pct >= 0 ? "up-t" : "dn-t"}>
                              {r.change_pct >= 0 ? "▲" : "▼"}{Math.abs(r.change_pct * 100).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                            </td>
                          </tr>
                        ))),
                      ];
                    })),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 우측 상세패널 (선택 시) ── */}
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, height: leftH, overflow: "hidden" }}>

            {loadingD && (
              <div style={{ padding: 30, color: isDark ? "#9198A8" : "#aaa", textAlign: "center" }}>로딩 중...</div>
            )}

            {detail && (
              <>
                {/* 요약카드 */}
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <span className="card-title" style={{ marginBottom: 0 }}>
                        {selectedCp ? selectedCp : detail.mgmt_acct}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: isDark ? "#9198A8" : "#aaa", marginLeft: 6 }}>{periodLabel}</span>
                      {selectedCp && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "#E87722", background: "rgba(232,119,34,0.1)", padding: "2px 8px", borderRadius: 10 }}>
                          거래처 선택됨
                        </span>
                      )}
                    </div>
                    {selectedCp && (
                      <button
                        onClick={() => setSelectedCp(null)}
                        style={{ fontSize: 10, color: btnClr, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                      >선택 해제</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {(() => {
                      const cpData = selectedCp ? detail.counterparty.find(c => c.name === selectedCp) : null;
                      const kCur = cpData ? cpData.cur : selCur;
                      const kPri = cpData ? cpData.pri : selPri;
                      const kChg = kCur - kPri;
                      const kChgPct = kPri !== 0 ? kChg / Math.abs(kPri) * 100 : 0;
                      return [
                        { label: `당기금액(${unitSuffix(amountUnit)})`, display: fmtByUnit(Math.abs(kCur), amountUnit), color: kpiValClr },
                        { label: `전기금액(${unitSuffix(amountUnit)})`, display: fmtByUnit(Math.abs(kPri), amountUnit), color: kpiValClr },
                        { label: `증감액(${unitSuffix(amountUnit)})`,   display: (kChg < 0 ? "-" : "") + fmtByUnit(Math.abs(kChg), amountUnit), color: kChg >= 0 ? "#EF4444" : "#2563EB" },
                        { label: "증감률",   display: `${kChgPct >= 0 ? "▲" : "▼"}${Math.abs(kChgPct).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, color: kChgPct >= 0 ? "#EF4444" : "#2563EB" },
                      ].map(({ label, display, color }) => (
                        <div key={label} style={{ background: kpiCardBg, borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: kpiLabelClr, marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.5px" }}>
                            {display}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* 두 차트 나란히 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="card">
                    <div className="card-title">상위 거래처 당기 비중</div>
                    {detail.counterparty.length === 0
                      ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: isDark ? "#9198A8" : "#bbb", fontSize: 13 }}>거래처 없음</div>
                      : <TopCounterpartyPie
                          data={detail.counterparty}
                          isDark={isDark}
                          selectedCp={selectedCp}
                          onCpClick={setSelectedCp}
                        />}
                  </div>
                  <div className="card">
                    <div className="card-title">거래처별 당기/전기</div>
                    {detail.counterparty.length === 0
                      ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: isDark ? "#9198A8" : "#bbb", fontSize: 13 }}>거래처 없음</div>
                      : <CounterpartyChangeBar data={detail.counterparty} isDark={isDark} selectedCp={selectedCp} />}
                  </div>
                </div>

                {/* 전표 내역 — 당기만 Comment */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
                  {/* 당기 전표 내역 */}
                  <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>
                      당기 전표 내역
                      {selectedCp && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: "#E87722" }}>— {selectedCp}</span>
                      )}
                    </div>
                    <div className="tbl-wrap" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "center" }}>일자</th>
                            <th style={{ textAlign: "center" }}>전표번호</th>
                            <th style={{ textAlign: "center" }}>거래처</th>
                            <th style={{ textAlign: "center" }}>적요</th>
                            <th style={{ textAlign: "center" }}>금액</th>
                          </tr>
                        </thead>
                        {(() => {
                          const vouchers = selectedCp
                            ? detail.cur_vouchers.filter(v => v.counterparty === selectedCp)
                            : detail.cur_vouchers;
                          return (
                            <>
                              <tbody>
                                {vouchers.length === 0
                                  ? <tr><td colSpan={5} style={{ textAlign: "center", color: isDark ? "#5A6070" : "#bbb", padding: 16 }}>내역 없음</td></tr>
                                  : vouchers.map((v, i) => (
                                    <tr
                                      key={i}
                                      style={{ cursor: "pointer" }}
                                      onClick={(e) => {
                                        const r = e.currentTarget.getBoundingClientRect();
                                        triggerComment(
                                          {
                                            page: "PL 계정분석",
                                            label: v.counterparty ?? v.description ?? "-",
                                            value: `일자: ${v.date} | 전표번호: ${v.voucher_no} | 거래처: ${v.counterparty ?? "-"} | 적요: ${v.description ?? "-"} | 금액: ${fmt(v.amount)}`,
                                            sub: detail.mgmt_acct,
                                          },
                                          { top: r.top, right: r.right },
                                          e.currentTarget
                                        );
                                      }}
                                    >
                                      <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>{v.date}</td>
                                      <td style={{ textAlign: "center" }}>{v.voucher_no}</td>
                                      <td style={{ textAlign: "left" }}>{v.counterparty ?? "-"}</td>
                                      <td style={{ textAlign: "left", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description ?? "-"}</td>
                                      <td>{fmt(v.amount)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                              {vouchers.length > 0 && (
                                <tfoot>
                                  <tr className="tr-sum">
                                    <td colSpan={4}>합계</td>
                                    <td>{fmt(vouchers.reduce((s, v) => s + v.amount, 0))}</td>
                                  </tr>
                                </tfoot>
                              )}
                            </>
                          );
                        })()}
                      </table>
                    </div>
                  </div>

                  {/* 전기 전표 내역 */}
                  <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <div className="card-title">전기 전표 내역</div>
                    <div className="tbl-wrap" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "center" }}>일자</th>
                            <th style={{ textAlign: "center" }}>전표번호</th>
                            <th style={{ textAlign: "center" }}>거래처</th>
                            <th style={{ textAlign: "center" }}>적요</th>
                            <th style={{ textAlign: "center" }}>금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.pri_vouchers.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: "center", color: isDark ? "#5A6070" : "#bbb", padding: 16 }}>내역 없음</td></tr>
                          )}
                          {detail.pri_vouchers.map((v, i) => (
                            <tr key={i}>
                              <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>{v.date}</td>
                              <td style={{ textAlign: "center" }}>{v.voucher_no}</td>
                              <td style={{ textAlign: "left" }}>{v.counterparty ?? "-"}</td>
                              <td style={{ textAlign: "left", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description ?? "-"}</td>
                              <td>{fmt(v.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {detail.pri_vouchers.length > 0 && (
                          <tfoot>
                            <tr className="tr-sum">
                              <td colSpan={4}>합계</td>
                              <td>{fmt(detail.pri_vouchers.reduce((s, v) => s + v.amount, 0))}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
