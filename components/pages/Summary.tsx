"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import {
  fetchKPI, fetchTop3, fetchIndicators,
  fetchPLTable, fetchBSTable, fetchScenarioCount,
  KPIData, Top3Data, IndicatorData, PLTableRow, BSTableRow, ScenarioCountData,
} from "@/lib/api";

// ── 숫자 포맷 헬퍼 ──────────────────────────────────────────
const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR"); // 백만 단위
const fmtPct = (p: number) => `${(p * 100).toFixed(1)}%`;
const arrow = (p: number) => p >= 0 ? "up" : "dn";
const arrowTxt = (p: number) => p >= 0 ? `▲ ${Math.abs(p * 100).toFixed(1)}%` : `▼ ${Math.abs(p * 100).toFixed(1)}%`;

export default function Summary() {
  const filter = useFilter();
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [top3, setTop3] = useState<Top3Data | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [plTable, setPlTable] = useState<PLTableRow[] | null>(null);
  const [bsTable, setBsTable] = useState<BSTableRow[] | null>(null);
  const [scCount, setScCount] = useState<ScenarioCountData | null>(null);

  useEffect(() => {
    Promise.all([
      fetchKPI(filter).then(setKpi),
      fetchTop3(filter).then(setTop3),
      fetchIndicators(filter).then(setIndicators),
      fetchPLTable(filter).then(setPlTable),
      fetchBSTable(filter).then(setBsTable),
      fetchScenarioCount(filter).then(setScCount),
    ]).catch(console.error);
  }, [filter.baseYm, filter.periodType, filter.compareTarget, filter.bsBase]);

  if (!kpi || !top3 || !indicators || !plTable || !bsTable || !scCount) {
    return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;
  }

  const kpiItems = [
    { key: "revenue",          label: "매출액" },
    { key: "operating_income", label: "영업이익" },
    { key: "asset",            label: "자산" },
    { key: "liability",        label: "부채" },
  ];

  return (
    <div className="wrap">

      {/* ── KPI Strip ── */}
      <div className="kpi-strip">
        {kpiItems.map(({ key, label }) => {
          const d = kpi[key];
          return (
            <div key={key} className="kpi">
              <div className="kpi-lbl">{label}</div>
              <div className="kpi-val">{fmtB(d.value)}<span className="u">백만</span></div>
              <div className={`kpi-chg ${arrow(d.change_pct)}`}>
                {arrowTxt(d.change_pct)} <span style={{ color: "#bbb", fontWeight: 400 }}>{d.vs}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Top3 Rankings ── */}
      <div className="g4">
        {[
          { key: "revenue_counterparty", title: "매출액 증가 상위 3개 거래처" },
          { key: "cost_account",         title: "비용 증가 상위 3개 계정" },
          { key: "asset_account",        title: "자산 증가 상위 3개 계정" },
          { key: "liability_account",    title: "부채 증가 상위 3개 계정" },
        ].map(({ key, title }) => (
          <div key={key} className="card">
            <div className="card-title">{title}</div>
            {(top3[key] ?? []).map((item) => (
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
        ))}
      </div>

      {/* ── 지표 ── */}
      <div className="g2">
        <div className="card">
          <div className="card-title">손익지표</div>
          <div className="ind-row">
            <div className="ind-item"><div className="ind-lbl">매출총이익률</div><div className="ind-val c5">{fmtPct(indicators.pl.gross_profit_margin)}</div></div>
            <div className="ind-item"><div className="ind-lbl">영업이익률</div><div className="ind-val c1">{fmtPct(indicators.pl.operating_margin)}</div></div>
            <div className="ind-item"><div className="ind-lbl">당기손익률</div><div className="ind-val c2">{fmtPct(indicators.pl.net_margin)}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">유동성지표</div>
          <div className="ind-row">
            <div className="ind-item"><div className="ind-lbl">부채비율</div><div className="ind-val c2">{fmtPct(indicators.bs.debt_ratio)}</div></div>
            <div className="ind-item"><div className="ind-lbl">유동비율</div><div className="ind-val c4">{fmtPct(indicators.bs.current_ratio)}</div></div>
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
                    <td className={`${row.change_pct >= 0 ? "up-t" : "dn-t"}`}>
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
                    <td className={`${row.change_pct >= 0 ? "up-t" : "dn-t"}`}>
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
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>시나리오 전표수</div>
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
