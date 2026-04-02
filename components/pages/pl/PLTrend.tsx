"use client";

import { useEffect, useRef, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLTrendByAccount, fetchPLAccountDetail } from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  LineController, BarController,
  LineElement, BarElement, PointElement,
  Tooltip, Filler,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, LineController, BarController,
  LineElement, BarElement, PointElement, Tooltip, Filler);

const fmt  = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtM = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");

interface AccountTrend { mgmt_acct: string; disclosure_acct: string; cur: Record<string, number>; pri: Record<string, number> }

const PL_ORDER = ["매출액", "매출원가", "판매비와관리비", "기타수익", "기타비용", "금융수익", "금융비용", "법인세비용"];
interface Voucher { date: string; voucher_no: string; counterparty: string; description: string; amount: number; dr_cr: string }
interface Detail {
  mgmt_acct: string;
  counterparty: { name: string; cur: number; pri: number; change: number }[];
  cur_vouchers: Voucher[];
  pri_vouchers: Voucher[];
}

// ── 미니 스파크라인 ─────────────────────────────────────────
function MiniLine({ cur, pri, months }: { cur: number[]; pri: number[]; months: string[] }) {
  const allVals = [...cur, ...pri].filter(Boolean);
  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals, 1);
  const data = {
    labels: months,
    datasets: [
      { type: "line" as const, data: cur, borderColor: "#E87722", borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
      { type: "line" as const, data: pri, borderColor: "#CCCCCC", borderWidth: 1,   pointRadius: 0, tension: 0.3, fill: false, borderDash: [3,3] },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false as const,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false, min: min * 0.9, max: max * 1.1 },
    },
  };
  return <Chart type="line" data={data} options={opts} />;
}

