"use client";

import Loading from "@/components/ui/Loading";
import { useEffect, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { fetchPLTrendByAccount, fetchPLAccountDetail } from "@/lib/api";
import ReactECharts from "echarts-for-react";

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const fmtM  = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const fmt   = (n: number) => Math.round(n).toLocaleString("ko-KR");

const ORANGE = "#E87722";
const BLUE   = "#2563EB";

const PL_ORDER = ["매출액","매출원가","판매비와관리비","기타수익","기타비용","금융수익","금융비용","법인세비용"];

interface AccountTrend {
  mgmt_acct: string;
  disclosure_acct: string;
  cur: Record<string, number>;
  pri: Record<string, number>;
}
interface Voucher { date: string; voucher_no: string; counterparty: string; description: string; amount: number; dr_cr: string }
interface Detail {
  mgmt_acct: string;
  counterparty: { name: string; cur: number; pri: number; change: number }[];
  cur_vouchers: Voucher[];
  pri_vouchers: Voucher[];
}

// ── ECharts 스파크라인 ────────────────────────────────────────
function SparkLine({ months, cur, pri, height = 60, expanded = false, onMonthClick, selectedMonthIdx, isDark = false }: {
  months: string[];
  cur: number[];
  pri: number[];
  height?: number;
  expanded?: boolean;
  onMonthClick?: (idx: number) => void;
  selectedMonthIdx?: number | null;
  isDark?: boolean;
}) {
  const axisColor   = isDark ? "#5A6070" : "#bbb";
  const gridColor   = isDark ? "#2E3039" : "#f0f0f0";
  const tooltipBg   = isDark ? "#1C1F26" : "#fff";
  const tooltipBdr  = isDark ? "#2E3039" : "#eee";
  const tooltipTxt  = isDark ? "#E2E5EC" : "#333";

  const option = {
    animation: false,
    backgroundColor: "transparent",
    grid: { top: expanded ? 16 : 4, bottom: expanded ? 44 : 4, left: expanded ? 40 : 4, right: expanded ? 16 : 4 },
    xAxis: {
      type: "category" as const,
      data: months,
      show: expanded,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: axisColor },
    },
    yAxis: {
      type: "value" as const,
      show: expanded,
      axisLabel: { fontSize: 9, color: axisColor, formatter: (v: number) => `${Math.round(v / 1_000_000)}백만` },
      splitLine: { lineStyle: { color: gridColor, width: 1 } },
    },
    series: [
      {
        name: "당기",
        type: "line" as const,
        data: cur.map((v, i) => ({
          value: v,
          symbol: expanded ? "circle" : "none",
          symbolSize: i === selectedMonthIdx ? 14 : 16,
          itemStyle: {
            color: i === selectedMonthIdx ? BLUE : "rgba(0,0,0,0)",
            borderColor: i === selectedMonthIdx ? "#fff" : "rgba(0,0,0,0)",
            borderWidth: i === selectedMonthIdx ? 2 : 0,
          },
          emphasis: i === selectedMonthIdx ? {
            itemStyle: { color: BLUE, borderColor: "#fff", borderWidth: 2 },
            symbolSize: 12,
          } : {
            itemStyle: { color: "rgba(140,140,140,0.35)", borderColor: "rgba(100,100,100,0.7)", borderWidth: 1.5 },
            symbolSize: 10,
          },
        })),
        smooth: true,
        lineStyle: { color: ORANGE, width: expanded ? 2 : 1.5 },
        itemStyle: { color: ORANGE },
        areaStyle: { color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(232,119,34,0.18)" }, { offset: 1, color: "rgba(232,119,34,0)" }] } },
        emphasis: { scale: false },
      },
      {
        name: "전기",
        type: "line" as const,
        data: pri,
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#999", width: 1.5, type: "dashed" as const },
        itemStyle: { color: "#999" },
      },
    ],
    tooltip: expanded ? {
      trigger: "axis" as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBdr,
      textStyle: { color: tooltipTxt, fontSize: 11 },
      axisPointer: {
        type: "line" as const,
        lineStyle: { color: isDark ? "#3A3F4A" : "#bbb", width: 1, type: "dashed" as const },
      },
      formatter: (params: { seriesName: string; value: number; dataIndex: number }[]) => {
        const idx = params[0]?.dataIndex;
        const mo  = months[idx] ?? "";
        const lines = params.filter(p => p.value !== 0).map(p => `${p.seriesName}: <b>${fmtM(p.value)}백만</b>`);
        return `<span style="font-size:10px;color:${axisColor}">${mo}</span><br/>${lines.join("<br/>")}`;
      },
    } : {
      trigger: "axis" as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBdr,
      textStyle: { color: tooltipTxt, fontSize: 11 },
      axisPointer: { type: "line" as const, lineStyle: { color: isDark ? "#3A3F4A" : "#ddd", width: 1 } },
      formatter: (params: { seriesName: string; value: number; dataIndex: number }[]) => {
        const mo = months[params[0]?.dataIndex] ?? "";
        const lines = params.filter(p => p.value !== 0)
          .map(p => `${p.seriesName}: <b>${fmtM(p.value)}백만</b>`);
        return `<span style="font-size:10px;color:${axisColor}">${mo}</span><br/>${lines.join("<br/>")}`;
      },
    },
    legend: expanded ? {
      show: true,
      bottom: 0,
      left: "center",
      textStyle: { color: isDark ? "#9198A8" : "#888", fontSize: 10 },
      itemWidth: 16, itemHeight: 8,
    } : { show: false },
  };
  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      notMerge={true}
      onEvents={expanded && onMonthClick ? {
        click: (p: { dataIndex?: number; seriesIndex?: number }) => {
          if (p.dataIndex !== undefined) onMonthClick(p.dataIndex);
        },
        updateAxisPointer: (p: { axesInfo?: { value: string }[] }) => {
          // 마우스 위치 기반 월 인덱스는 클릭으로만 처리
          void p;
        },
      } : {}}
    />
  );
}

