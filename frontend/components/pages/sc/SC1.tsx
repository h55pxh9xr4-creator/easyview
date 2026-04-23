"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchSC1Exceptions, fetchSC1Extract, fetchSC1Lines,
  SC1Exception, SC1Extract, SC1Line,
} from "@/lib/api";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { useDarkMode } from "@/hooks/useDarkMode";

const ORANGE = "#E87722";
const BLUE   = "rgba(37,99,235,1)";
const RED    = "rgba(220,38,38,1)";
const fmtN   = (n: number) => Math.round(n).toLocaleString("ko-KR");

const AMT_MIN = 0;
const AMT_MAX = 10_000_000_000;

const DATE_MIN = new Date("2024-01-01").getTime();
const DATE_MAX = new Date("2025-12-31").getTime();
const MS_DAY   = 86_400_000;
const tsToStr  = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const strToTs  = (s: string)  => new Date(s).getTime();

const PAGE = "SC1 이중청구";

export default function SC1() {
  const isDark = useDarkMode();
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);

  const [dateFrom,  setDateFrom]  = useState("2024-01-01");
  const [dateTo,    setDateTo]    = useState("2025-09-30");
  const [tsFrom,    setTsFrom]    = useState(strToTs("2024-01-01"));
  const [tsTo,      setTsTo]      = useState(strToTs("2025-09-30"));
  const [minAmt,    setMinAmt]    = useState(1_000_000);
  const [maxAmt,    setMaxAmt]    = useState(AMT_MAX);
  const [minInput,  setMinInput]  = useState("1000000");
  const [maxInput,  setMaxInput]  = useState("10000000000");

  const [exceptions, setExceptions] = useState<SC1Exception[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState<SC1Exception | null>(null);
  const [extract,    setExtract]    = useState<SC1Extract[] | null>(null);
  const [lines,      setLines]      = useState<SC1Line[] | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    setSelected(null); setExtract(null); setLines(null);
    fetchSC1Exceptions(dateFrom, dateTo, minAmt, maxAmt)
      .then(d => setExceptions(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = async (row: SC1Exception) => {
    if (selected?.year_month === row.year_month &&
        selected?.account_name === row.account_name &&
        selected?.amount === row.amount) {
      setSelected(null); setExtract(null); setLines(null); return;
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

  const datePct = (ts: number) => ((ts - DATE_MIN) / (DATE_MAX - DATE_MIN)) * 100;
  const amtPct  = (v: number)  => ((v - AMT_MIN)  / (AMT_MAX - AMT_MIN))  * 100;

  const commitAmtInput = () => {
    const mn = Math.max(AMT_MIN, Math.min(Number(minInput) || 0, maxAmt));
    const mx = Math.min(AMT_MAX, Math.max(Number(maxInput) || AMT_MAX, mn));
    setMinAmt(mn); setMaxAmt(mx);
    setMinInput(String(mn)); setMaxInput(String(mx));
  };

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

  const inputSt: React.CSSProperties = {
    fontSize: 12, padding: "4px 8px",
    border: `1px solid ${inputBdr}`,
    borderRadius: 4, color: inputClr,
    background: inputBg,
    colorScheme: isDark ? "dark" : "light",
  };

  return (
    <div className="wrap">
      <div className="info-note">
        💡 예상위험: 동일 연월에 동일한 증빙으로 이중 청구
      </div>

      <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: subTxt, marginBottom: 5 }}>
              분석 기간 &nbsp;
              <span style={{ color: ORANGE, fontWeight: 700 }}>{dateFrom} ~ {dateTo}</span>
            </div>
            <DualSlider
              minVal={tsFrom} maxVal={tsTo}
              min={DATE_MIN} max={DATE_MAX} step={MS_DAY}
              minPct={datePct(tsFrom)} maxPct={datePct(tsTo)}
              trackBg={sliderTrack}
              onMinChange={v => { setTsFrom(v); setDateFrom(tsToStr(v)); }}
              onMaxChange={v => { setTsTo(v);   setDateTo(tsToStr(v)); }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setTsFrom(strToTs(e.target.value)); }}
                style={{ ...inputSt, width: 116 }} />
              <span style={{ fontSize: 11, color: dimTxt }}>~</span>
              <input type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setTsTo(strToTs(e.target.value)); }}
                style={{ ...inputSt, width: 116 }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: subTxt, marginBottom: 5 }}>
              금액 범위 &nbsp;
              <span style={{ color: ORANGE, fontWeight: 700 }}>{fmtN(minAmt)}원 ~ {fmtN(maxAmt)}원</span>
            </div>
            <DualSlider
              minVal={minAmt} maxVal={maxAmt}
              min={AMT_MIN} max={AMT_MAX} step={100_000}
              minPct={amtPct(minAmt)} maxPct={amtPct(maxAmt)}
              trackBg={sliderTrack}
              onMinChange={v => { setMinAmt(v); setMinInput(String(v)); }}
              onMaxChange={v => { setMaxAmt(v); setMaxInput(String(v)); }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input value={minInput} onChange={e => setMinInput(e.target.value)}
                onBlur={commitAmtInput} onKeyDown={e => e.key === "Enter" && commitAmtInput()}
                style={{ ...inputSt, width: 116, fontSize: 11, textAlign: "right" }} />
              <span style={{ fontSize: 11, color: dimTxt }}>~</span>
              <input value={maxInput} onChange={e => setMaxInput(e.target.value)}
                onBlur={commitAmtInput} onKeyDown={e => e.key === "Enter" && commitAmtInput()}
                style={{ ...inputSt, width: 116, fontSize: 11, textAlign: "right" }} />
            </div>
          </div>

          <button onClick={load} disabled={loading}
            style={{ padding: "7px 22px", background: ORANGE, color: "#FFF", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-end" }}>
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>시나리오 Exception 내역</div>
            {exceptions && (
              <span style={{ fontSize: 12, color: dimTxt }}>{fmtN(exceptions.length)}건</span>
            )}
            {!selected && exceptions && exceptions.length > 0 && (
              <span style={{ fontSize: 11, color: dimTxt, marginLeft: "auto" }}>
                👆 행 클릭 → 상세 확인
              </span>
            )}
            {selected && (
              <button onClick={() => { setSelected(null); setExtract(null); setLines(null); }}
                style={{ fontSize: 10, color: subTxt, background: "none", border: `1px solid ${btnBdr}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: "auto" }}>
                선택 해제
              </button>
            )}
          </div>

          <div style={{ height: 360, overflowY: "auto" }}>
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt, fontSize: 13 }}>
                <Spinner /> 조회 중...
              </div>
            ) : !exceptions ? null : exceptions.length === 0 ? (
              <div style={{ padding: 40, color: dimTxt, textAlign: "center" }}>탐지된 항목이 없습니다</div>
            ) : (() => {
              const maxCnt = Math.max(...exceptions.map(r => Math.max(r.dr_cnt, r.cr_cnt)), 2);
              return (
              <table>
                <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
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
                        style={{ cursor: "pointer", background: isSelected ? selRowBg : undefined, borderLeft: "3px solid transparent" }}>
                        <td style={{ textAlign: "center", color: subTxt, fontSize: 11, whiteSpace: "nowrap" }}>
                          {r.year_month.slice(2, 4)}-{r.year_month.slice(5, 7)}
                        </td>
                        <td style={{ textAlign: "left", color: isSelected ? ORANGE : undefined, fontWeight: isSelected ? 700 : undefined }}>
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

        {selected && (
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>전표 추출 내역</div>
              <span style={{ fontSize: 11, background: selBadgeBg, color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px" }}>
                {selected.account_name} · {fmtN(selected.amount)}원
              </span>
            </div>
            <div style={{ height: 360, overflowY: "auto" }}>
              {extract === null ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt, fontSize: 13 }}>
                  <Spinner /> 로딩 중...
                </div>
              ) : (
                <table>
                  <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>연월</th>
                      <th style={{ textAlign: "center" }}>계정과목</th>
                      <th style={{ textAlign: "center" }}>거래처</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>차변</th>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>대변</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extract.map((r, i) => {
                      const label = `${r.year_month} ${r.account_name}`;
                      return (
                      <tr key={i} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); triggerComment({ page: PAGE, label, value: `${fmtN(r.dr > 0 ? r.dr : r.cr)}원` }, { top: rect.top, right: rect.right }); }} style={{ cursor: "pointer" }}>
                        <td style={{ textAlign: "center", color: subTxt, fontSize: 11, whiteSpace: "nowrap" }}>
                          {r.year_month.slice(2, 4)}-{r.year_month.slice(5, 7)}
                        </td>
                        <td style={{ textAlign: "left" }}>
                          {r.account_name}
                          {ck.has(commentKey(PAGE, label)) && <CommentDot inline inquiryId={ck.get(commentKey(PAGE, label))!} />}
                        </td>
                        <td style={{ textAlign: "left", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.counterparty}</td>
                        <td style={{ textAlign: "right", color: r.dr > 0 ? BLUE : zeroClr, whiteSpace: "nowrap" }}>
                          {r.dr > 0 ? fmtN(r.dr) : "-"}
                        </td>
                        <td style={{ textAlign: "right", color: r.cr > 0 ? RED : zeroClr, whiteSpace: "nowrap" }}>
                          {r.cr > 0 ? fmtN(r.cr) : "-"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: tfootBg }}>
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

      {selected && (
        <div ref={detailRef} className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>전표 상세 내역</div>
            {lines && <span style={{ fontSize: 12, color: dimTxt }}>총 {fmtN(lines.length)}건</span>}
          </div>
          <div style={{ height: 340, overflowY: "auto", overflowX: "auto" }}>
            {lines === null ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt, fontSize: 13 }}>
                <Spinner /> 로딩 중...
              </div>
            ) : (
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
                      <td style={{ textAlign: "left", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.counterparty}</td>
                      <td style={{ textAlign: "left", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: valTxt }}>{v.description}</td>
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

function DupBadge({ count, maxCount }: { count: number; maxCount: number }) {
  const t = Math.log(count) / Math.log(Math.max(maxCount, 2));
  const r = Math.round(255 - t * 75);
  const g = Math.round(220 - t * 220);
  const b = Math.round(220 - t * 220);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 24, height: 24, borderRadius: "50%",
      background: `rgb(${r},${g},${b})`,
      fontSize: 11, color: "#fff", fontWeight: 700,
    }}>
      {count}
    </span>
  );
}

function Spinner() {
  return <div className="spinner" style={{ width: 14, height: 14 }} />;
}

function DualSlider({ minVal, maxVal, min, max, step, minPct, maxPct, trackBg, onMinChange, onMaxChange }: {
  minVal: number; maxVal: number; min: number; max: number; step: number;
  minPct: number; maxPct: number; trackBg: string;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
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
