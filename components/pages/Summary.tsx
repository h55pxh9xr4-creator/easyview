"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import {
  fetchKPI, fetchTop3, fetchIndicators,
  fetchPLTable, fetchBSTable, fetchScenarioCount, fetchPLTrend, fetchBSTrend,
  KPIData, Top3Data, IndicatorData, PLTableRow, BSTableRow, ScenarioCountData,
} from "@/lib/api";
import ReactECharts from "echarts-for-react";

const fmt    = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtB   = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const fmtPct = (p: number) => `${(p * 100).toFixed(1)}%`;
const arrow  = (p: number) => p >= 0 ? "up" : "dn";
const arrowTxt = (p: number) => p >= 0
  ? `▲ ${Math.abs(p * 100).toFixed(1)}%`
  : `▼ ${Math.abs(p * 100).toFixed(1)}%`;

// ── ECharts Sparkline ─────────────────────────────────────────
function Sparkline({ data, months, color, selectedIdx, onMonthClick }: {
  data: number[];
  months: string[];
  color: string;
  selectedIdx: number | null;
  onMonthClick: (idx: number | null) => void;
}) {
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
        return `<span style="font-size:10px;color:#999">${months[p.dataIndex]}</span><br/><b>${fmtB(p.value)}백만</b>`;
      },
    },
    series: [{
      type: "line" as const,
      data: data.map((v, i) => ({
        value: v,
        symbol: "circle",
        symbolSize: i === selectedIdx ? 7 : 4,
        itemStyle: {
          color: i === selectedIdx ? "#2563EB" : color,
          borderColor: i === selectedIdx ? "#fff" : color,
          borderWidth: i === selectedIdx ? 1.5 : 0,
        },
        emphasis: {
          itemStyle: {
            color: i === selectedIdx ? "#2563EB" : color,
            borderColor: "#fff",
            borderWidth: 1.5,
          },
          symbolSize: 7,
        },
      })),
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
    <ReactECharts
      option={option}
      style={{ height: 60, width: "100%", marginTop: 8, cursor: "pointer" }}
      notMerge={true}
      onEvents={{
        click: (p: { dataIndex?: number }) => {
          if (p.dataIndex === undefined) return;
          onMonthClick(selectedIdx === p.dataIndex ? null : p.dataIndex);
        },
      }}
    />
  );
}

export default function Summary() {
  const filter = useFilter();
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
    return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;
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
            <div key={key} className="kpi" style={{ borderTopColor: color, paddingBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="kpi-lbl">{label}</div>
                {idx !== null && (
                  <span style={{ fontSize: 9, color: "#2563EB", background: "rgba(37,99,235,0.08)", padding: "1px 5px", borderRadius: 6 }}>
                    {months[idx]}
                  </span>
                )}
              </div>
              <div className="kpi-val" style={{ color }}>
                {fmtB(d.value)}<span className="u">백만</span>
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
              <div key={item.rank} className="t3-item">
                <div className={`t3-badge${item.rank === 1 ? " r1" : ""}`}>{item.rank}</div>
                <div className="t3-name">
                  {item.name}
                  <div className="t3-bar-row">
                    <div className="t3-bar-fill" style={{ width: `${item.bar_pct}%` }} />
                  </div>
                </div>
                <div className="t3-val" style={item.rank === 3 ? { color: "#aaa" } : {}}>
                  {fmtB(item.value)}<small> 백만</small>
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
            <div className="ind-item">
              <div className="ind-lbl">매출총이익률</div>
              <div className="ind-val" style={{ color: "#E87722" }}>{fmtPct(indicators.pl.gross_profit_margin)}</div>
            </div>
            <div className="ind-item">
              <div className="ind-lbl">영업이익률</div>
              <div className="ind-val" style={{ color: "#D5476E" }}>{fmtPct(indicators.pl.operating_margin)}</div>
            </div>
            <div className="ind-item">
              <div className="ind-lbl">당기손익률</div>
              <div className="ind-val" style={{ color: "#6D4C41" }}>{fmtPct(indicators.pl.net_margin)}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">유동성지표</div>
          <div className="ind-row">
            <div className="ind-item">
              <div className="ind-lbl">부채비율</div>
              <div className="ind-val" style={{ color: "#2563EB" }}>{fmtPct(indicators.bs.debt_ratio)}</div>
            </div>
            <div className="ind-item">
              <div className="ind-lbl">유동비율</div>
              <div className="ind-val" style={{ color: "#16A34A" }}>{fmtPct(indicators.bs.current_ratio)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 테이블 ── */}
      <div className="g2">
        <div className="card">
          <div className="card-title">손익항목</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>공시용계정</th><th>당기</th><th>전기</th><th>증감률</th></tr></thead>
              <tbody>
                {plTable.map((row) => (
                  <tr key={row.account} className={row.is_subtotal ? "tr-sum" : ""}>
                    <td className={!row.is_subtotal ? "td-s1" : ""}>{row.account}</td>
                    <td>{fmt(row.current)}</td>
                    <td>{fmt(row.prior)}</td>
                    <td className={row.change_pct >= 0 ? "up-t" : "dn-t"}>
                      {row.change_pct >= 0 ? "▲" : "▼"}{Math.abs(row.change_pct * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-title">재무항목</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>재무항목</th><th>기말</th><th>기초</th><th>증감률</th></tr></thead>
              <tbody>
                {bsTable.map((row) => (
                  <tr key={`${row.account}-${row.indent}`} className={row.indent === 0 ? "tr-sum" : ""}>
                    <td className={row.indent === 1 ? "td-s1" : ""}>{row.account}</td>
                    <td>{fmt(row.current)}</td>
                    <td>{fmt(row.prior)}</td>
                    <td className={row.change_pct >= 0 ? "up-t" : "dn-t"}>
                      {row.change_pct >= 0 ? "▲" : "▼"}{Math.abs(row.change_pct * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
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
            { key: "sc1", label: "동일금액 중복" },
            { key: "sc2", label: "현금지급 後 부채인식" },
            { key: "sc3", label: "주말현금지급" },
            { key: "sc4", label: "고액현금지급" },
            { key: "sc5", label: "현금지급 및 비용인식" },
            { key: "sc6", label: "희소 거래처" },
          ].map(({ key, label }) => (
            <div key={key} className="vc">
              <div className="vc-lbl">{label}</div>
              <div className="vc-val">{scCount[key]}</div>
              <div className="vc-unit">건</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
