"use client";

import Loading from "@/components/ui/Loading";
import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  fetchKPI, fetchTop3, fetchIndicators,
  fetchPLTable, fetchBSTable, fetchScenarioCount, fetchPLTrend, fetchBSTrend,
  KPIData, Top3Data, IndicatorData, PLTableRow, BSTableRow, ScenarioCountData,
} from "@/lib/api";
import ReactECharts from "echarts-for-react";
import { useAmountFormat } from "@/lib/fmtAmount";

const _pctFmt = (v: number) => v.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct = (p: number) => `${_pctFmt(p * 100)}%`;
const arrow  = (p: number) => p >= 0 ? "up" : "dn";
const arrowTxt = (p: number) => p >= 0
  ? `▲ ${_pctFmt(Math.abs(p * 100))}%`
  : `▼ ${_pctFmt(Math.abs(p * 100))}%`;

// ── ECharts Sparkline ─────────────────────────────────────────
function Sparkline({ data, months, color, selectedIdx, onMonthClick }: {
  data: number[];
  months: string[];
  color: string;
  selectedIdx: number | null;
  onMonthClick: (idx: number | null) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { fmtAmt, unitLabel } = useAmountFormat();

  if (!data || data.length < 2) return null;

  const option = {
    animation: false,
    grid: { top: 4, bottom: 4, left: 4, right: 4 },
    xAxis: { type: "category" as const, data: months, show: false },
    yAxis: { type: "value" as const, show: false },
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { type: "line" as const, lineStyle: { color: "#ddd", width: 1 } },
      formatter: (params: { dataIndex: number; value: number }[]) => {
        const p = params[0];
        return `<span style="font-size:10px;color:#999">${months[p.dataIndex]}</span><br/><b>${fmtAmt(p.value)}${unitLabel}</b>`;
      },
    },
    series: [{
      type: "line" as const,
      data: data.map((v, i) => ({
        value: v,
        symbol: "circle",
        symbolSize: i === hoveredIdx ? 18 : i === selectedIdx ? 10 : 7,
        itemStyle: {
          color: i === hoveredIdx ? "rgba(180,180,180,0.5)" : i === selectedIdx ? "#2563EB" : color,
          borderColor: i === hoveredIdx ? "rgba(180,180,180,0.3)" : i === selectedIdx ? "#fff" : color,
          borderWidth: i === hoveredIdx ? 2 : i === selectedIdx ? 1.5 : 0,
        },
      })),
      emphasis: { scale: false },
      smooth: true,
      lineStyle: { color, width: 1.8 },
      areaStyle: {
        color: {
          type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color + "40" },
            { offset: 1, color: color + "05" },
          ],
        },
      },
    }],
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      <ReactECharts
        option={option}
        style={{ height: 60, width: "100%", marginTop: 8, cursor: "pointer" }}
        notMerge={true}
        onEvents={{
          mouseover: (p: { dataIndex?: number }) => {
            if (p.dataIndex !== undefined) setHoveredIdx(p.dataIndex);
          },
          mouseout: () => setHoveredIdx(null),
          click: (p: { dataIndex?: number }) => {
            if (p.dataIndex === undefined) return;
            onMonthClick(selectedIdx === p.dataIndex ? null : p.dataIndex);
          },
        }}
      />
    </div>
  );
}

