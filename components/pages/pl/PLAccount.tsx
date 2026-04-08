"use client";

import { useEffect, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLAccount, fetchPLAccountDetail } from "@/lib/api";
import ReactECharts from "echarts-for-react";

const fmt    = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtM   = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

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
function TopCounterpartyPie({ data }: { data: Detail["counterparty"] }) {
  const total = data.reduce((s, d) => s + Math.abs(d.cur), 0) || 1;

  const option = {
    tooltip: { trigger: "item", formatter: (p: { name: string; percent: number }) => `${p.name}<br/>${p.percent.toFixed(1)}%` },
    legend: {
      orient: "vertical",
      right: "2%",
      top: "middle",
      textStyle: { fontSize: 10, color: "#555" },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
    },
    color: DONUT_COLORS,
    series: [{
      name: "당기 비중",
      type: "pie",
      radius: ["38%", "70%"],
      center: ["38%", "50%"],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
      label: { show: false, position: "center" },
      emphasis: {
        label: {
          show: true,
          fontSize: 13,
          fontWeight: "bold",
          formatter: (p: { name: string; percent: number }) => `${p.name.length > 6 ? p.name.slice(0,6)+"…" : p.name}\n${p.percent.toFixed(1)}%`,
        },
      },
      labelLine: { show: false },
      data: data.map((d, i) => ({
        value: Math.abs(d.cur),
        name: d.name,
        itemStyle: { color: DONUT_COLORS[i % DONUT_COLORS.length] },
      })),
    }],
  };

  return (
    <ReactECharts option={option} style={{ width: "100%", height: 300 }} notMerge />
  );
}

