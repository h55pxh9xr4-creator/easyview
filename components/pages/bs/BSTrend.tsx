"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFilter } from "@/hooks/useFilter";
import {
  fetchBSDisclosures, fetchBSAcctNames,
  fetchBSDailyBalance, fetchBSDailyDetail,
  DailyBalanceRow, DailyDetailData,
} from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  LineController, BarController,
  LineElement, BarElement, PointElement,
  Filler, Tooltip, Legend,
  type ChartOptions,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale,
  LineController, BarController,
  LineElement, BarElement, PointElement,
  Filler, Tooltip, Legend,
);

const ORANGE = "rgba(232,119,34,0.9)";
const ORANGE_FILL = "rgba(232,119,34,0.15)";
const BLUE   = "rgba(37,99,235,0.85)";
const RED    = "rgba(220,38,38,0.85)";

const fmtAmt = (n: number) => Math.round(n / 10000).toLocaleString("ko-KR");

function Spinner() {
  return (
    <>
      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── 거래처 구성 비율 바 ────────────────────────────────────────
function CpBar({ items, color }: { items: { name: string; amount: number }[]; color: string }) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  if (!total) return <div style={{ color: "#bbb", fontSize: 12 }}>데이터 없음</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* 비율 바 */}
      <div style={{ display: "flex", height: 28, borderRadius: 4, overflow: "hidden", gap: 1 }}>
        {items.slice(0, 6).map((item, i) => {
          const pct = (item.amount / total) * 100;
          const alpha = 0.9 - i * 0.1;
          return (
            <div
              key={item.name}
              title={`${item.name}: ${fmtAmt(item.amount)}만원 (${pct.toFixed(1)}%)`}
              style={{
                width: `${pct}%`, backgroundColor: color.replace(/[\d.]+\)$/, `${alpha})`),
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", cursor: "default",
              }}
            />
          );
        })}
      </div>
      {/* 범례 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
        {items.slice(0, 6).map((item, i) => {
          const pct = (item.amount / total) * 100;
          const alpha = 0.9 - i * 0.1;
          return (
            <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#555" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, backgroundColor: color.replace(/[\d.]+\)$/, `${alpha})`) }} />
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
              <span style={{ color: "#999" }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BSTrend() {
  const filter = useFilter();

  // ── 필터 상태 ────────────────────────────────────────────────
  const [disclosures,    setDisclosures]    = useState<string[]>([]);
  const [acctNames,      setAcctNames]      = useState<string[]>([]);
  const [selDisclosure,  setSelDisclosure]  = useState("");
  const [selAcctName,    setSelAcctName]    = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");

  // ── 데이터 상태 ──────────────────────────────────────────────
  const [balanceRows,    setBalanceRows]    = useState<DailyBalanceRow[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [detail,         setDetail]         = useState<DailyDetailData | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);

  const chartRef = useRef<ChartJS<"line"> | null>(null);

  // ── 초기 공시용계정 목록 ─────────────────────────────────────
  useEffect(() => {
    fetchBSDisclosures().then(list => {
      setDisclosures(list);
      if (list.length > 0) setSelDisclosure(list[0]);
    }).catch(console.error);
  }, []);

  // ── baseYm 변경 시 기간 기본값 설정 ──────────────────────────
  useEffect(() => {
    const year = filter.baseYm.slice(0, 4);
    setDateFrom(`${year}-01-01`);
    setDateTo(`${filter.baseYm}-${new Date(parseInt(year), parseInt(filter.baseYm.slice(5, 7)), 0).getDate().toString().padStart(2, "0")}`);
  }, [filter.baseYm]);

  // ── 공시용계정 변경 시 계정과목 목록 갱신 ────────────────────
  useEffect(() => {
    if (!selDisclosure) return;
    setSelAcctName("");
    fetchBSAcctNames(selDisclosure).then(list => setAcctNames(list)).catch(console.error);
  }, [selDisclosure]);

  // ── 일별잔액 조회 ────────────────────────────────────────────
  const loadBalance = useCallback(() => {
    if (!selDisclosure || !dateFrom || !dateTo) return;
    setBalanceLoading(true);
    setSelectedDate(null);
    setDetail(null);
    fetchBSDailyBalance(selDisclosure, selAcctName || null, dateFrom, dateTo)
      .then(rows => setBalanceRows(rows))
      .catch(console.error)
      .finally(() => setBalanceLoading(false));
  }, [selDisclosure, selAcctName, dateFrom, dateTo]);

  useEffect(() => {
    if (selDisclosure && dateFrom && dateTo) loadBalance();
  }, [selDisclosure, selAcctName, dateFrom, dateTo, loadBalance]);

  // ── 날짜 클릭 → 상세 조회 ────────────────────────────────────
  const loadDetail = useCallback((date: string) => {
    if (!selDisclosure) return;
    setSelectedDate(date);
    setDetailLoading(true);
    fetchBSDailyDetail(selDisclosure, selAcctName || null, date)
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selDisclosure, selAcctName]);

  // ── 차트 데이터 ──────────────────────────────────────────────
  const chartLabels = balanceRows.map(r => r.date);
  // 5일 간격으로만 라벨 표시
  const displayLabels = chartLabels.map((l, i) => {
    const d = new Date(l);
    return (i === 0 || d.getDate() === 1) ? `${d.getMonth() + 1}/${d.getDate()}` : "";
  });

  const avgBalance = balanceRows.length
    ? Math.round(balanceRows.reduce((s, r) => s + r.balance, 0) / balanceRows.length)
    : 0;

  const chartData = {
    labels: displayLabels,
    datasets: [
      {
        label: selAcctName || selDisclosure || "잔액",
        data: balanceRows.map(r => Math.round(r.balance / 10000)),
        borderColor: ORANGE,
        backgroundColor: ORANGE_FILL,
        fill: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 1.5,
      },
      {
        label: "평균",
        data: balanceRows.map(() => Math.round(avgBalance / 10000)),
        borderColor: "rgba(150,150,150,0.6)",
        backgroundColor: "transparent",
        fill: false,
        borderDash: [4, 3],
        pointRadius: 0,
        borderWidth: 1,
        tension: 0,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", labels: { color: "#888", font: { size: 10 }, boxWidth: 8, padding: 8 } },
      tooltip: {
        callbacks: {
          title: ctx => {
            const idx = ctx[0].dataIndex;
            return balanceRows[idx]?.date ?? "";
          },
          label: ctx => {
            if (ctx.datasetIndex === 1) return ` 평균: ${(ctx.parsed.y as number).toLocaleString("ko-KR")}만원`;
            return ` 잔액: ${(ctx.parsed.y as number).toLocaleString("ko-KR")}만원`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#bbb", font: { size: 9 }, maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: "#bbb", font: { size: 9 }, maxTicksLimit: 6,
          callback: v => `${Number(v).toLocaleString("ko-KR")}만`,
        },
        grid: { color: "#f5f5f5" },
      },
    },
    onClick: (_evt, elements, chart) => {
      if (!elements.length) return;
      const idx = elements[0].index;
      const date = balanceRows[idx]?.date;
      if (date) loadDetail(date);
    },
  };

  // 상대계정 테이블 합계
  const caTotalDr = detail?.counter_accounts.reduce((s, r) => s + r.dr, 0) ?? 0;
  const caTotalCr = detail?.counter_accounts.reduce((s, r) => s + r.cr, 0) ?? 0;

  return (
    <div className="wrap">

      {/* ── 필터 바 ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* 공시용계정 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>공시용계정</span>
            <select
              value={selDisclosure}
              onChange={e => setSelDisclosure(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, color: "#333", minWidth: 160 }}
            >
              {disclosures.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {/* 계정과목 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>계정과목</span>
            <select
              value={selAcctName}
              onChange={e => setSelAcctName(e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, color: "#333", minWidth: 140 }}
            >
              <option value="">모두</option>
              {acctNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {/* 기간 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>기간</span>
            <input
              type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize: 12, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 4, color: "#333" }}
            />
            <span style={{ fontSize: 11, color: "#bbb" }}>~</span>
            <input
              type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ fontSize: 12, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 4, color: "#333" }}
            />
          </div>
        </div>
      </div>

      {/* ── 일별 잔액 추이 차트 ────────────────────────────────── */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            일별 잔액 추이
            {selAcctName ? ` — ${selAcctName}` : selDisclosure ? ` — ${selDisclosure}` : ""}
          </div>
          {avgBalance !== 0 && (
            <div style={{ fontSize: 11, color: "#888" }}>
              평균 <span style={{ color: ORANGE, fontWeight: 700 }}>{fmtAmt(avgBalance)}만원</span>
            </div>
          )}
        </div>
        {balanceLoading ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#bbb", fontSize: 12 }}>
            <Spinner /> 데이터 로딩 중...
          </div>
        ) : balanceRows.length === 0 ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 12 }}>
            조회 결과가 없습니다
          </div>
        ) : (
          <>
            <div style={{ height: 200 }}>
              <Line ref={chartRef} data={chartData} options={chartOptions} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "#bbb", textAlign: "center" }}>
              차트를 클릭하면 해당 일자의 상세 내역을 확인할 수 있습니다
            </div>
          </>
        )}
      </div>

      {/* ── 상세 패널 (클릭 시 표시) ────────────────────────────── */}
      {(selectedDate || detailLoading) && (
        <div>
          <div className="sec-hd">
            <span className="sec-hd-txt">
              {selectedDate} 상세내역
              {selAcctName ? ` — ${selAcctName}` : selDisclosure ? ` — ${selDisclosure}` : ""}
            </span>
            <div className="sec-hd-line" />
            <button
              onClick={() => { setSelectedDate(null); setDetail(null); }}
              style={{ marginLeft: 8, fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
            >✕</button>
          </div>

          {detailLoading ? (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#bbb", fontSize: 12, padding: 40 }}>
              <Spinner /> 데이터 로딩 중...
            </div>
          ) : detail && (
            <>
              {/* ── 거래처 구성 ──────────────────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="card">
                  <div className="card-title">거래처 구성 (차변)</div>
                  {detail.counterparty_dr.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#bbb" }}>해당 없음</div>
                  ) : (
                    <CpBar items={detail.counterparty_dr} color={BLUE} />
                  )}
                </div>
                <div className="card">
                  <div className="card-title">거래처 구성 (대변)</div>
                  {detail.counterparty_cr.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#bbb" }}>해당 없음</div>
                  ) : (
                    <CpBar items={detail.counterparty_cr} color={RED} />
                  )}
                </div>
              </div>

              {/* ── 상대계정 ─────────────────────────────────── */}
              <div className="card">
                <div className="card-title">상대계정</div>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>계정과목</th>
                        <th>공시용계정</th>
                        <th style={{ textAlign: "right" }}>차변</th>
                        <th style={{ textAlign: "right" }}>대변</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.counter_accounts.map((r, i) => (
                        <tr key={i}>
                          <td>{r.account_name}</td>
                          <td style={{ color: "#888" }}>{r.disclosure_acct}</td>
                          <td style={{ textAlign: "right", color: r.dr ? BLUE : "#ccc" }}>
                            {r.dr ? fmtAmt(r.dr) : "-"}
                          </td>
                          <td style={{ textAlign: "right", color: r.cr ? RED : "#ccc" }}>
                            {r.cr ? fmtAmt(r.cr) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, backgroundColor: "#FFF7F0" }}>
                        <td colSpan={2}>합계</td>
                        <td style={{ textAlign: "right", color: BLUE }}>{fmtAmt(caTotalDr)}</td>
                        <td style={{ textAlign: "right", color: RED }}>{fmtAmt(caTotalCr)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ── 전표 상세내역 ─────────────────────────────── */}
              <div className="card">
                <div className="card-title">전표 상세내역</div>
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>일자</th>
                        <th>전표번호</th>
                        <th>계정과목</th>
                        <th>거래처</th>
                        <th>적요</th>
                        <th style={{ textAlign: "right" }}>차변</th>
                        <th style={{ textAlign: "right" }}>대변</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.vouchers.map((v, i) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: "nowrap" }}>{v.date}</td>
                          <td style={{ color: "#888", fontSize: 11 }}>{v.voucher_no}</td>
                          <td>{v.account_name}</td>
                          <td style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                          <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#666" }}>{v.description}</td>
                          <td style={{ textAlign: "right", color: v.dr_cr === "차변" ? BLUE : "#ccc" }}>
                            {v.dr_cr === "차변" ? fmtAmt(v.amount) : "-"}
                          </td>
                          <td style={{ textAlign: "right", color: v.dr_cr === "대변" ? RED : "#ccc" }}>
                            {v.dr_cr === "대변" ? fmtAmt(v.amount) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