// ── 계정 카드 ─────────────────────────────────────────────────
function toPriYm(m: string) {
  return `${parseInt(m.slice(0, 4)) - 1}${m.slice(4)}`;
}

function AccountCard({
  acct, months, showDisc, isSelected, onClick, isDark = false,
}: {
  acct: AccountTrend;
  months: string[];
  showDisc: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  isDark?: boolean;
}) {
  const cur  = months.map(m => acct.cur[m] ?? 0);
  const pri  = months.map(m => acct.pri[toPriYm(m)] ?? 0);
  const total = cur.reduce((s, v) => s + v, 0);
  const priTotal = pri.reduce((s, v) => s + v, 0);
  const chg  = total - priTotal;
  const monthLabels = months.map(m => m.slice(5) + "월");

  const bg     = isDark ? "#1C1F26" : "#fff";
  const bdr    = isSelected ? `2px solid ${ORANGE}` : `1px solid ${isDark ? "#2E3039" : "#EDEDED"}`;
  const txtPri = isDark ? "#E2E5EC" : "#222";
  const txtSec = isDark ? "#9198A8" : "#444";
  const txtDim = isDark ? "#5A6070" : "#bbb";

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        border: bdr,
        borderTop: isSelected ? `3px solid ${ORANGE}` : `3px solid ${ORANGE}22`,
        boxShadow: isSelected
          ? "0 4px 16px rgba(232,119,34,.18)"
          : isDark ? "0 1px 4px rgba(0,0,0,.25)" : "0 1px 4px rgba(0,0,0,.05)",
        transition: "all .15s",
      }}
    >
      {showDisc && (
        <div style={{ fontSize: 9, color: txtDim, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {acct.disclosure_acct}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? ORANGE : txtSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {acct.mgmt_acct}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: txtPri, letterSpacing: "-0.5px" }}>
          {fmtM(total)}
        </span>
        <span style={{ fontSize: 10, color: txtDim }}>백만</span>
        <span style={{ fontSize: 10, color: chg >= 0 ? "#EF4444" : BLUE, marginLeft: 2 }}>
          {chg >= 0 ? "▲" : "▼"}{fmtM(Math.abs(chg))}
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        <SparkLine months={monthLabels} cur={cur} pri={pri} height={56} isDark={isDark} />
      </div>
    </div>
  );
}

