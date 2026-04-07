"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchSC4Summary, fetchSC4Extract, fetchVCHVoucherDetail,
  SC4Summary, SC4Extract, VCHCounterLineItem,
} from "@/lib/api";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const ORANGE = "#E87722";
const BLUE   = "rgba(37,99,235,1)";
const RED    = "rgba(220,38,38,1)";
const fmtN   = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtM   = (n: number) => {
  if (n >= 100_000_000) return `${Math.round(n / 100_000_000).toLocaleString()}억`;
  return `${Math.round(n / 10_000).toLocaleString()}만`;
};

const AMT_MIN  = 0;
const AMT_MAX  = 15_000_000_000;
const DATE_MIN = new Date("2024-01-01").getTime();
const DATE_MAX = new Date("2025-12-31").getTime();
const MS_DAY   = 86_400_000;
const tsToStr  = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const strToTs  = (s: string)  => new Date(s).getTime();

export default function SC4() {
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo,   setDateTo]   = useState("2025-09-30");
  const [tsFrom,   setTsFrom]   = useState(strToTs("2024-01-01"));
  const [tsTo,     setTsTo]     = useState(strToTs("2025-09-30"));
  const [minAmt,   setMinAmt]   = useState(20_000_000);
  const [maxAmt,   setMaxAmt]   = useState(AMT_MAX);
  const [minInput, setMinInput] = useState("20000000");
  const [maxInput, setMaxInput] = useState("15000000000");

  const [summary,   setSummary]   = useState<SC4Summary[] | null>(null);
  const [loading,   setLoading]   = useState(false);

  const [selDate,   setSelDate]   = useState<string | null>(null);
  const [extract,   setExtract]   = useState<SC4Extract[] | null>(null);
  const [exLoading, setExLoading] = useState(false);

  const [selVch,    setSelVch]    = useState<string | null>(null);
  const [lines,     setLines]     = useState<VCHCounterLineItem[] | null>(null);
  const [lnLoading, setLnLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    setSelDate(null); setExtract(null); setSelVch(null); setLines(null);
    fetchSC4Summary(dateFrom, dateTo, minAmt, maxAmt)
      .then(setSummary).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDate = async (date: string) => {
    if (selDate === date) {
      setSelDate(null); setExtract(null); setSelVch(null); setLines(null); return;
    }
    setSelDate(date); setExtract(null); setSelVch(null); setLines(null);
    setExLoading(true);
    try {
      setExtract(await fetchSC4Extract(dateFrom, dateTo, date, minAmt, maxAmt));
    } catch (e) { console.error(e); }
    finally { setExLoading(false); }
  };

  const handleSelectVch = async (vchNo: string) => {
    if (selVch === vchNo) { setSelVch(null); setLines(null); return; }
    setSelVch(vchNo); setLines(null);
    setLnLoading(true);
    try {
      setLines(await fetchVCHVoucherDetail(vchNo));
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) { console.error(e); }
    finally { setLnLoading(false); }
  };

  const datePct = (ts: number) => ((ts - DATE_MIN) / (DATE_MAX - DATE_MIN)) * 100;
  const amtPct  = (v: number)  => ((v - AMT_MIN)  / (AMT_MAX  - AMT_MIN))  * 100;

  const commitAmt = () => {
    const mn = Math.max(AMT_MIN, Math.min(Number(minInput) || 0, maxAmt));
    const mx = Math.min(AMT_MAX, Math.max(Number(maxInput) || AMT_MAX, mn));
    setMinAmt(mn); setMaxAmt(mx); setMinInput(String(mn)); setMaxInput(String(mx));
  };

  // KPI 계산
  const selRow   = selDate ? summary?.find(r => r.date === selDate) : null;
  const totalAmt = summary ? summary.reduce((s, r) => s + r.total_amount, 0) : 0;
  const totalCnt = summary ? summary.reduce((s, r) => s + r.cnt, 0) : 0;
  const uniqueDays = summary ? summary.length : 0;
  const kpiCnt   = selRow ? selRow.cnt         : totalCnt;
  const kpiAmt   = selRow ? selRow.total_amount : totalAmt;
  const kpiDays  = selRow ? 1                  : uniqueDays;
  const kpiSub   = selRow ? selDate!            : `${dateFrom} ~ ${dateTo}`;

  // 차트 데이터
  const chartData = {
    labels: summary?.map(r => r.date) ?? [],
    datasets: [{
      data: summary?.map(r => r.total_amount / 10_000) ?? [],
      borderColor: ORANGE,
      backgroundColor: summary?.map(r => r.date === selDate ? ORANGE : "rgba(232,119,34,0.35)") ?? [],
      pointRadius: summary?.map(r => r.date === selDate ? 8 : 5) ?? [],
      pointHoverRadius: 9,
      borderWidth: 1.5,
      tension: 0.3,
      fill: false,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_: unknown, elements: { index: number }[]) => {
      if (!elements.length || !summary) return;
      handleSelectDate(summary[elements[0].index].date);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number }; dataIndex: number }) =>
            summary ? ` ${fmtN(ctx.parsed.y)}만원 · ${summary[ctx.dataIndex].cnt}건` : "",
        },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 14, font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        ticks: {
          font: { size: 10 },
          callback: (v: number | string) => `${Number(v).toLocaleString()}만`,
        },
      },
    },
  };

  return (
    <div className="wrap">
      {/* ── 위험 설명 ─────────────────────────────────────────── */}
      <div className="info-note">
        💡 예상위험: 고액 현금 인출을 통한 비공식 지급 또는 내부 승인 한도 우회 가능성
      </div>

      {/* ── 필터 ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
          {/* 기간 슬라이더 */}
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>
              분석 기간 &nbsp;<span style={{ color: ORANGE, fontWeight: 700 }}>{dateFrom} ~ {dateTo}</span>
            </div>
            <DualSlider minVal={tsFrom} maxVal={tsTo} min={DATE_MIN} max={DATE_MAX} step={MS_DAY}
              minPct={datePct(tsFrom)} maxPct={datePct(tsTo)}
              onMinChange={v => { setTsFrom(v); setDateFrom(tsToStr(v)); }}
              onMaxChange={v => { setTsTo(v); setDateTo(tsToStr(v)); }} />
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setTsFrom(strToTs(e.target.value)); }} style={inputSt} />
              <span style={{ fontSize: 11, color: "#bbb" }}>~</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setTsTo(strToTs(e.target.value)); }} style={inputSt} />
            </div>
          </div>
          {/* 금액 슬라이더 */}
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>
              금액 범위 &nbsp;<span style={{ color: ORANGE, fontWeight: 700 }}>{fmtN(minAmt)}원 ~ {fmtN(maxAmt)}원</span>
            </div>
            <DualSlider minVal={minAmt} maxVal={maxAmt} min={AMT_MIN} max={AMT_MAX} step={1_000_000}
              minPct={amtPct(minAmt)} maxPct={amtPct(maxAmt)}
              onMinChange={v => { setMinAmt(v); setMinInput(String(v)); }}
              onMaxChange={v => { setMaxAmt(v); setMaxInput(String(v)); }} />
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input value={minInput} onChange={e => setMinInput(e.target.value)} onBlur={commitAmt} onKeyDown={e => e.key === "Enter" && commitAmt()} style={{ ...inputSt, width: 116, fontSize: 11, textAlign: "right" }} />
              <span style={{ fontSize: 11, color: "#bbb" }}>~</span>
              <input value={maxInput} onChange={e => setMaxInput(e.target.value)} onBlur={commitAmt} onKeyDown={e => e.key === "Enter" && commitAmt()} style={{ ...inputSt, width: 116, fontSize: 11, textAlign: "right" }} />
            </div>
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 22px", background: ORANGE, color: "#FFF", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-end" }}>
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      {/* ── KPI ──────────────────────────────────────────────── */}
      {summary && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <KpiCard label="탐지 건수" value={`${fmtN(kpiCnt)}건`} sub={kpiSub} active={!!selDate} />
          <KpiCard label="대변 합계" value={fmtM(kpiAmt)} sub={kpiSub} active={!!selDate} />
          <KpiCard label={selDate ? "선택 날짜" : "탐지 일수"} value={selDate ? selDate : `${fmtN(kpiDays)}일`} sub={kpiSub} active={!!selDate} />
          <KpiCard label="평균 건별 금액" value={kpiCnt ? `${fmtM(kpiAmt / kpiCnt)}` : "-"} sub={kpiSub} active={!!selDate} />
        </div>
      )}

      {/* ── 차트 + 전표추출내역 (2-col, 클릭 시 열림) ──────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: selDate ? "3fr 2fr" : "1fr 0px",
        columnGap: selDate ? 14 : 0,
        transition: "grid-template-columns 0.28s ease, column-gap 0.28s ease",
        minWidth: 0,
        overflow: "hidden",
        marginBottom: 14,
      }}>
        {/* 고액 현금 전표 내역 차트 */}
        <div className="card" style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>고액 현금 전표 내역</div>
            {!selDate && summary && summary.length > 0 && (
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>👆 점 클릭 → 전표 추출</span>
            )}
            {selDate && (
              <>
                <span style={{ fontSize: 11, background: "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px" }}>
                  {selDate}
                </span>
                <button onClick={() => { setSelDate(null); setExtract(null); setSelVch(null); setLines(null); }}
                  style={{ fontSize: 10, color: "#aaa", background: "none", border: "1px solid #E0E0E0", borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: "auto" }}>
                  선택 해제
                </button>
              </>
            )}
          </div>
          <div style={{ height: 280 }}>
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa" }}>
                <Spinner /> 조회 중...
              </div>
            ) : !summary || summary.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb" }}>
                탐지된 항목이 없습니다
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Line data={chartData} options={chartOptions as any} style={{ cursor: "pointer" }} />
            )}
          </div>
        </div>

        {/* 전표 추출 내역 — 항상 DOM에 있음, 클릭 전엔 0px로 숨김 */}
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="card" style={{ height: "100%", minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>전표 추출 내역</div>
              {extract && <span style={{ fontSize: 12, color: "#aaa" }}>{extract.length}건</span>}
              {!selVch && extract && extract.length > 0 && (
                <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>👆 행 클릭 → 상세 내역</span>
              )}
            </div>
            <div style={{ height: 256, overflowY: "auto", overflowX: "hidden" }}>
              {exLoading ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa" }}>
                  <Spinner /> 로딩 중...
                </div>
              ) : !extract || extract.length === 0 ? (
                <div style={{ padding: 20, color: "#bbb", textAlign: "center", fontSize: 12 }}>
                  {selDate ? "해당 날짜 전표 없음" : ""}
                </div>
              ) : (
                <table style={{ tableLayout: "fixed", width: "100%" }}>
                  <colgroup>
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
                  <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "center" }}>전표번호</th>
                      <th style={{ textAlign: "center" }}>계정과목</th>
                      <th style={{ textAlign: "center" }}>거래처</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>대변</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extract.map((r, i) => {
                      const isSel = selVch === r.voucher_no;
                      return (
                        <tr key={i} onClick={() => handleSelectVch(r.voucher_no)}
                          style={{ cursor: "pointer", background: isSel ? "#FFF4EC" : undefined, borderLeft: isSel ? `3px solid ${ORANGE}` : "3px solid transparent" }}>
                          <td style={{ textAlign: "center", color: "#888", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.voucher_no}</td>
                          <td style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.account_name}</td>
                          <td style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.counterparty}</td>
                          <td style={{ textAlign: "right", color: RED, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtN(r.total_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#FFF7F0" }}>
                      <td colSpan={3}>합계</td>
                      <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>
                        {fmtN(extract.reduce((s, r) => s + r.total_amount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 전표 상세 내역 ───────────────────────────────────── */}
      {(selVch || lnLoading) && (
        <div ref={detailRef} className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>전표 상세 내역</div>
            {selVch && (
              <span style={{ fontSize: 11, background: "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px" }}>
                {selVch}
              </span>
            )}
            {lines && <span style={{ fontSize: 12, color: "#aaa" }}>총 {lines.length}건</span>}
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", overflowX: "auto" }}>
            {lnLoading ? (
              <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa" }}>
                <Spinner /> 로딩 중...
              </div>
            ) : lines && (
              <table>
                <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>일자</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>전표번호</th>
                    <th style={{ textAlign: "center" }}>계정과목</th>
                    <th style={{ textAlign: "center" }}>거래처</th>
                    <th style={{ textAlign: "center" }}>적요</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>차변</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>대변</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((v, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap", color: "#888", fontSize: 11 }}>{v.date}</td>
                      <td style={{ textAlign: "center", color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>{v.voucher_no}</td>
                      <td style={{ textAlign: "left", whiteSpace: "nowrap" }}>{v.account_name}</td>
                      <td style={{ textAlign: "left", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                      <td style={{ textAlign: "left", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#666" }}>{v.description}</td>
                      <td style={{ textAlign: "right", color: v.dr_cr === "차변" ? BLUE : "#DDD", whiteSpace: "nowrap" }}>
                        {v.dr_cr === "차변" ? fmtN(v.amount) : "-"}
                      </td>
                      <td style={{ textAlign: "right", color: v.dr_cr === "대변" ? RED : "#DDD", whiteSpace: "nowrap" }}>
                        {v.dr_cr === "대변" ? fmtN(v.amount) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: "#FFF7F0" }}>
                    <td colSpan={5}>합계</td>
                    <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap" }}>
                      {fmtN(lines.filter(v => v.dr_cr === "차변").reduce((s, v) => s + v.amount, 0))}
                    </td>
                    <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>
                      {fmtN(lines.filter(v => v.dr_cr === "대변").reduce((s, v) => s + v.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, active }: { label: string; value: string; sub?: string; active?: boolean }) {
  return (
    <div className="card" style={{ padding: "12px 20px", minWidth: 0, flex: 1, borderTop: active ? `3px solid ${ORANGE}` : "3px solid transparent", transition: "border-color 0.2s" }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: active ? ORANGE : "#bbb", marginTop: 4, fontWeight: active ? 600 : 400 }}>{sub}</div>}
    </div>
  );
}

function DualSlider({ minVal, maxVal, min, max, step, minPct, maxPct, onMinChange, onMaxChange }: {
  minVal: number; maxVal: number; min: number; max: number; step: number;
  minPct: number; maxPct: number; onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  return (
    <div style={{ position: "relative", width: 250, height: 24 }}>
      <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 4, background: "#E5E7EB", borderRadius: 2 }} />
      <div style={{ position: "absolute", top: 10, left: `${minPct}%`, width: `${maxPct - minPct}%`, height: 4, background: ORANGE, borderRadius: 2 }} />
      <input type="range" min={min} max={max} step={step} value={minVal}
        onChange={e => onMinChange(Math.min(Number(e.target.value), maxVal - step))}
        className="sc-slider"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", appearance: "none", background: "transparent", outline: "none", cursor: "pointer", zIndex: minVal > max - step ? 5 : 3 }} />
      <input type="range" min={min} max={max} step={step} value={maxVal}
        onChange={e => onMaxChange(Math.max(Number(e.target.value), minVal + step))}
        className="sc-slider"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", appearance: "none", background: "transparent", outline: "none", cursor: "pointer", zIndex: 4 }} />
    </div>
  );
}

function Spinner() {
  return (
    <>
      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #E87722", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

const inputSt: React.CSSProperties = { fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, color: "#333" };
