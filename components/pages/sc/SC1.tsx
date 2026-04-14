"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchSC1Exceptions, fetchSC1Extract, fetchSC1Lines,
  SC1Exception, SC1Extract, SC1Line,
} from "@/lib/api";

const ORANGE = "#E87722";
const BLUE   = "rgba(37,99,235,1)";
const RED    = "rgba(220,38,38,1)";
const fmtN   = (n: number) => Math.round(n).toLocaleString("ko-KR");

const AMT_MIN = 0;
const AMT_MAX = 10_000_000_000;

// 날짜 ↔ 일수 변환
const DATE_MIN = new Date("2024-01-01").getTime();
const DATE_MAX = new Date("2025-12-31").getTime();
const MS_DAY   = 86_400_000;
const tsToStr  = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const strToTs  = (s: string)  => new Date(s).getTime();

export default function SC1() {
  // ── 필터 ────────────────────────────────────────────────────
  const [dateFrom,  setDateFrom]  = useState("2024-01-01");
  const [dateTo,    setDateTo]    = useState("2025-09-30");
  const [tsFrom,    setTsFrom]    = useState(strToTs("2024-01-01"));
  const [tsTo,      setTsTo]      = useState(strToTs("2025-09-30"));
  const [minAmt,    setMinAmt]    = useState(1_000_000);
  const [maxAmt,    setMaxAmt]    = useState(AMT_MAX);
  const [minInput,  setMinInput]  = useState("1000000");
  const [maxInput,  setMaxInput]  = useState("10000000000");

  // ── 데이터 ──────────────────────────────────────────────────
  const [exceptions, setExceptions] = useState<SC1Exception[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState<SC1Exception | null>(null);
  const [extract,    setExtract]    = useState<SC1Extract[] | null>(null);
  const [lines,      setLines]      = useState<SC1Line[] | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // ── 예외 목록 조회 ──────────────────────────────────────────
  const load = () => {
    setLoading(true);
    setSelected(null); setExtract(null); setLines(null);
    fetchSC1Exceptions(dateFrom, dateTo, minAmt, maxAmt)
      .then(d => setExceptions(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── 행 클릭 → 추출 + 라인 ──────────────────────────────────
  const handleSelect = async (row: SC1Exception) => {
    if (selected?.year_month === row.year_month &&
        selected?.account_name === row.account_name &&
        selected?.amount === row.amount) {
      setSelected(null); setExtract(null); setLines(null);
      return;
    }
    setSelected(row); setExtract(null); setLines(null);
    try {
      const [ex, ln] = await Promise.all([
        fetchSC1Extract(dateFrom, dateTo, row.year_month, row.account_name, row.amount),
        fetchSC1Lines(dateFrom, dateTo, row.year_month, row.account_name, row.amount),
      ]);
      setExtract(ex); setLines(ln);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) { console.error(e); }
  };

  // ── 슬라이더 ────────────────────────────────────────────────
  const datePct = (ts: number) => ((ts - DATE_MIN) / (DATE_MAX - DATE_MIN)) * 100;
  const amtPct  = (v: number)  => ((v - AMT_MIN)  / (AMT_MAX - AMT_MIN))  * 100;

  const commitAmtInput = () => {
    const mn = Math.max(AMT_MIN, Math.min(Number(minInput) || 0, maxAmt));
    const mx = Math.min(AMT_MAX, Math.max(Number(maxInput) || AMT_MAX, mn));
    setMinAmt(mn); setMaxAmt(mx);
    setMinInput(String(mn)); setMaxInput(String(mx));
  };

  return (
    <div className="wrap">

      {/* ── 위험 설명 ─────────────────────────────────────────── */}
      <div className="info-note">
        💡 예상위험: 동일 연월에 동일한 증빙으로 이중 청구
      </div>

      {/* ── 필터 카드 ────────────────────────────────────────── */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>

          {/* 날짜 슬라이더 */}
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>
              분석 기간 &nbsp;
              <span style={{ color: ORANGE, fontWeight: 700 }}>{dateFrom} ~ {dateTo}</span>
            </div>
            {/* 슬라이더 — 입력칸 너비(248px)에 맞춤 */}
            <DualSlider
              minVal={tsFrom} maxVal={tsTo}
              min={DATE_MIN} max={DATE_MAX} step={MS_DAY}
              minPct={datePct(tsFrom)} maxPct={datePct(tsTo)}
              onMinChange={v => { setTsFrom(v); setDateFrom(tsToStr(v)); }}
              onMaxChange={v => { setTsTo(v);   setDateTo(tsToStr(v)); }}
            />
            {/* 날짜 직접 입력 */}
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setTsFrom(strToTs(e.target.value)); }}
                style={{ ...inputSt, width: 116 }} />
              <span style={{ fontSize: 11, color: "#bbb" }}>~</span>
              <input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setTsTo(strToTs(e.target.value)); }}
                style={{ ...inputSt, width: 116 }} />
            </div>
          </div>

          {/* 금액 슬라이더 */}
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>
              금액 범위 &nbsp;
              <span style={{ color: ORANGE, fontWeight: 700 }}>{fmtN(minAmt)}원 ~ {fmtN(maxAmt)}원</span>
            </div>
            <DualSlider
              minVal={minAmt} maxVal={maxAmt}
              min={AMT_MIN} max={AMT_MAX} step={100_000}
              minPct={amtPct(minAmt)} maxPct={amtPct(maxAmt)}
              onMinChange={v => { setMinAmt(v); setMinInput(String(v)); }}
              onMaxChange={v => { setMaxAmt(v); setMaxInput(String(v)); }}
            />
            {/* 금액 직접 입력 */}
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input value={minInput} onChange={e => setMinInput(e.target.value)}
                onBlur={commitAmtInput} onKeyDown={e => e.key === "Enter" && commitAmtInput()}
                style={{ ...inputSt, width: 116, fontSize: 11, textAlign: "right" }} />
              <span style={{ fontSize: 11, color: "#bbb" }}>~</span>
              <input value={maxInput} onChange={e => setMaxInput(e.target.value)}
                onBlur={commitAmtInput} onKeyDown={e => e.key === "Enter" && commitAmtInput()}
                style={{ ...inputSt, width: 116, fontSize: 11, textAlign: "right" }} />
            </div>
          </div>

          {/* 조회 버튼 */}
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 22px", background: ORANGE, color: "#FFF", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-end" }}>
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      {/* ── 2열: Exception 내역 + 전표 추출 내역 ─────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 14 }}>

        {/* 시나리오 Exception 내역 */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>시나리오 Exception 내역</div>
            {exceptions && (
              <span style={{ fontSize: 12, color: "#aaa" }}>{fmtN(exceptions.length)}건</span>
            )}
            {!selected && exceptions && exceptions.length > 0 && (
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>
                👆 행 클릭 → 상세 확인
              </span>
            )}
            {selected && (
              <button onClick={() => { setSelected(null); setExtract(null); setLines(null); }}
                style={{ fontSize: 10, color: "#aaa", background: "none", border: "1px solid #E0E0E0", borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: "auto" }}>
                선택 해제
              </button>
            )}
          </div>

          <div style={{ height: 360, overflowY: "auto" }}>
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa", fontSize: 13 }}>
                <Spinner /> 조회 중...
              </div>
            ) : !exceptions ? null : exceptions.length === 0 ? (
              <div style={{ padding: 40, color: "#bbb", textAlign: "center" }}>탐지된 항목이 없습니다</div>
            ) : (() => {
              const maxCnt = Math.max(...exceptions.map(r => Math.max(r.dr_cnt, r.cr_cnt)), 2);
              return (
              <table>
                <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>연월</th>
                    <th style={{ textAlign: "center" }}>계정과목</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>금액</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>차변</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>대변</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((r, i) => {
                    const isSelected = selected?.year_month === r.year_month &&
                                       selected?.account_name === r.account_name &&
                                       selected?.amount === r.amount;
                    return (
                      <tr key={i} onClick={() => handleSelect(r)}
                        style={{ cursor: "pointer", background: isSelected ? "#FFF4EC" : undefined, borderLeft: isSelected ? `3px solid ${ORANGE}` : "3px solid transparent" }}>
                        <td style={{ textAlign: "center", color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>
                          {r.year_month.slice(2, 4)}-{r.year_month.slice(5, 7)}
                        </td>
                        <td style={{ textAlign: "left", color: isSelected ? ORANGE : "#333", fontWeight: isSelected ? 700 : undefined }}>
                          {r.account_name}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {fmtN(r.amount)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {r.dr_cnt > 0 && <DupBadge count={r.dr_cnt} maxCount={maxCnt} />}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {r.cr_cnt > 0 && <DupBadge count={r.cr_cnt} maxCount={maxCnt} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              );
            })()}
          </div>
        </div>

        {/* 전표 추출 내역 (선택 시) */}
        {selected && (
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>전표 추출 내역</div>
              <span style={{ fontSize: 11, background: "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px" }}>
                {selected.account_name} · {fmtN(selected.amount)}원
              </span>
            </div>
            <div style={{ height: 360, overflowY: "auto" }}>
              {extract === null ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa", fontSize: 13 }}>
                  <Spinner /> 로딩 중...
                </div>
              ) : (
                <table>
                  <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>연월</th>
                      <th style={{ textAlign: "center" }}>계정과목</th>
                      <th style={{ textAlign: "center" }}>거래처</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>차변</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>대변</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extract.map((r, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: "center", color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>
                          {r.year_month.slice(2, 4)}-{r.year_month.slice(5, 7)}
                        </td>
                        <td style={{ textAlign: "left" }}>{r.account_name}</td>
                        <td style={{ textAlign: "left", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.counterparty}</td>
                        <td style={{ textAlign: "right", color: r.dr > 0 ? BLUE : "#DDD", whiteSpace: "nowrap" }}>
                          {r.dr > 0 ? fmtN(r.dr) : "-"}
                        </td>
                        <td style={{ textAlign: "right", color: r.cr > 0 ? RED : "#DDD", whiteSpace: "nowrap" }}>
                          {r.cr > 0 ? fmtN(r.cr) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#FFF7F0" }}>
                      <td colSpan={3}>합계</td>
                      <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap" }}>
                        {fmtN(extract.reduce((s, r) => s + r.dr, 0))}
                      </td>
                      <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>
                        {fmtN(extract.reduce((s, r) => s + r.cr, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 전표 상세 내역 ───────────────────────────────────── */}
      {selected && (
        <div ref={detailRef} className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>전표 상세 내역</div>
            {lines && <span style={{ fontSize: 12, color: "#aaa" }}>총 {fmtN(lines.length)}건</span>}
          </div>
          <div style={{ height: 340, overflowY: "auto", overflowX: "auto" }}>
            {lines === null ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa", fontSize: 13 }}>
                <Spinner /> 로딩 중...
              </div>
            ) : (
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
                      <td style={{ textAlign: "left", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                      <td style={{ textAlign: "left", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#666" }}>{v.description}</td>
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

// ── 중복 뱃지 — 숫자 클수록 진한 빨강 ───────────────────────────
function DupBadge({ count, maxCount }: { count: number; maxCount: number }) {
  // 로그 스케일: 1→0.0, 2→0.3, 4→0.6, 10→0.9, max→1.0
  const t = Math.log(count) / Math.log(Math.max(maxCount, 2));
  // 연핑크(255,220,220) → 진빨(180,0,0)
  const r = Math.round(255 - t * 75);
  const g = Math.round(220 - t * 220);
  const b = Math.round(220 - t * 220);
  const bg = `rgb(${r},${g},${b})`;
  const textColor = "#fff";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 24, height: 24, borderRadius: "50%",
      background: bg, border: "none",
      fontSize: 11, color: textColor, fontWeight: 700,
    }}>
      {count}
    </span>
  );
}

function Spinner() {
  return (
    <>
      <span style={{ className="spinner" style={{ width:14, height:14 }} }} />
      
    </>
  );
}

const inputSt: React.CSSProperties = {
  fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, color: "#333",
};

// 슬라이더 너비 = 입력칸 2개(116px) + gap(6px) + "~"(12px) = 250px
function DualSlider({ minVal, maxVal, min, max, step, minPct, maxPct, onMinChange, onMaxChange }: {
  minVal: number; maxVal: number; min: number; max: number; step: number;
  minPct: number; maxPct: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  const W = 250;
  return (
    <div style={{ position: "relative", width: W, height: 24 }}>
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
