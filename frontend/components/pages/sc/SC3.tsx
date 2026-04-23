"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchSC3Summary, fetchSC3Extract, fetchVCHVoucherDetail,
  SC3Summary, SC3Extract, VCHCounterLineItem,
} from "@/lib/api";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { useDarkMode } from "@/hooks/useDarkMode";
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
const fmtM   = (n: number) => `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;

const DATE_MIN = new Date("2024-01-01").getTime();
const DATE_MAX = new Date("2025-12-31").getTime();
const MS_DAY   = 86_400_000;
const tsToStr  = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const strToTs  = (s: string)  => new Date(s).getTime();

const PAGE = "SC3 주말현금";

export default function SC3() {
  const isDark = useDarkMode();
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo,   setDateTo]   = useState("2025-09-30");
  const [tsFrom,   setTsFrom]   = useState(strToTs("2024-01-01"));
  const [tsTo,     setTsTo]     = useState(strToTs("2025-09-30"));

  const [summary,  setSummary]  = useState<SC3Summary[] | null>(null);
  const [loading,  setLoading]  = useState(false);

  const [selDate,  setSelDate]  = useState<string | null>(null);
  const [extract,  setExtract]  = useState<SC3Extract[] | null>(null);
  const [exLoading, setExLoading] = useState(false);

  const [selVch,   setSelVch]   = useState<string | null>(null);
  const [lines,    setLines]    = useState<VCHCounterLineItem[] | null>(null);
  const [lnLoading, setLnLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    setSelDate(null); setExtract(null); setSelVch(null); setLines(null);
    fetchSC3Summary(dateFrom, dateTo)
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
      setExtract(await fetchSC3Extract(dateFrom, dateTo, date));
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

  const totalAmt   = summary ? summary.reduce((s, r) => s + r.total_amount, 0) : 0;
  const totalCnt   = summary ? summary.reduce((s, r) => s + r.cnt, 0) : 0;
  const uniqueDays = summary ? summary.length : 0;
  const selRow     = selDate ? summary?.find(r => r.date === selDate) : null;
  const kpiCnt     = selRow ? selRow.cnt           : totalCnt;
  const kpiAmt     = selRow ? selRow.total_amount  : totalAmt;
  const kpiDays    = selRow ? 1                    : uniqueDays;
  const kpiSub     = selRow ? selDate!             : `${dateFrom} ~ ${dateTo}`;

  // 다크모드 색상
  const subTxt     = isDark ? "#9198A8" : "#888";
  const dimTxt     = isDark ? "#5A6070" : "#aaa";
  const valTxt     = isDark ? "#C8CCDA" : "#666";
  const zeroClr    = isDark ? "#3A3F4A" : "#DDD";
  const theadBg    = isDark ? "#1C1F26" : "#FFF";
  const tfootBg    = isDark ? "rgba(232,119,34,0.10)" : "#FFF7F0";
  const selRowBg   = isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC";
  const selBadgeBg = isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC";
  const sliderTrack = isDark ? "#2E3039" : "#E5E7EB";
  const inputBdr   = isDark ? "#2E3039" : "#ddd";
  const inputClr   = isDark ? "#E2E5EC" : "#333";
  const inputBg    = isDark ? "#1C1F26" : "#fff";
  const btnBdr     = isDark ? "#2E3039" : "#E0E0E0";
  const tickClr    = isDark ? "#9198A8" : "#666";
  const gridClr    = isDark ? "#2E3039" : "#E5E7EB";

  const inputSt: React.CSSProperties = {
    fontSize: 12, padding: "4px 8px",
    border: `1px solid ${inputBdr}`,
    borderRadius: 4, color: inputClr,
    background: inputBg,
    colorScheme: isDark ? "dark" : "light",
  };

  const chartData = {
    labels: summary?.map(r => r.date) ?? [],
    datasets: [{
      data: summary?.map(r => r.total_amount / 10000) ?? [],
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
        backgroundColor: isDark ? "#1C1F26" : "#fff",
        borderColor: isDark ? "#2E3039" : "#ddd",
        borderWidth: 1,
        titleColor: isDark ? "#E2E5EC" : "#333",
        bodyColor: isDark ? "#9198A8" : "#666",
        callbacks: {
          label: (ctx: { parsed: { y: number }; dataIndex: number }) =>
            summary ? ` ${fmtN(ctx.parsed.y)}만원 · ${summary[ctx.dataIndex].cnt}건` : "",
        },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 10, font: { size: 10 }, color: tickClr },
        grid: { display: false },
      },
      y: {
        ticks: {
          font: { size: 10 },
          color: tickClr,
          callback: (v: number | string) => `${Number(v).toLocaleString()}만`,
        },
        grid: { color: gridClr },
      },
    },
  };

  return (
    <div className="wrap">
      <div className="info-note">
        💡 예상위험: 승인 절차가 약화된 주말·공휴일에 현금 유출이 발생하여 비공식 지급에 활용될 수 있음
      </div>

      <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: subTxt, marginBottom: 5 }}>
              분석 기간 &nbsp;<span style={{ color: ORANGE, fontWeight: 700 }}>{dateFrom} ~ {dateTo}</span>
            </div>
            <DualSlider minVal={tsFrom} maxVal={tsTo} min={DATE_MIN} max={DATE_MAX} step={MS_DAY}
              minPct={datePct(tsFrom)} maxPct={datePct(tsTo)} trackBg={sliderTrack}
              onMinChange={v => { setTsFrom(v); setDateFrom(tsToStr(v)); }}
              onMaxChange={v => { setTsTo(v); setDateTo(tsToStr(v)); }} />
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setTsFrom(strToTs(e.target.value)); }} style={inputSt} />
              <span style={{ fontSize: 11, color: dimTxt }}>~</span>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setTsTo(strToTs(e.target.value)); }} style={inputSt} />
            </div>
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 22px", background: ORANGE, color: "#FFF", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-end" }}>
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <KpiCard label="탐지 건수" value={`${fmtN(kpiCnt)}건`} sub={kpiSub} active={!!selDate} isDark={isDark} />
          <KpiCard label="대변 합계" value={`${fmtM(kpiAmt)}원`} sub={kpiSub} active={!!selDate} isDark={isDark} />
          <KpiCard label={selDate ? "선택 날짜" : "주말 일수"} value={selDate ? selDate : `${fmtN(kpiDays)}일`} sub={kpiSub} active={!!selDate} isDark={isDark} />
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: selDate ? "3fr 2fr" : "1fr 0px",
        columnGap: selDate ? 14 : 0,
        transition: "grid-template-columns 0.28s ease, column-gap 0.28s ease",
        minWidth: 0,
        overflow: "hidden",
      }}>
        <div className="card" style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>주말 현금 전표 내역</div>
            {!selDate && summary && summary.length > 0 && (
              <span style={{ fontSize: 11, color: dimTxt, marginLeft: "auto" }}>👆 점 클릭 → 전표 추출</span>
            )}
            {selDate && (
              <>
                <span style={{ fontSize: 11, background: selBadgeBg, color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px" }}>
                  {selDate}
                </span>
                <button onClick={() => { setSelDate(null); setExtract(null); setSelVch(null); setLines(null); }}
                  style={{ fontSize: 10, color: subTxt, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: "auto" }}>
                  선택 해제
                </button>
              </>
            )}
          </div>
          <div style={{ height: 280 }}>
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt }}>
                <Spinner /> 조회 중...
              </div>
            ) : !summary || summary.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: dimTxt }}>
                탐지된 항목이 없습니다
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Line data={chartData} options={chartOptions as any} style={{ cursor: "pointer" }} />
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="card" style={{ height: "100%", minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>전표 추출 내역</div>
              {extract && <span style={{ fontSize: 12, color: dimTxt }}>{extract.length}건</span>}
              {!selVch && extract && extract.length > 0 && (
                <span style={{ fontSize: 11, color: dimTxt, marginLeft: "auto" }}>👆 행 클릭 → 상세 내역</span>
              )}
            </div>
            <div style={{ height: 256, overflowY: "auto", overflowX: "hidden" }}>
              {exLoading ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt }}>
                  <Spinner /> 로딩 중...
                </div>
              ) : !extract || extract.length === 0 ? (
                <div style={{ padding: 20, color: dimTxt, textAlign: "center", fontSize: 12 }}>
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
                  <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
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
                        <tr key={i} onClick={(e) => { if (isSel) { const rect = e.currentTarget.getBoundingClientRect(); triggerComment({ page: PAGE, label: r.voucher_no, value: `${fmtN(r.total_amount)}원` }, { top: rect.top, right: rect.right }); } else { handleSelectVch(r.voucher_no); } }}
                          style={{ cursor: "pointer", background: isSel ? selRowBg : undefined, borderLeft: "3px solid transparent" }}>
                          <td style={{ textAlign: "center", color: subTxt, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.voucher_no}
                            {ck.has(commentKey(PAGE, r.voucher_no)) && <CommentDot inline inquiryId={ck.get(commentKey(PAGE, r.voucher_no))!} />}
                          </td>
                          <td style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.account_name}</td>
                          <td style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.counterparty}</td>
                          <td style={{ textAlign: "right", color: RED, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtN(r.total_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: tfootBg }}>
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

      {(selVch || lnLoading) && (
        <div ref={detailRef} className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>전표 상세 내역</div>
            {selVch && (
              <span style={{ fontSize: 11, background: selBadgeBg, color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px" }}>
                {selVch}
              </span>
            )}
            {lines && <span style={{ fontSize: 12, color: dimTxt }}>총 {lines.length}건</span>}
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", overflowX: "auto" }}>
            {lnLoading ? (
              <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt }}>
                <Spinner /> 로딩 중...
              </div>
            ) : lines && (
              <table>
                <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
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
                    <tr key={i} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); triggerComment({ page: PAGE, label: v.voucher_no, value: `${fmtN(v.amount)}원`, bodyTemplate: `페이지: ${PAGE}\n일자: ${v.date}\n전표번호: ${v.voucher_no}\n계정과목: ${v.account_name}\n거래처: ${v.counterparty}\n적요: ${v.description}\n금액: ${fmtN(v.amount)}원\n\n문의내용:\n` }, { top: rect.top, right: rect.right }); }} style={{ cursor: "pointer" }}>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap", color: subTxt, fontSize: 11 }}>{v.date}</td>
                      <td style={{ textAlign: "center", color: subTxt, fontSize: 11, whiteSpace: "nowrap" }}>
                        {v.voucher_no}
                        {ck.has(commentKey(PAGE, v.voucher_no)) && <CommentDot inline inquiryId={ck.get(commentKey(PAGE, v.voucher_no))!} />}
                      </td>
                      <td style={{ textAlign: "left", whiteSpace: "nowrap" }}>{v.account_name}</td>
                      <td style={{ textAlign: "left", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                      <td style={{ textAlign: "left", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: valTxt }}>{v.description}</td>
                      <td style={{ textAlign: "right", color: v.dr_cr === "차변" ? BLUE : zeroClr, whiteSpace: "nowrap" }}>
                        {v.dr_cr === "차변" ? fmtN(v.amount) : "-"}
                      </td>
                      <td style={{ textAlign: "right", color: v.dr_cr === "대변" ? RED : zeroClr, whiteSpace: "nowrap" }}>
                        {v.dr_cr === "대변" ? fmtN(v.amount) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: tfootBg }}>
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

function KpiCard({ label, value, sub, active, isDark, color }: { label: string; value: string; sub?: string; active?: boolean; isDark?: boolean; color?: string }) {
  const labelClr = isDark ? "#9198A8" : "#888";
  const valClr   = color ?? (isDark ? "#E2E5EC" : "#1a1a1a");
  const subClr   = active ? ORANGE : (isDark ? "#5A6070" : "#bbb");
  return (
    <div className="card" style={{ padding: "12px 20px", minWidth: 0, flex: 1,  }}>
      <div style={{ fontSize: 11, color: labelClr, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valClr }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: subClr, marginTop: 4, fontWeight: active ? 600 : 400 }}>{sub}</div>}
    </div>
  );
}

function DualSlider({ minVal, maxVal, min, max, step, minPct, maxPct, trackBg, onMinChange, onMaxChange }: {
  minVal: number; maxVal: number; min: number; max: number; step: number;
  minPct: number; maxPct: number; trackBg: string; onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  return (
    <div style={{ position: "relative", width: 250, height: 24 }}>
      <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 4, background: trackBg, borderRadius: 2 }} />
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
  return <div className="spinner" style={{ width: 14, height: 14 }} />;
}
