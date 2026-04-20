"use client";

import { useCallback, useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { useDarkMode } from "@/hooks/useDarkMode";
import { fetchBSAccount, fetchBSDisclosureDetail, BSDisclosureDetail } from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  LineController, LineElement, PointElement,
  BarController, BarElement,
  Filler, Tooltip, Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, BarController, BarElement, Filler, Tooltip, Legend);

const ORANGE = "#E87722";
const BLUE   = "rgba(37,99,235,1)";
const RED    = "rgba(220,38,38,1)";
const fmtB   = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const fmtM   = (n: number) => Math.round(n / 10_000).toLocaleString("ko-KR");
const fmtChg = (p: number) => `${p >= 0 ? "▲" : "▼"}${Math.abs(p * 100).toFixed(1)}%`;

interface BSAcctRow {
  category: string; sum_acct: string; mgmt_acct: string;
  disclosure_acct: string; ending: number; opening: number; change_pct: number;
}

const CATS = ["자산", "부채", "자본"];
const CAT_COLOR: Record<string, string> = { 자산: "#2563EB", 부채: "#EF4444", 자본: "#16A34A" };

export default function BSAccount() {
  const isDark  = useDarkMode();
  const filter  = useFilter();
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const [rows,     setRows]     = useState<BSAcctRow[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected,          setSelected]          = useState<string | null>(null);
  const [detail,            setDetail]            = useState<BSDisclosureDetail | null>(null);
  const [loadingD,          setLoadingD]          = useState(false);
  const [detailErr,         setDetailErr]         = useState(false);
  const [selectedTrendIdx,  setSelectedTrendIdx]  = useState<number | null>(null);
  const [monthDetail,       setMonthDetail]       = useState<BSDisclosureDetail | null>(null);
  const [loadingM,          setLoadingM]          = useState(false);

  useEffect(() => {
    setRows(null); setSelected(null); setDetail(null);
    fetchBSAccount(filter).then(d => setRows(d as BSAcctRow[])).catch(console.error);
  }, [filter.baseYm, filter.bsBase]);

  useEffect(() => {
    if (!selected) { setDetail(null); setMonthDetail(null); setSelectedTrendIdx(null); return; }
    setLoadingD(true); setDetailErr(false);
    setSelectedTrendIdx(null); setMonthDetail(null);
    fetchBSDisclosureDetail(filter, selected)
      .then(d => { setDetail(d); setLoadingD(false); })
      .catch(() => { setLoadingD(false); setDetailErr(true); });
  }, [selected, filter.baseYm]);

  const handleTrendClick = useCallback((_e: unknown, elements: { index: number }[]) => {
    if (!detail || !selected) return;
    if (!elements.length) { setSelectedTrendIdx(null); setMonthDetail(null); return; }
    const idx = elements[0].index;
    if (selectedTrendIdx === idx) { setSelectedTrendIdx(null); setMonthDetail(null); return; }
    setSelectedTrendIdx(idx);
    const ym = detail.monthly_trend[idx]?.year_month;
    if (!ym) return;
    setLoadingM(true);
    fetchBSDisclosureDetail({ ...filter, baseYm: ym }, selected)
      .then(d => { setMonthDetail(d); setLoadingM(false); })
      .catch(() => setLoadingM(false));
  }, [detail, filter, selected, selectedTrendIdx]);

  // 다크모드 색상
  const subTxt    = isDark ? "#9198A8" : "#888";
  const dimTxt    = isDark ? "#5A6070" : "#aaa";
  const valTxt    = isDark ? "#C8CCDA" : "#666";
  const zeroClr   = isDark ? "#3A3F4A" : "#ccc";
  const sumRowBg  = isDark ? "#252830" : "#FAFAFA";
  const sumTxtClr = isDark ? "#C8CCDA" : "#555";
  const discRowBg = isDark ? "rgba(232,119,34,0.05)" : "#FFF8F3";
  const actRowBg  = isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC";
  const miniCardBg = isDark ? "#252830" : "#FAFAFA";
  const miniLblClr = isDark ? "#9198A8" : "#999";
  const miniValClr = isDark ? "#E2E5EC" : "#2C2C2C";
  const barTrack  = isDark ? "#252830" : "#F5F5F5";
  const tfootBg   = isDark ? "rgba(232,119,34,0.10)" : "#FFF7F0";
  const btnBdr    = isDark ? "#2E3039" : "#E0E0E0";
  const gridClr   = isDark ? "#2E3039" : "#f5f5f5";
  const tickClr   = isDark ? "#9198A8" : "#bbb";
  const tipBg     = isDark ? "#1C1F26" : "#fff";
  const tipBdr    = isDark ? "#2E3039" : "#eee";
  const tipTxt    = isDark ? "#E2E5EC" : "#333";

  if (!rows) return (
    <div className="wrap" style={{ padding: 40, color: dimTxt, display: "flex", gap: 8, alignItems: "center" }}>
      <div className="spinner" style={{ width:14, height:14 }} />
      로딩 중...
    </div>
  );

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));
  const selectDisc = (disc: string) => setSelected(prev => prev === disc ? null : disc);

  const byCategory = rows.reduce<Record<string, Record<string, Record<string, BSAcctRow[]>>>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = {};
    if (!acc[r.category][r.sum_acct]) acc[r.category][r.sum_acct] = {};
    if (!acc[r.category][r.sum_acct][r.disclosure_acct]) acc[r.category][r.sum_acct][r.disclosure_acct] = [];
    acc[r.category][r.sum_acct][r.disclosure_acct].push(r);
    return acc;
  }, {});

  const selRows   = selected ? rows.filter(r => r.disclosure_acct === selected) : [];
  const selEnd    = selRows.reduce((s, r) => s + r.ending, 0);
  const selOpn    = selRows.reduce((s, r) => s + r.opening, 0);

  // 트렌드 클릭 시 해당 월 기준으로 KPI 재계산
  const trendEnd  = selectedTrendIdx !== null && detail ? (detail.monthly_trend[selectedTrendIdx]?.ending ?? selEnd) : selEnd;
  const trendOpn  = selectedTrendIdx !== null && detail && selectedTrendIdx > 0
    ? (detail.monthly_trend[selectedTrendIdx - 1]?.ending ?? selOpn) : selOpn;
  const dispEnd   = selectedTrendIdx !== null ? trendEnd : selEnd;
  const dispOpn   = selectedTrendIdx !== null ? trendOpn : selOpn;
  const dispChg   = dispEnd - dispOpn;
  const dispChgPct = dispOpn ? dispChg / Math.abs(dispOpn) : 0;
  const selectedLabel = selectedTrendIdx !== null && detail
    ? (() => { const r = detail.monthly_trend[selectedTrendIdx]; const [y, m] = r.year_month.split("-"); return `${y.slice(2)}/${parseInt(m)}월`; })()
    : null;

  // 하위 패널: 트렌드 월 선택 시 monthDetail 우선, 없으면 detail
  const activeDetail = monthDetail ?? detail;

  const cpItems = activeDetail?.counterparty_changes.slice(0, 10) ?? [];
  const cpMax   = Math.max(...cpItems.map(c => Math.abs(c.net)), 1);

  const trendLabels = (detail?.monthly_trend ?? []).map(r => {
    const [y, m] = r.year_month.split("-");
    return `${y.slice(2)}/${parseInt(m)}월`;
  });

  return (
    <div className="wrap">
      <div style={{ display: "grid", gridTemplateColumns: selected ? "2fr 3fr" : "1fr", gap: 14, alignItems: "start" }}>

        {/* ── 재무항목 표 ─────────────────────────────────────── */}
        <div className="card" style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>재무항목</div>
            {selected && (
              <button
                onClick={() => { setSelected(null); setDetail(null); }}
                style={{ fontSize: 10, color: subTxt, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
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
              행을 클릭하면 거래처별 증감 및 전표 내역을 확인할 수 있습니다.
            </div>
          )}
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "center" }}>분류</th>
                  <th style={{ textAlign: "center" }}>기말</th>
                  <th style={{ textAlign: "center" }}>기초</th>
                  <th style={{ textAlign: "center" }}>증감</th>
                </tr>
              </thead>
              <tbody>
                {CATS.filter(cat => byCategory[cat]).map(cat => {
                  const catMap  = byCategory[cat];
                  const catEnd  = Object.values(catMap).flatMap(s => Object.values(s).flat()).reduce((s, r) => s + r.ending, 0);
                  const catOpn  = Object.values(catMap).flatMap(s => Object.values(s).flat()).reduce((s, r) => s + r.opening, 0);
                  const catChg  = catOpn ? (catEnd - catOpn) / Math.abs(catOpn) : 0;
                  const catKey  = `c-${cat}`;
                  const catOpen = expanded[catKey] ?? true;
                  const color   = CAT_COLOR[cat];

                  return [
                    <tr key={catKey} className="tr-sum" style={{ cursor: "pointer" }} onClick={() => toggle(catKey)}>
                      <td style={{ color }}>{catOpen ? "▼" : "▶"} {cat}</td>
                      <td>{fmtB(catEnd)}</td>
                      <td>{fmtB(catOpn)}</td>
                      <td className={catChg >= 0 ? "up-t" : "dn-t"}>{fmtChg(catChg)}</td>
                    </tr>,

                    ...(!catOpen ? [] : Object.entries(catMap).map(([sum, discMap]) => {
                      const sumEnd  = Object.values(discMap).flat().reduce((s, r) => s + r.ending, 0);
                      const sumOpn  = Object.values(discMap).flat().reduce((s, r) => s + r.opening, 0);
                      const sumChg  = sumOpn ? (sumEnd - sumOpn) / Math.abs(sumOpn) : 0;
                      const sumKey  = `s-${cat}-${sum}`;
                      const sumOpen = expanded[sumKey] ?? true;

                      return [
                        <tr key={sumKey} style={{ cursor: "pointer", background: sumRowBg }} onClick={() => toggle(sumKey)}>
                          <td className="td-s1" style={{ color: sumTxtClr }}>{sumOpen ? "▼" : "▶"} {sum}</td>
                          <td>{fmtB(sumEnd)}</td>
                          <td>{fmtB(sumOpn)}</td>
                          <td className={sumChg >= 0 ? "up-t" : "dn-t"}>{fmtChg(sumChg)}</td>
                        </tr>,

                        ...(!sumOpen ? [] : Object.entries(discMap).map(([disc, accts]) => {
                          const discEnd  = accts.reduce((s, r) => s + r.ending, 0);
                          const discOpn  = accts.reduce((s, r) => s + r.opening, 0);
                          const discChg  = discOpn ? (discEnd - discOpn) / Math.abs(discOpn) : 0;
                          const isActive = selected === disc;

                          return (
                            <tr key={`${cat}-${sum}-${disc}`}
                              style={{
                                cursor: "pointer",
                                background: isActive ? actRowBg : discRowBg,
                                borderLeft: isActive ? `3px solid ${ORANGE}` : "3px solid transparent",
                              }}
                              onClick={() => selectDisc(disc)}
                            >
                              <td style={{ paddingLeft: 32, color: isActive ? ORANGE : (isDark ? "#C8CCDA" : "#444"), fontWeight: isActive ? 700 : undefined }}>
                                {disc}
                              </td>
                              <td>{fmtB(discEnd)}</td>
                              <td>{fmtB(discOpn)}</td>
                              <td className={discChg >= 0 ? "up-t" : "dn-t"}>
                                {fmtChg(discChg)}
                                <button
                                  onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "BS 계정분석", label: disc, value: `${fmtB(discEnd)}백만` }, { top: r.top, right: r.right }); }}
                                  style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: ck.has(commentKey("BS 계정분석", disc)) ? "#E87722" : zeroClr, padding: 0, lineHeight: 1 }}
                                  title="코멘트"
                                >💬</button>
                              </td>
                            </tr>
                          );
                        })),
                      ];
                    })),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 우측 상세 패널 ───────────────────────────────────── */}
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

            {loadingD && (
              <div className="card" style={{ padding: 40, color: dimTxt, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div className="spinner" style={{ width:14, height:14 }} />
                로딩 중...
              </div>
            )}
            {detailErr && (
              <div className="card" style={{ padding: 30, color: "#EF4444", fontSize: 13, textAlign: "center" }}>
                ⚠️ 상세 데이터를 불러오지 못했습니다.<br />
                <span style={{ fontSize: 11, color: subTxt, marginTop: 6, display: "block" }}>백엔드 배포 후 이용 가능합니다.</span>
              </div>
            )}

            {loadingM && (
              <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, color: dimTxt, fontSize: 12 }}>
                <div className="spinner" style={{ width:12, height:12 }} />
                {selectedLabel} 데이터 로딩 중...
              </div>
            )}

            {detail && (
              <>
                {/* 요약카드 */}
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>{selected}</div>
                    {selectedLabel && (
                      <span style={{ fontSize: 11, color: ORANGE, background: "rgba(232,119,34,0.12)", padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {selectedLabel}
                      </span>
                    )}
                    {selectedLabel && (
                      <button onClick={() => { setSelectedTrendIdx(null); setMonthDetail(null); }}
                        style={{ fontSize: 10, color: subTxt, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: "auto" }}>
                        ✕ 전체 기간
                      </button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[
                      { label: "기말금액", display: <>{Math.round(dispEnd).toLocaleString("ko-KR")}</>, color: miniValClr },
                      { label: "기초금액", display: <>{Math.round(dispOpn).toLocaleString("ko-KR")}</>, color: miniValClr },
                      { label: "증감액",   display: <>{Math.round(dispChg).toLocaleString("ko-KR")}</>, color: dispChg >= 0 ? "#EF4444" : "#2563EB" },
                      { label: "증감률",   display: <>{fmtChg(dispChgPct)}</>, color: dispChgPct >= 0 ? "#EF4444" : "#2563EB" },
                    ].map(({ label, display, color }) => (
                      <div key={label} style={{ background: miniCardBg, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: miniLblClr, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color }}>{display}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 상세계정 표 */}
                <div className="card">
                  <div className="card-title">상세계정</div>
                  <div>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "center" }}>관리계정</th>
                          <th style={{ textAlign: "center" }}>계정과목</th>
                          <th style={{ textAlign: "center" }}>기말</th>
                          <th style={{ textAlign: "center" }}>기초</th>
                          <th style={{ textAlign: "center" }}>증감</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeDetail?.account_items ?? []).map((r, i) => {
                          const chg = r.opening ? (r.ending - r.opening) / Math.abs(r.opening) : 0;
                          return (
                            <tr key={i}>
                              <td style={{ textAlign: "left", color: subTxt, fontSize: 11 }}>{r.mgmt_acct}</td>
                              <td style={{ textAlign: "left" }}>{r.account_name}</td>
                              <td style={{ textAlign: "right" }}>{fmtB(r.ending)}</td>
                              <td style={{ textAlign: "right", color: subTxt }}>{fmtB(r.opening)}</td>
                              <td style={{ textAlign: "right" }} className={chg >= 0 ? "up-t" : "dn-t"}>{fmtChg(chg)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 계정별 잔액 추이 */}
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>계정별 잔액 추이</div>
                    <span style={{ fontSize: 10, color: dimTxt }}>— 클릭하면 해당 월로 연동됩니다</span>
                  </div>
                  <div style={{ height: 160, cursor: "pointer" }}>
                    <Line
                      data={{
                        labels: trendLabels,
                        datasets: [{
                          label: selected,
                          data: detail.monthly_trend.map(r => Math.round(r.ending / 1_000_000)),
                          borderColor: ORANGE,
                          backgroundColor: "rgba(232,119,34,0.12)",
                          fill: true, tension: 0.3, borderWidth: 1.5,
                          pointRadius: detail.monthly_trend.map((_, i) => i === selectedTrendIdx ? 7 : 3),
                          pointBackgroundColor: detail.monthly_trend.map((_, i) => i === selectedTrendIdx ? "#fff" : ORANGE),
                          pointBorderColor: detail.monthly_trend.map((_, i) => i === selectedTrendIdx ? ORANGE : ORANGE),
                          pointBorderWidth: detail.monthly_trend.map((_, i) => i === selectedTrendIdx ? 2 : 0),
                          pointHoverRadius: 7,
                        }],
                      }}
                      options={{
                        responsive: true, maintainAspectRatio: false,
                        onClick: (_e, els) => handleTrendClick(_e, els as { index: number }[]),
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: tipBg,
                            borderColor: tipBdr,
                            borderWidth: 1,
                            titleColor: tipTxt,
                            bodyColor: tipTxt,
                            callbacks: {
                              title: ctx => trendLabels[ctx[0].dataIndex] ?? "",
                              label: ctx => ` ${fmtB((ctx.parsed.y as number) * 1_000_000)}백만`,
                            },
                          },
                        },
                        scales: {
                          x: { ticks: { color: tickClr, font: { size: 9 } }, grid: { display: false } },
                          y: { ticks: { color: tickClr, font: { size: 9 }, maxTicksLimit: 5, callback: v => `${Number(v).toLocaleString()}백만` }, grid: { color: gridClr } },
                        },
                      }}
                    />
                  </div>
                </div>

                {/* 거래처별 증감 */}
                <div className="card">
                  <div className="card-title">거래처별 증감</div>
                  {(activeDetail?.counterparty_changes ?? []).length === 0 ? (
                    <div style={{ fontSize: 12, color: dimTxt }}>해당 없음</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {cpItems.map(cp => {
                        const pct   = Math.abs(cp.net) / cpMax * 100;
                        const isPos = cp.net >= 0;
                        return (
                          <div key={cp.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 170, fontSize: 11, color: sumTxtClr, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.name}</div>
                            <div style={{ flex: 1, height: 18, background: barTrack, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: isPos ? BLUE : RED, borderRadius: 3 }} />
                            </div>
                            <div style={{ width: 70, fontSize: 10, color: isPos ? BLUE : RED, textAlign: "right", flexShrink: 0, fontWeight: 700 }}>
                              {fmtM(Math.abs(cp.net))}만
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 당기 전표 내역 */}
                <div className="card">
                  <div className="card-title">당기 전표 내역</div>
                  <div style={{ overflowY: "auto", maxHeight: 280, overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "center" }}>일자</th>
                          <th style={{ textAlign: "center" }}>전표번호</th>
                          <th style={{ textAlign: "center" }}>계정과목</th>
                          <th style={{ textAlign: "center" }}>거래처</th>
                          <th style={{ textAlign: "center" }}>적요</th>
                          <th style={{ textAlign: "center" }}>차변</th>
                          <th style={{ textAlign: "center" }}>대변</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeDetail?.vouchers ?? []).map((v, i) => (
                          <tr key={i} style={{ cursor: "pointer" }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page: "BS 계정분석", label: v.counterparty || v.account_name, value: `${fmtB(v.amount)}백만`, sub: selected ?? undefined }, { top: r.top, right: r.right }); }}>
                            <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>{v.date}</td>
                            <td style={{ textAlign: "center", color: subTxt, fontSize: 11 }}>{v.voucher_no}</td>
                            <td style={{ textAlign: "left" }}>{v.account_name}</td>
                            <td style={{ textAlign: "left", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                            <td style={{ textAlign: "left", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: valTxt }}>{v.description}</td>
                            <td style={{ textAlign: "right", color: v.dr_cr === "차변" ? BLUE : zeroClr }}>
                              {v.dr_cr === "차변" ? fmtB(v.amount) : "-"}
                            </td>
                            <td style={{ textAlign: "right", color: v.dr_cr === "대변" ? RED : zeroClr }}>
                              {v.dr_cr === "대변" ? fmtB(v.amount) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 700, background: tfootBg }}>
                          <td colSpan={5}>합계</td>
                          <td style={{ textAlign: "right", color: BLUE }}>
                            {fmtB((activeDetail?.vouchers ?? []).filter(v => v.dr_cr === "차변").reduce((s, v) => s + v.amount, 0))}
                          </td>
                          <td style={{ textAlign: "right", color: RED }}>
                            {fmtB((activeDetail?.vouchers ?? []).filter(v => v.dr_cr === "대변").reduce((s, v) => s + v.amount, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
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