// ── 확대 차트 카드 ────────────────────────────────────────────
function ExpandedCard({ acct, months, onClose, onMonthClick, selectedMonthIdx, isDark = false }: {
  acct: AccountTrend;
  months: string[];
  onClose: () => void;
  onMonthClick?: (idx: number) => void;
  selectedMonthIdx?: number | null;
  isDark?: boolean;
}) {
  const cur  = months.map(m => acct.cur[m] ?? 0);
  const pri  = months.map(m => acct.pri[toPriYm(m)] ?? 0);
  const monthLabels = months.map(m => m.slice(5) + "월");

  const dispCur    = selectedMonthIdx != null ? cur[selectedMonthIdx]    : cur.reduce((s, v) => s + v, 0);
  const dispPri    = selectedMonthIdx != null ? pri[selectedMonthIdx]    : pri.reduce((s, v) => s + v, 0);
  const dispChg    = dispCur - dispPri;
  const dispChgPct = dispPri !== 0 ? (dispChg / Math.abs(dispPri) * 100) : 0;
  const monthLabel = selectedMonthIdx != null ? monthLabels[selectedMonthIdx] : "누적";
  void dispChgPct;

  const txtPri = isDark ? "#E2E5EC" : "#222";
  const txtDim = isDark ? "#5A6070" : "#bbb";
  const btnBdr = isDark ? "#2E3039" : "#eee";
  const btnTxt = isDark ? "#9198A8" : "#aaa";

  return (
    <div className="card" style={{ borderTop: `3px solid ${ORANGE}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: txtDim, marginBottom: 2 }}>{acct.disclosure_acct}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: txtPri }}>{acct.mgmt_acct}</div>
          <div style={{ fontSize: 11, color: ORANGE, marginTop: 2 }}>
            {selectedMonthIdx != null
              ? <span style={{ background: "rgba(232,119,34,0.1)", padding: "2px 8px", borderRadius: 10 }}>{monthLabel} 선택됨 · 클릭으로 변경, 재클릭으로 해제</span>
              : <span style={{ color: txtDim }}>차트 월 클릭 시 해당 월 데이터로 전환</span>
            }
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: `1px solid ${btnBdr}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: btnTxt, cursor: "pointer" }}
        >
          닫기
        </button>
      </div>
      <SparkLine
        months={monthLabels} cur={cur} pri={pri}
        height={200} expanded
        onMonthClick={onMonthClick}
        selectedMonthIdx={selectedMonthIdx}
        isDark={isDark}
      />
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10, color: isDark ? "#9198A8" : "#aaa" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 14, height: 2, background: ORANGE }} />당기
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 14, height: 2, background: isDark ? "#5A6070" : "#ccc", borderTop: `1px dashed ${isDark ? "#5A6070" : "#ccc"}` }} />전기
        </span>
      </div>
    </div>
  );
}