export default function Summary({ onNavigate }: { onNavigate?: (tab: string, sub: string, label: string) => void }) {
  const isDark = useDarkMode();
  const filter = useFilter();
  const { fmtAmt, unitLabel, unitSuffix } = useAmountFormat();
  const { triggerComment, target: cmtTarget, panelOpen } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const theadBg = isDark ? "#1C1F26" : "#FFF8F3";
  const lift = (label: string): React.CSSProperties => {
    const viewingInquiry = panelOpen && !!cmtTarget?.inquiryId && cmtTarget.page === "Summary" && cmtTarget.label === label;
    const selected = !!cmtTarget && !cmtTarget.inquiryId && cmtTarget.page === "Summary" && cmtTarget.label === label;
    if (viewingInquiry) {
      return { boxShadow: "0 8px 24px rgba(232,119,34,0.14), 0 0 0 2px rgba(232,119,34,0.28), 0 0 0 10px rgba(232,119,34,0.04)", borderRadius: 10, transform: "translateY(-4px)", zIndex: 10, transition: "all 0.25s" };
    }
    if (selected) {
      return { boxShadow: "0 4px 14px rgba(232,119,34,0.1), 0 0 0 1.5px rgba(232,119,34,0.22), 0 0 0 8px rgba(232,119,34,0.05)", borderRadius: 10, zIndex: 10, transition: "all 0.25s" };
    }
    return { transition: "all 0.25s" };
  };
  // 테이블 행/셀 강조
  const isRowHighlighted = (account: string) =>
    !!cmtTarget && cmtTarget.page === "Summary" &&
    !!cmtTarget.label?.startsWith(account + " (");
  const isCellHighlighted = (account: string, col: string) =>
    !!cmtTarget && cmtTarget.page === "Summary" &&
    cmtTarget.label === `${account} (${col})`;
  const [kpi,        setKpi]        = useState<KPIData | null>(null);
  const [top3,       setTop3]       = useState<Top3Data | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [plTable,    setPlTable]    = useState<PLTableRow[] | null>(null);
  const [bsTable,    setBsTable]    = useState<BSTableRow[] | null>(null);
  const [scCount,    setScCount]    = useState<ScenarioCountData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plTrend,    setPlTrend]    = useState<any[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bsTrend,    setBsTrend]    = useState<any[] | null>(null);
  const [selMonth,   setSelMonth]   = useState<Record<string, number | null>>({
    revenue: null, operating_income: null, asset: null, liability: null,
  });
  const [monthTop3,  setMonthTop3]  = useState<Record<string, Top3Data | null>>({});

  useEffect(() => {
    Promise.all([
      fetchKPI(filter).then(setKpi),
      fetchTop3(filter).then(setTop3),
      fetchIndicators(filter).then(setIndicators),
      fetchPLTable(filter).then(setPlTable),
      fetchBSTable(filter).then(setBsTable),
      fetchScenarioCount(filter).then(setScCount),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchPLTrend({ ...filter, periodType: "monthly" }).then(d => setPlTrend(d as any[])),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchBSTrend(filter).then(d => setBsTrend(d as any[])),
    ]).catch(console.error);
  }, [filter.baseYm, filter.periodType, filter.compareTarget, filter.bsBase]);

  if (!kpi || !top3 || !indicators || !plTable || !bsTable || !scCount) {
    return <Loading />;
  }

  // Sparkline 데이터 추출 (현재연도만)
  const year = filter.baseYm.split("-")[0];
  const curPl = (plTrend ?? []).filter((r: { is_current_year: boolean }) => r.is_current_year);
  const curBs = (bsTrend ?? []).filter((r: { year_month: string }) => r.year_month.startsWith(year));

  const sparkData: Record<string, number[]> = {
    revenue:          curPl.map((r: { revenue: number }) => r.revenue),
    operating_income: curPl.map((r: { operating_income: number }) => r.operating_income),
    asset:            curBs.map((r: { 자산?: number }) => r.자산 ?? 0),
    liability:        curBs.map((r: { 부채?: number }) => r.부채 ?? 0),
  };

  // 월 라벨
  const plMonths = curPl.map((r: { year_month: string }) => r.year_month.slice(5) + "월");
  const bsMonths = curBs.map((r: { year_month: string }) => r.year_month.slice(5) + "월");

  // KPI → Top3 카드 매핑
  const kpiToTop3: Record<string, string> = {
    revenue: "revenue_counterparty",
    operating_income: "cost_account",
    asset: "asset_account",
    liability: "liability_account",
  };

  // 월 선택 핸들러: 해당 카드의 Top3만 월별 재조회
  const handleMonthClick = (kpiKey: string, idx: number | null) => {
    setSelMonth(prev => ({ ...prev, [kpiKey]: idx }));
    if (idx === null) {
      setMonthTop3(prev => ({ ...prev, [kpiKey]: null }));
      return;
    }
    const isBs = kpiKey === "asset" || kpiKey === "liability";
    const monthArr = isBs ? curBs : curPl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ym: string = (monthArr[idx] as any)?.year_month ?? filter.baseYm;
    fetchTop3(filter, ym, "monthly")
      .then(d => setMonthTop3(prev => ({ ...prev, [kpiKey]: d })))
      .catch(console.error);
  };

  const kpiItems = [
    { key: "revenue",          label: "매출액",   color: "#E87722", months: plMonths },
    { key: "operating_income", label: "영업이익", color: "#D5476E", months: plMonths },
    { key: "asset",            label: "자산",     color: "#E87722", months: bsMonths },
    { key: "liability",        label: "부채",     color: "#6D4C41", months: bsMonths },
  ];

  return (
    <div className="wrap">

      {/* ── KPI Strip ── */}
      <div className="kpi-strip">
        {kpiItems.map(({ key, label, color, months }) => {
          const d = kpi[key];
          const idx = selMonth[key];
          return (
            <div key={key} className="kpi" style={{ borderTopColor: color, paddingBottom: 0, cursor: "pointer", ...lift(label) }} onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const selVal = idx !== null ? fmtAmt(sparkData[key][idx]) : fmtAmt(d.value);
              const selLabel = idx !== null ? months[idx] : undefined;
              const selRaw = idx !== null ? sparkData[key][idx] : d.value;
              const chatSummary = idx !== null
                ? `${label} ${selLabel}: ${fmtAmt(selRaw)}${unitLabel}`
                : `${label}: 당기 ${fmtAmt(d.value)}${unitLabel}, 전기 ${fmtAmt(d.prior)}${unitLabel}, 증감률 ${fmtPct(d.change_pct)} (${d.vs})`;
              triggerComment({
                page: "Summary",
                label,
                value: `${selVal}${unitLabel}`,
                sub: selLabel ? `선택 월: ${selLabel}` : undefined,
                chatAttachment: {
                  label: idx !== null ? `${label} ${selLabel} ${fmtAmt(selRaw)}${unitLabel}` : `${label} ${fmtAmt(d.value)}${unitLabel}`,
                  summary: chatSummary,
                  source: `Summary - ${label} KPI`,
                },
              }, { top: r.top, right: r.right }, e.currentTarget);
            }}>
              {ck.has(commentKey("Summary", label)) && <CommentDot inquiryId={ck.get(commentKey("Summary", label))!} />}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="kpi-lbl">{label}</div>
                {idx !== null && (
                  <span style={{ fontSize: 9, color: "#2563EB", background: "rgba(37,99,235,0.08)", padding: "1px 5px", borderRadius: 6 }}>
                    {months[idx]}
                  </span>
                )}
              </div>
              <div className="kpi-val" style={{ color }}>
                {fmtAmt(d.value)}<span className="u">{unitLabel}</span>
              </div>
              <div className={`kpi-chg ${arrow(d.change_pct)}`}>
                {arrowTxt(d.change_pct)}
                <span style={{ color: "#bbb", fontWeight: 400, marginLeft: 4 }}>{d.vs}</span>
              </div>
              <Sparkline
                data={sparkData[key] ?? []}
                months={months}
                color={color}
                selectedIdx={idx}
                onMonthClick={(i) => handleMonthClick(key, i)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Top3 Rankings ── */}
      <div className="g4">
        {[
          { key: "revenue_counterparty", title: "매출액 증가 상위 3개 거래처", kpiKey: "revenue" },
          { key: "cost_account",         title: "비용 증가 상위 3개 계정",     kpiKey: "operating_income" },
          { key: "asset_account",        title: "자산 증가 상위 3개 계정",     kpiKey: "asset" },
          { key: "liability_account",    title: "부채 증가 상위 3개 계정",     kpiKey: "liability" },
        ].map(({ key, title, kpiKey }) => {
          const idx = selMonth[kpiKey];
          const activeTop3 = (idx !== null && monthTop3[kpiKey]) ? monthTop3[kpiKey] : top3;
          const monthLabel = idx !== null ? kpiItems.find(k => k.key === kpiKey)?.months[idx] : null;
          return (
          <div key={key} className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>{title}</div>
              {monthLabel && (
                <span style={{ fontSize: 10, color: "#2563EB", background: "rgba(37,99,235,0.08)", padding: "1px 6px", borderRadius: 8 }}>
                  {monthLabel}
                </span>
              )}
            </div>
            {(activeTop3?.[key] ?? []).map((item) => (
              <div key={item.rank} className="t3-item" style={{ cursor: "pointer", position: "relative", ...lift(item.name) }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "Summary", label: item.name, value: `${fmtAmt(item.value)}${unitLabel}`, sub: title + (monthLabel ? ` (${monthLabel})` : "") }, { top: r.top, right: r.right }, e.currentTarget); }}>
                {ck.has(commentKey("Summary", item.name)) && <CommentDot inquiryId={ck.get(commentKey("Summary", item.name))!} />}
                <div className={`t3-badge${item.rank === 1 ? " r1" : ""}`}>{item.rank}</div>
                <div className="t3-name">
                  {item.name}
                  <div className="t3-bar-row">
                    <div className="t3-bar-fill" style={{ width: `${item.bar_pct}%` }} />
                  </div>
                </div>
                <div className="t3-val" style={item.rank === 3 ? { color: "#aaa" } : {}}>
                  {fmtAmt(item.value)}<small> {unitLabel}</small>
                </div>
              </div>
            ))}
          </div>
          );
        })}
      </div>

      {/* ── 지표 ── */}
      <div className="g2">
        <div className="card">
          <div className="card-title">손익지표</div>
          <div className="ind-row">
            {[
              { label: "매출총이익률", value: indicators.pl.gross_profit_margin, color: "#E87722" },
              { label: "영업이익률",   value: indicators.pl.operating_margin,    color: "#D5476E" },
              { label: "당기손익률",   value: indicators.pl.net_margin,          color: "#6D4C41" },
            ].map(({ label, value, color }) => (
              <div key={label} className="ind-item" style={{ cursor: "pointer", position: "relative", ...lift(label) }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "Summary", label, value: fmtPct(value) }, { top: r.top, right: r.right }, e.currentTarget); }}>
                {ck.has(commentKey("Summary", label)) && <CommentDot inquiryId={ck.get(commentKey("Summary", label))!} />}
                <div className="ind-lbl">{label}</div>
                <div className="ind-val" style={{ color }}>{fmtPct(value)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">유동성지표</div>
          <div className="ind-row">
            {[
              { label: "부채비율", value: indicators.bs.debt_ratio,    color: "#2563EB" },
              { label: "유동비율", value: indicators.bs.current_ratio,  color: "#16A34A" },
            ].map(({ label, value, color }) => (
              <div key={label} className="ind-item" style={{ cursor: "pointer", position: "relative", ...lift(label) }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "Summary", label, value: fmtPct(value) }, { top: r.top, right: r.right }, e.currentTarget); }}>
                {ck.has(commentKey("Summary", label)) && <CommentDot inquiryId={ck.get(commentKey("Summary", label))!} />}
                <div className="ind-lbl">{label}</div>
                <div className="ind-val" style={{ color }}>{fmtPct(value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 테이블 ── */}
      <div className="g2">
        <div className="card">
          <div className="card-title">손익항목</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>공시용계정</th><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>당기({unitSuffix})</th><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>전기({unitSuffix})</th><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>증감률</th></tr></thead>
              <tbody>
                {plTable.map((row) => {
                  const chgTxt = `${row.change_pct >= 0 ? "▲" : "▼"}${_pctFmt(Math.abs(row.change_pct * 100))}%`;
                  const tc = (col: string, value: string) => (e: React.MouseEvent<HTMLTableCellElement>) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    triggerComment({ page: "Summary", label: `${row.account} (${col})`, value }, { top: r.top, right: r.right }, e.currentTarget);
                  };
                  const plDotId = ["당기", "전기", "증감률"].map(c => ck.get(commentKey("Summary", `${row.account} (${c})`))).find(v => v !== undefined);
                  const rowHl = isRowHighlighted(row.account);
                  const cellBg = (col: string) => isCellHighlighted(row.account, col)
                    ? { background: "rgba(232,119,34,0.13)", fontWeight: 700 as const, outline: "2px solid rgba(232,119,34,0.45)", outlineOffset: -2, cursor: "pointer" as const }
                    : { cursor: "pointer" as const };
                  return (
                    <tr key={row.account} className={row.is_subtotal ? "tr-sum" : ""}
                      style={rowHl ? { background: "rgba(232,119,34,0.05)", transition: "background 0.25s" } : undefined}>
                      <td className={!row.is_subtotal ? "td-s1" : ""} style={{ position: "relative" }}>
                        {row.account}
                        {plDotId !== undefined && <CommentDot inquiryId={plDotId} inline />}
                      </td>
                      <td style={cellBg("당기")} onClick={tc("당기", fmtAmt(row.current))}>{fmtAmt(row.current)}</td>
                      <td style={cellBg("전기")} onClick={tc("전기", fmtAmt(row.prior))}>{fmtAmt(row.prior)}</td>
                      <td className={row.change_pct >= 0 ? "up-t" : "dn-t"} style={cellBg("증감률")} onClick={tc("증감률", chgTxt)}>{chgTxt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-title">재무항목</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>재무항목</th><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>기말({unitSuffix})</th><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>기초({unitSuffix})</th><th style={{ background: theadBg, borderBottom: "2px solid #E87722" }}>증감률</th></tr></thead>
              <tbody>
                {bsTable.map((row) => {
                  const chgTxt = `${row.change_pct >= 0 ? "▲" : "▼"}${_pctFmt(Math.abs(row.change_pct * 100))}%`;
                  const tc = (col: string, value: string) => (e: React.MouseEvent<HTMLTableCellElement>) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    triggerComment({ page: "Summary", label: `${row.account} (${col})`, value }, { top: r.top, right: r.right }, e.currentTarget);
                  };
                  const bsDotId = ["기말", "기초", "증감률"].map(c => ck.get(commentKey("Summary", `${row.account} (${c})`))).find(v => v !== undefined);
                  const rowHl = isRowHighlighted(row.account);
                  const cellBg = (col: string) => isCellHighlighted(row.account, col)
                    ? { background: "rgba(232,119,34,0.13)", fontWeight: 700 as const, outline: "2px solid rgba(232,119,34,0.45)", outlineOffset: -2, cursor: "pointer" as const }
                    : { cursor: "pointer" as const };
                  return (
                    <tr key={`${row.account}-${row.indent}`} className={row.indent === 0 ? "tr-sum" : ""}
                      style={rowHl ? { background: "rgba(232,119,34,0.05)", transition: "background 0.25s" } : undefined}>
                      <td className={row.indent === 1 ? "td-s1" : ""} style={{ position: "relative" }}>
                        {row.account}
                        {bsDotId !== undefined && <CommentDot inquiryId={bsDotId} inline />}
                      </td>
                      <td style={cellBg("기말")} onClick={tc("기말", fmtAmt(row.current))}>{fmtAmt(row.current)}</td>
                      <td style={cellBg("기초")} onClick={tc("기초", fmtAmt(row.prior))}>{fmtAmt(row.prior)}</td>
                      <td className={row.change_pct >= 0 ? "up-t" : "dn-t"} style={cellBg("증감률")} onClick={tc("증감률", chgTxt)}>{chgTxt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 시나리오 전표수 ── */}
      <div>
        <div className="card-title" style={{ marginBottom: 10 }}>시나리오 전표수</div>
        <div className="vc-row">
          {[
            { key: "sc1", label: "동일금액 중복 전표",           sub: "sc-dup",  tab: "sc" },
            { key: "sc2", label: "현금지급 後 부채인식",           sub: "sc-cash", tab: "sc" },
            { key: "sc3", label: "주말 현금지급",                  sub: "sc-wknd", tab: "sc" },
            { key: "sc4", label: "고액 현금지급",                  sub: "sc-big",  tab: "sc" },
            { key: "sc5", label: "현금지급·비용인식 동시 발생",   sub: "sc-sc5",  tab: "sc" },
            { key: "sc6", label: "Seldom Used Customer",           sub: "sc-sc6",  tab: "sc" },
          ].map(({ key, label, sub, tab }) => (
            <div
              key={key} className="vc vc-link"
              onClick={() => onNavigate?.(tab, sub, label)}
            >
              <div className="vc-hover-badge">자세히 보기 →</div>
              <div className="vc-lbl">{label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <div className="vc-val">{(scCount[key] ?? 0).toLocaleString("ko-KR")}</div>
                <div className="vc-unit">건</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