// ── 거래처별 가로 바차트 (당기/전기) ────────────────────────
function CounterpartyBar({ data }: { data: Detail["counterparty"] }) {
  const maxVal = Math.max(...data.flatMap(d => [Math.abs(d.cur), Math.abs(d.pri)]), 1);
  return (
    <div>
      {/* 범례 */}
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
            <div style={{ width: 110, fontSize: 11, color: "#555", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ flex: 1, position: "relative", height: 28 }}>
              {/* 전기 — 회색, 하단 */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 12, background: "#F0F0F0", borderRadius: 3 }}>
                <div style={{ width: `${priPct}%`, height: "100%", background: "rgba(160,160,160,0.4)", border: "1px solid #D0D0D0", borderRadius: 3, boxSizing: "border-box" }} />
              </div>
              {/* 당기 — 주황, 상단 */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, background: "#F5F5F5", borderRadius: 3 }}>
                <div style={{ width: `${curPct}%`, height: "100%", background: "#E87722", borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ width: 72, fontSize: 10, color: "#777", textAlign: "right", flexShrink: 0, lineHeight: 1.6 }}>
              <div style={{ color: "#E87722", fontWeight: 700 }}>{fmtM(Math.abs(d.cur))}백만</div>
              <div>{fmtM(Math.abs(d.pri))}백만</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PLTrend() {
  const filter = useFilter();
  const [accounts, setAccounts]     = useState<AccountTrend[] | null>(null);
  const [selected, setSelected]     = useState<string | null>(null);
  const [detail,   setDetail]       = useState<Detail | null>(null);
  const [loadingD, setLoadingD]     = useState(false);
  const [discFilter, setDiscFilter] = useState<string>("전체");
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAccounts(null);
    setSelected(null);
    setDetail(null);
    fetchPLTrendByAccount(filter).then(d => setAccounts(d as AccountTrend[])).catch(console.error);
  }, [filter.baseYm, filter.periodType]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setLoadingD(true);
    fetchPLAccountDetail(filter, selected)
      .then(d => { setDetail(d as Detail); setLoadingD(false); })
      .catch(() => setLoadingD(false));
  }, [selected, filter.baseYm, filter.periodType]);

  // 디테일 열릴 때 스크롤
  useEffect(() => {
    if (detail && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [detail]);

  if (!accounts) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  // 월 목록 (당기)
  const year = filter.baseYm.split("-")[0];
  const allMonths = Array.from(new Set(accounts.flatMap(a => Object.keys(a.cur)))).filter(m => m.startsWith(year)).sort();
  const monthLabels = allMonths.map(m => m.slice(5) + "월");

  // 공시용계정 필터 목록 (PL_ORDER 순서 유지)
  const discAccts = ["전체", ...PL_ORDER.filter(d => accounts.some(a => a.disclosure_acct === d))];
  const filteredAccounts = discFilter === "전체" ? accounts : accounts.filter(a => a.disclosure_acct === discFilter);

  return (
    <div className="wrap">

      {/* ── 월별 손익 Trend 그리드 ── */}
      <div>
        <div className="sec-hd">
          <span className="sec-hd-txt">월별 손익 Trend</span>
          <div className="sec-hd-line" />
          {selected && (
            <button
              onClick={() => { setSelected(null); setDetail(null); }}
              style={{ fontSize: 11, color: "#aaa", background: "none", border: "1px solid #E0E0E0", borderRadius: 4, padding: "2px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              선택 해제
            </button>
          )}
        </div>

        {/* ── 공시용계정 필터 ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {discAccts.map(d => (
            <button
              key={d}
              onClick={() => { setDiscFilter(d); setSelected(null); setDetail(null); }}
              style={{
                fontSize: 11, fontWeight: discFilter === d ? 700 : 400,
                padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                border: discFilter === d ? "1.5px solid #E87722" : "1px solid #E0E0E0",
                background: discFilter === d ? "#FFF4EC" : "#fff",
                color: discFilter === d ? "#E87722" : "#666",
                transition: "all .15s",
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          maxHeight: selected ? 340 : "none",
          overflowY: selected ? "auto" : "visible",
          transition: "max-height 0.4s ease",
        }}>
          {filteredAccounts.map((a) => {
            const curVals  = allMonths.map(m => (a.cur[m] ?? 0) / 1_000_000);
            const priVals  = allMonths.map(m => (a.pri[m] ?? 0) / 1_000_000);
            const total    = Object.values(a.cur).reduce((s, v) => s + v, 0);
            const isActive = selected === a.mgmt_acct;
            return (
              <div
                key={a.mgmt_acct}
                onClick={() => setSelected(isActive ? null : a.mgmt_acct)}
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                  border: isActive ? "2px solid #E87722" : "1px solid #EDEDED",
                  boxShadow: isActive ? "0 2px 8px rgba(232,119,34,.2)" : "0 1px 3px rgba(0,0,0,.05)",
                  transition: "all .15s",
                }}
              >
                {discFilter === "전체" && a.disclosure_acct && (
                  <div style={{ fontSize: 9, color: "#aaa", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.disclosure_acct}
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#E87722" : "#555", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.mgmt_acct}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#2C2C2C", marginBottom: 6 }}>
                  {fmtM(total)}<span style={{ fontSize: 10, fontWeight: 400, color: "#bbb", marginLeft: 2 }}>백만</span>
                </div>
                <div style={{ height: 56 }}>
                  <MiniLine cur={curVals} pri={priVals} months={monthLabels} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 디테일 패널 (슬라이드인) ── */}
      <div
        ref={detailRef}
        style={{
          overflow: "hidden",
          maxHeight: selected ? 2000 : 0,
          opacity: selected ? 1 : 0,
          transition: "max-height 0.45s ease, opacity 0.3s ease",
        }}
      >
        {loadingD && (
          <div style={{ padding: 30, color: "#aaa", textAlign: "center" }}>로딩 중...</div>
        )}
        {detail && (() => {
          const selAcct = accounts.find(a => a.mgmt_acct === detail.mgmt_acct);
          const totalCur = selAcct ? Object.values(selAcct.cur).reduce((s, v) => s + v, 0) : 0;
          const totalPri = selAcct ? Object.values(selAcct.pri).reduce((s, v) => s + v, 0) : 0;
          const totalChg = totalCur - totalPri;
          const month = filter.baseYm.split("-")[1].replace(/^0/, "");
          const periodLabel = filter.periodType === "cumulative" ? `${month}월 누적` : `${month}월 당월`;
          return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>

            {/* 요약카드 + 거래처별 차트 */}
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>

              {/* 좌측 — 당기/전기/증감 요약 */}
              <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>
                  {detail.mgmt_acct}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa", marginLeft: 6 }}>{periodLabel}</span>
                </div>
                {[
                  { label: "당기금액",  value: totalCur, color: "#2C2C2C" },
                  { label: "전기금액",  value: totalPri, color: "#2C2C2C" },
                  { label: "증감액",    value: totalChg, color: totalChg >= 0 ? "#E87722" : "#2563EB" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "#F9F9F9", borderRadius: 6, padding: "10px 14px", marginBottom: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: "-0.5px" }}>
                      {value >= 0 ? "" : "-"}{Math.abs(Math.round(value)).toLocaleString("ko-KR")}
                    </div>
                  </div>
                ))}
              </div>

              {/* 우측 — 거래처별 당기/전기 */}
              <div className="card">
                <div className="card-title">{detail.mgmt_acct} — 거래처별 당기/전기</div>
                <CounterpartyBar data={detail.counterparty} />
              </div>
            </div>

            {/* 당기 / 전기 기표 내역 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { title: "당기 기표 내역", vouchers: detail.cur_vouchers },
                { title: "전기 기표 내역", vouchers: detail.pri_vouchers },
              ].map(({ title, vouchers }) => (
                <div key={title} className="card">
                  <div className="card-title">{title}</div>
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>일자</th><th>전표번호</th><th>거래처</th><th>적요</th><th>차/대</th><th>금액</th>
                        </tr>
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
                            <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description ?? "-"}</td>
                            <td style={{ color: v.dr_cr === "차변" ? "#2563EB" : "#DC2626", fontWeight: 600 }}>{v.dr_cr}</td>
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

          </div>
          );
        })()}
      </div>

    </div>
  );
}