// ── 거래처 바 ─────────────────────────────────────────────────
function CounterpartyBar({ data, isDark = false }: { data: Detail["counterparty"]; isDark?: boolean }) {
  const maxVal    = Math.max(...data.flatMap(d => [Math.abs(d.cur), Math.abs(d.pri)]), 1);
  const trackBg   = isDark ? "#252830" : "#F0F0F0";
  const priBarBg  = isDark ? "rgba(100,110,130,0.55)" : "rgba(160,160,160,0.4)";
  const priBarBdr = isDark ? "#3A3F4A" : "#D0D0D0";
  const labelClr  = isDark ? "#9198A8" : "#555";
  const valClr    = isDark ? "#7A8295" : "#777";
  const legendClr = isDark ? "#9198A8" : "#888";

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 10, color: legendClr }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: ORANGE, borderRadius: 2 }} />당기
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: priBarBg, border: `1px solid ${priBarBdr}`, borderRadius: 2 }} />전기
        </span>
      </div>
      {data.map(d => {
        const curPct = Math.abs(d.cur) / maxVal * 100;
        const priPct = Math.abs(d.pri) / maxVal * 100;
        return (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 180, fontSize: 11, color: labelClr, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ flex: 1, position: "relative", height: 28 }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 12, background: trackBg, borderRadius: 3 }}>
                <div style={{ width: `${priPct}%`, height: "100%", background: priBarBg, border: `1px solid ${priBarBdr}`, borderRadius: 3, boxSizing: "border-box" }} />
              </div>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, background: trackBg, borderRadius: 3 }}>
                <div style={{ width: `${curPct}%`, height: "100%", background: ORANGE, borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ width: 80, fontSize: 10, color: valClr, textAlign: "right", flexShrink: 0, lineHeight: 1.6 }}>
              <div style={{ color: ORANGE, fontWeight: 700 }}>{fmtM(Math.abs(d.cur))}백만</div>
              <div>{fmtM(Math.abs(d.pri))}백만</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export default function PLTrend() {
  const isDark = useDarkMode();
  const filter = useFilter();
  const { triggerComment, target: cmtTarget, panelOpen } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const lift = (label: string): React.CSSProperties => {
    const on = panelOpen && !!cmtTarget?.inquiryId && cmtTarget.page === "PL 추이분석" && cmtTarget.label === label;
    return on
      ? { boxShadow: "0 12px 32px rgba(232,119,34,0.22), 0 0 0 2px rgba(232,119,34,0.45)", transform: "translateY(-5px)", zIndex: 10, transition: "box-shadow 0.25s, transform 0.25s" }
      : { transition: "box-shadow 0.25s, transform 0.25s" };
  };
  const [accounts,      setAccounts]      = useState<AccountTrend[] | null>(null);
  const [selected,      setSelected]      = useState<string | null>(null);
  const [detail,        setDetail]        = useState<Detail | null>(null);
  const [loadingD,      setLoadingD]      = useState(false);
  const [discFilter,    setDiscFilter]    = useState("전체");
  const [chartMonthIdx, setChartMonthIdx] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccounts(null); setSelected(null); setDetail(null); setChartMonthIdx(null);
    fetchPLTrendByAccount(filter).then(d => setAccounts(d as AccountTrend[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  useEffect(() => {
    if (!selected) { setDetail(null); setChartMonthIdx(null); return; }
    setLoadingD(true);
    // 월 선택 시 해당 월(monthly), 없으면 필터 기준
    const baseYmOverride = chartMonthIdx != null && accounts
      ? (() => {
          const year = filter.baseYm.split("-")[0];
          const allMonths = Array.from(new Set(accounts.flatMap(a => Object.keys(a.cur)))).filter(m => m.startsWith(year)).sort();
          return allMonths[chartMonthIdx] ?? filter.baseYm;
        })()
      : undefined;
    const periodOverride = chartMonthIdx != null ? "monthly" : undefined;
    fetchPLAccountDetail(filter, selected, baseYmOverride, periodOverride)
      .then(d => { setDetail(d as Detail); setLoadingD(false); })
      .catch(() => setLoadingD(false));
  }, [selected, chartMonthIdx, filter.baseYm, filter.periodType]);

  useEffect(() => {
    if (selected && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [selected]);

  if (!accounts) return <Loading />;

  const year = filter.baseYm.split("-")[0];
  const allMonths = Array.from(new Set(accounts.flatMap(a => Object.keys(a.cur)))).filter(m => m.startsWith(year)).sort();

  const discAccts = ["전체", ...PL_ORDER.filter(d => accounts.some(a => a.disclosure_acct === d))];
  const filtered  = discFilter === "전체" ? accounts : accounts.filter(a => a.disclosure_acct === discFilter);

  const selectedAcct = selected ? accounts.find(a => a.mgmt_acct === selected) : null;

  return (
    <div className="wrap">

      {/* ── 섹션 헤더 ── */}
      <div className="sec-hd">
        <span className="sec-hd-txt">월별 손익 Trend</span>
        <div className="sec-hd-line" />
        {selected && (
          <button
            onClick={() => { setSelected(null); setDetail(null); setChartMonthIdx(null); }}
            style={{ fontSize: 11, color: isDark ? "#9198A8" : "#aaa", background: "none", border: `1px solid ${isDark ? "#2E3039" : "#E0E0E0"}`, borderRadius: 4, padding: "2px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            선택 해제
          </button>
        )}
      </div>

      {/* ── 공시용계정 필터 탭 ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {discAccts.map(d => (
          <button
            key={d}
            onClick={() => { setDiscFilter(d); setSelected(null); setDetail(null); }}
            style={{
              fontSize: 11, fontWeight: discFilter === d ? 700 : 400,
              padding: "4px 14px", borderRadius: 20, cursor: "pointer",
              border: discFilter === d ? `1.5px solid ${ORANGE}` : `1px solid ${isDark ? "#2E3039" : "#E0E0E0"}`,
              background: discFilter === d ? (isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC") : (isDark ? "#1C1F26" : "#fff"),
              color: discFilter === d ? ORANGE : (isDark ? "#9198A8" : "#666"),
              transition: "all .15s",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* ── 확대 차트 (선택 시) ── */}
      {selectedAcct && (
        <div style={{ marginBottom: 14 }}>
          <ExpandedCard
            acct={selectedAcct}
            months={allMonths}
            onClose={() => { setSelected(null); setDetail(null); setChartMonthIdx(null); }}
            onMonthClick={idx => setChartMonthIdx(prev => prev === idx ? null : idx)}
            selectedMonthIdx={chartMonthIdx}
            isDark={isDark}
          />
        </div>
      )}

      {/* ── 계정 카드 그리드 (선택 시 숨김) ── */}
      <div style={{
        display: selected ? "none" : "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}>
        {filtered.map(a => (
          <div key={a.mgmt_acct} style={{ position: "relative", ...lift(a.mgmt_acct) }}>
            {ck.has(commentKey("PL 추이분석", a.mgmt_acct)) && (
              <CommentDot inquiryId={ck.get(commentKey("PL 추이분석", a.mgmt_acct))!} />
            )}
            <AccountCard
              acct={a}
              months={allMonths}
              showDisc={discFilter === "전체"}
              isSelected={selected === a.mgmt_acct}
              isDark={isDark}
              onClick={() => {
                setSelected(prev => prev === a.mgmt_acct ? null : a.mgmt_acct);
              }}
            />
          </div>
        ))}
      </div>

      {/* ── 디테일 패널 ── */}
      <div
        ref={detailRef}
        style={{
          overflow: "hidden",
          maxHeight: selected ? 2000 : 0,
          opacity: selected ? 1 : 0,
          transition: "max-height 0.45s ease, opacity 0.3s ease",
          marginTop: selected ? 14 : 0,
        }}
      >
        {loadingD && (
          <div style={{ padding: 30, color: "#aaa", textAlign: "center" }}>로딩 중...</div>
        )}
        {detail && (() => {
          const selAcct = accounts.find(a => a.mgmt_acct === detail.mgmt_acct);
          const curArr = allMonths.map(m => selAcct?.cur[m] ?? 0);
          const priArr = allMonths.map(m => selAcct?.pri[toPriYm(m)] ?? 0);

          const kpiCur = chartMonthIdx != null ? curArr[chartMonthIdx] : curArr.reduce((s, v) => s + v, 0);
          const kpiPri = chartMonthIdx != null ? priArr[chartMonthIdx] : priArr.reduce((s, v) => s + v, 0);
          const kpiChg = kpiCur - kpiPri;
          const kpiChgPct = kpiPri !== 0 ? kpiChg / Math.abs(kpiPri) * 100 : null;

          const baseMonth = filter.baseYm.split("-")[1].replace(/^0/, "");
          const selMonthLabel = chartMonthIdx != null ? allMonths[chartMonthIdx]?.slice(5).replace(/^0/, "") + "월" : null;
          const periodLabel = selMonthLabel
            ? `${selMonthLabel} 당월`
            : filter.periodType === "cumulative" ? `${baseMonth}월 누적` : `${baseMonth}월 당월`;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* KPI 카드 3개 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                {[
                  { label: "당기금액", value: fmtM(Math.abs(kpiCur)) + "백만", color: ORANGE },
                  { label: "전기금액", value: fmtM(Math.abs(kpiPri)) + "백만", color: "#555" },
                  { label: "증감액",   value: (kpiChg < 0 ? "-" : "") + fmtM(Math.abs(kpiChg)) + "백만", color: kpiChg >= 0 ? "#EF4444" : BLUE },
                  { label: "증감률",   value: kpiChgPct !== null ? `${kpiChg >= 0 ? "▲" : "▼"}${Math.abs(kpiChgPct).toFixed(1)}%` : "-", color: kpiChg >= 0 ? "#EF4444" : BLUE },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ borderTop: `3px solid ${color}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 6 }}>
                      {detail.mgmt_acct} — {label}
                      <span style={{ fontSize: 10, fontWeight: 400, color: "#bbb", marginLeft: 6 }}>{periodLabel}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* 거래처별 차트 */}
              <div className="card">
                <div className="card-title">{detail.mgmt_acct} — 거래처별 당기/전기</div>
                <CounterpartyBar data={detail.counterparty} isDark={isDark} />
              </div>

              {/* 전표 내역 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* 당기 기표 내역 — Comment 가능 */}
                <div className="card">
                  <div className="card-title">당기 기표 내역</div>
                  <div className="tbl-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                    <table>
                      <thead>
                        <tr><th>일자</th><th>전표번호</th><th>거래처</th><th>적요</th><th>금액</th></tr>
                      </thead>
                      <tbody>
                        {detail.cur_vouchers.length === 0 && (
                          <tr><td colSpan={5} style={{ textAlign: "center", color: "#bbb", padding: 16 }}>내역 없음</td></tr>
                        )}
                        {detail.cur_vouchers.map((v, i) => (
                          <tr
                            key={i}
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              triggerComment(
                                {
                                  page: "PL 추이분석",
                                  label: v.counterparty ?? v.description ?? "-",
                                  value: `일자: ${v.date} | 전표번호: ${v.voucher_no} | 거래처: ${v.counterparty ?? "-"} | 적요: ${v.description ?? "-"} | 금액: ${fmt(v.amount)}`,
                                  sub: detail.mgmt_acct,
                                },
                                { top: r.top, right: r.right }
                              );
                            }}
                          >
                            <td style={{ whiteSpace: "nowrap" }}>{v.date}</td>
                            <td>{v.voucher_no}</td>
                            <td>{v.counterparty ?? "-"}</td>
                            <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description ?? "-"}</td>
                            <td>{fmt(v.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {detail.cur_vouchers.length > 0 && (
                        <tfoot>
                          <tr className="tr-sum">
                            <td colSpan={4}>합계</td>
                            <td>{fmt(detail.cur_vouchers.reduce((s, v) => s + v.amount, 0))}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* 전기 기표 내역 — Comment 없음 */}
                <div className="card">
                  <div className="card-title">전기 기표 내역</div>
                  <div className="tbl-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                    <table>
                      <thead>
                        <tr><th>일자</th><th>전표번호</th><th>거래처</th><th>적요</th><th>금액</th></tr>
                      </thead>
                      <tbody>
                        {detail.pri_vouchers.length === 0 && (
                          <tr><td colSpan={5} style={{ textAlign: "center", color: "#bbb", padding: 16 }}>내역 없음</td></tr>
                        )}
                        {detail.pri_vouchers.map((v, i) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: "nowrap" }}>{v.date}</td>
                            <td>{v.voucher_no}</td>
                            <td>{v.counterparty ?? "-"}</td>
                            <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description ?? "-"}</td>
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

            </div>
          );
        })()}
      </div>

    </div>
  );
}