// ── 거래처별 당기/전기 증감 바 ────────────────────────────────
function CounterpartyChangeBar({ data }: { data: Detail["counterparty"] }) {
  const maxVal = Math.max(...data.flatMap(d => [Math.abs(d.cur), Math.abs(d.pri)]), 1);
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 10, color: "#888" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "#E87722", borderRadius: 2 }} />당기금액
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(160,160,160,0.35)", border: "1px solid #ccc", borderRadius: 2 }} />전기금액
        </span>
      </div>
      {data.map((d) => {
        const curPct = Math.abs(d.cur) / maxVal * 100;
        const priPct = Math.abs(d.pri) / maxVal * 100;
        return (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 100, fontSize: 11, color: "#555", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ flex: 1, position: "relative", height: 28 }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 12, background: "#F0F0F0", borderRadius: 3 }}>
                <div style={{ width: `${priPct}%`, height: "100%", background: "rgba(160,160,160,0.4)", border: "1px solid #D0D0D0", borderRadius: 3, boxSizing: "border-box" }} />
              </div>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, background: "#F5F5F5", borderRadius: 3 }}>
                <div style={{ width: `${curPct}%`, height: "100%", background: "#E87722", borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ width: 70, fontSize: 10, color: "#777", textAlign: "right", flexShrink: 0, lineHeight: 1.6 }}>
              <div style={{ color: "#E87722", fontWeight: 700 }}>{fmtM(Math.abs(d.cur))}백만</div>
              <div>{fmtM(Math.abs(d.pri))}백만</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PLAccount() {
  const filter  = useFilter();
  const [rows,     setRows]     = useState<AcctRow[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);   // mgmt_acct
  const [detail,   setDetail]   = useState<Detail | null>(null);
  const [loadingD, setLoadingD] = useState(false);
  const [leftH,    setLeftH]    = useState<number | undefined>(undefined);
  const leftRef   = useRef<HTMLDivElement>(null);

  // 왼쪽 카드 높이 실시간 측정
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
    if (!selected) { setDetail(null); return; }
    setLoadingD(true);
    fetchPLAccountDetail(filter, selected)
      .then(d => { setDetail(d as Detail); setLoadingD(false); })
      .catch(() => setLoadingD(false));
  }, [selected, filter.baseYm, filter.periodType]);


  if (!rows) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));
  const selectMgmt = (mgmt: string) => setSelected(prev => prev === mgmt ? null : mgmt);

  // disclosure_acct → mgmt_acct → account_name 그룹화, PL_ORDER 순서
  const byDisclosure = rows.reduce<Record<string, Record<string, AcctRow[]>>>((acc, r) => {
    if (!acc[r.disclosure_acct]) acc[r.disclosure_acct] = {};
    if (!acc[r.disclosure_acct][r.mgmt_acct]) acc[r.disclosure_acct][r.mgmt_acct] = [];
    acc[r.disclosure_acct][r.mgmt_acct].push(r);
    return acc;
  }, {});
  const orderedDisc = PL_ORDER.filter(d => byDisclosure[d]);

  const month = filter.baseYm.split("-")[1].replace(/^0/, "");
  const periodLabel = filter.periodType === "cumulative" ? `${month}월 누적` : `${month}월 당월`;

  // 선택된 mgmt_acct의 당기/전기 합계
  const selRows = selected ? rows.filter(r => r.mgmt_acct === selected) : [];
  const selCur  = selRows.reduce((s, r) => s + r.current, 0);
  const selPri  = selRows.reduce((s, r) => s + r.prior, 0);
  const selChg  = selCur - selPri;

  return (
    <div className="wrap">

      <div style={{ display: "grid", gridTemplateColumns: selected ? "2fr 3fr" : "1fr", gap: 14, alignItems: "start" }}>

        {/* ── 손익계산서 테이블 ── */}
        <div ref={leftRef} className="card" style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>손익항목</div>
            {selected && (
              <button
                onClick={() => { setSelected(null); setDetail(null); }}
                style={{ fontSize: 10, color: "#aaa", background: "none", border: "1px solid #E0E0E0", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
              >선택 해제</button>
            )}
          </div>
          {!selected && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(232,119,34,0.07)", borderRadius: 6,
              padding: "7px 12px", marginBottom: 10, fontSize: 11, color: "#E87722",
            }}>
              <span style={{ fontSize: 14 }}>👆</span>
              관리계정 행을 클릭하면 거래처별 증감 및 전표 내역을 확인할 수 있습니다.
            </div>
          )}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>계정</th><th>당기</th><th>전기</th><th>증감률</th></tr>
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
                        {discChg >= 0 ? "▲" : "▼"}{Math.abs(discChg * 100).toFixed(1)}%
                      </td>
                    </tr>,
                    ...(!discOpen ? [] : Object.entries(mgmtMap).map(([mgmt, accts]) => {
                      const mgmtCur = accts.reduce((s, r) => s + r.current, 0);
                      const mgmtPri = accts.reduce((s, r) => s + r.prior, 0);
                      const mgmtChg = mgmtPri ? (mgmtCur - mgmtPri) / Math.abs(mgmtPri) : 0;
                      const mgmtKey = `m-${disc}-${mgmt}`;
                      const mgmtOpen = expanded[mgmtKey];
                      const isActive = selected === mgmt;

                      return [
                        <tr
                          key={mgmtKey}
                          style={{
                            cursor: "pointer",
                            background: isActive ? "#FFF4EC" : "#FFF8F3",
                            borderLeft: isActive ? "3px solid #E87722" : "3px solid transparent",
                          }}
                          onClick={() => selectMgmt(mgmt)}
                        >
                          <td className="td-s1" style={{ color: isActive ? "#E87722" : undefined, fontWeight: isActive ? 700 : undefined }}>
                            <span
                              style={{ marginRight: 4, fontSize: 10, color: "#bbb" }}
                              onClick={(e) => { e.stopPropagation(); toggle(mgmtKey); }}
                            >
                              {mgmtOpen ? "▼" : "▶"}
                            </span>
                            {mgmt}
                          </td>
                          <td>{fmt(mgmtCur)}</td>
                          <td>{fmt(mgmtPri)}</td>
                          <td className={mgmtChg >= 0 ? "up-t" : "dn-t"}>
                            {mgmtChg >= 0 ? "▲" : "▼"}{Math.abs(mgmtChg * 100).toFixed(1)}%
                          </td>
                        </tr>,
                        ...(!mgmtOpen ? [] : accts.map(r => (
                          <tr key={`${r.mgmt_acct}-${r.account_name}`} style={{ background: "#FFFAF6" }}>
                            <td style={{ paddingLeft: 40, color: "#999" }}>{r.account_name}</td>
                            <td>{fmt(r.current)}</td>
                            <td>{fmt(r.prior)}</td>
                            <td className={r.change_pct >= 0 ? "up-t" : "dn-t"}>
                              {r.change_pct >= 0 ? "▲" : "▼"}{Math.abs(r.change_pct * 100).toFixed(1)}%
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
              <div style={{ padding: 30, color: "#aaa", textAlign: "center" }}>로딩 중...</div>
            )}

            {detail && (
              <>
                {/* 요약카드 */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 12 }}>
                    {detail.mgmt_acct}
                    <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa", marginLeft: 6 }}>{periodLabel}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {(() => {
                      const selChgPct = selPri !== 0 ? selChg / Math.abs(selPri) * 100 : 0;
                      return [
                        { label: "당기금액", display: `${Math.abs(Math.round(selCur)).toLocaleString("ko-KR")}`, color: "#2C2C2C" },
                        { label: "전기금액", display: `${Math.abs(Math.round(selPri)).toLocaleString("ko-KR")}`, color: "#2C2C2C" },
                        { label: "증감액",   display: `${selChg < 0 ? "-" : ""}${Math.abs(Math.round(selChg)).toLocaleString("ko-KR")}`, color: selChg >= 0 ? "#EF4444" : "#2563EB" },
                        { label: "증감률",   display: `${selChgPct >= 0 ? "▲" : "▼"}${Math.abs(selChgPct).toFixed(1)}%`, color: selChgPct >= 0 ? "#EF4444" : "#2563EB" },
                      ].map(({ label, display, color }) => (
                        <div key={label} style={{ background: "#F9F9F9", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>{label}</div>
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
                    <TopCounterpartyPie data={detail.counterparty} />
                  </div>
                  <div className="card">
                    <div className="card-title">거래처별 당기/전기</div>
                    <CounterpartyChangeBar data={detail.counterparty} />
                  </div>
                </div>

                {/* 전표 내역 — 당기/전기 위아래, 남은 공간 반반 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
                  {[
                    { title: "당기 전표 내역", vouchers: detail.cur_vouchers },
                    { title: "전기 전표 내역", vouchers: detail.pri_vouchers },
                  ].map(({ title, vouchers }) => (
                    <div key={title} className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <div className="card-title">{title}</div>
                      <div className="tbl-wrap" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                        <table>
                          <thead>
                            <tr><th>일자</th><th>전표번호</th><th>거래처</th><th>적요</th><th>차/대</th><th>금액</th></tr>
                          </thead>
                          <tbody>
                            {vouchers.length === 0 && (
                              <tr><td colSpan={6} style={{ textAlign: "center", color: "#bbb", padding: 16 }}>내역 없음</td></tr>
                            )}
                            {vouchers.map((v, i) => (
                              <tr key={i}>
                                <td style={{ whiteSpace: "nowrap" }}>{v.date}</td>
                                <td>{v.voucher_no}</td>
                                <td>{v.counterparty ?? "-"}</td>
                                <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description ?? "-"}</td>
                                <td style={{ color: v.dr_cr === "차변" ? "#2563EB" : "#EF4444", fontWeight: 600 }}>{v.dr_cr}</td>
                                <td>{fmt(v.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          {vouchers.length > 0 && (
                            <tfoot>
                              <tr className="tr-sum">
                                <td colSpan={5}>합계</td>
                                <td>{fmt(vouchers.reduce((s, v) => s + v.amount, 0))}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
