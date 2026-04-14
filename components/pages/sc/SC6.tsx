"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchSC6Exceptions, fetchSC6Extract, fetchVCHVoucherDetail,
  SC6Exception, SC6Extract, VCHCounterLineItem,
} from "@/lib/api";

const ORANGE = "#E87722";
const BLUE   = "rgba(37,99,235,1)";
const RED    = "rgba(220,38,38,1)";
const fmtN   = (n: number) => Math.round(n).toLocaleString("ko-KR");

const DATE_MIN = new Date("2024-01-01").getTime();
const DATE_MAX = new Date("2025-12-31").getTime();
const MS_DAY   = 86_400_000;
const tsToStr  = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const strToTs  = (s: string)  => new Date(s).getTime();

const THRESHOLD_OPTIONS = [
  { value: 5,  label: "5건 이하" },
  { value: 10, label: "10건 이하" },
  { value: 20, label: "20건 이하" },
  { value: 50, label: "50건 이하" },
];

export default function SC6() {
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo,   setDateTo]   = useState("2025-09-30");
  const [tsFrom,   setTsFrom]   = useState(strToTs("2024-01-01"));
  const [tsTo,     setTsTo]     = useState(strToTs("2025-09-30"));
  const [threshold, setThreshold] = useState(10);

  const [exceptions, setExceptions] = useState<SC6Exception[] | null>(null);
  const [loading,    setLoading]    = useState(false);

  const [selCP,     setSelCP]     = useState<SC6Exception | null>(null);
  const [extract,   setExtract]   = useState<SC6Extract[] | null>(null);
  const [exLoading, setExLoading] = useState(false);

  const [selVch,    setSelVch]    = useState<string | null>(null);
  const [lines,     setLines]     = useState<VCHCounterLineItem[] | null>(null);
  const [lnLoading, setLnLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    setSelCP(null); setExtract(null); setSelVch(null); setLines(null);
    fetchSC6Exceptions(dateFrom, dateTo, threshold)
      .then(setExceptions).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCP = async (cp: SC6Exception) => {
    if (selCP?.counterparty === cp.counterparty) {
      setSelCP(null); setExtract(null); setSelVch(null); setLines(null); return;
    }
    setSelCP(cp); setExtract(null); setSelVch(null); setLines(null);
    setExLoading(true);
    try {
      setExtract(await fetchSC6Extract(dateFrom, dateTo, cp.counterparty));
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

  const maxCnt    = exceptions ? Math.max(...exceptions.map(r => r.vch_cnt), 1) : 1;
  const totalCPs  = exceptions ? exceptions.length : 0;
  const extractDrTotal = extract ? extract.reduce((s, r) => s + r.dr_amount, 0) : 0;
  const extractCrTotal = extract ? extract.reduce((s, r) => s + r.cr_amount, 0) : 0;

  return (
    <div className="wrap">
      {/* ── 위험 설명 ─────────────────────────────────────────── */}
      <div className="info-note">
        💡 예상위험: 사용 빈도가 낮은 거래처를 통한 회계 오류의 가능성이 있는 전표 식별
      </div>

      {/* ── 필터 ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#888" }}>전표수 기준</span>
            <select className="fsel" value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}>
              {THRESHOLD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: "7px 22px", background: ORANGE, color: "#FFF", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-end" }}>
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      {/* ── KPI ──────────────────────────────────────────────── */}
      {exceptions && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <KpiCard label="희소 거래처 수" value={`${fmtN(totalCPs)}곳`}
            sub={selCP ? selCP.counterparty : undefined} active={!!selCP} />
          <KpiCard label={selCP ? "선택 거래처 전표수" : "최대 전표수 기준"}
            value={selCP ? `${fmtN(selCP.vch_cnt)}건` : `${threshold}건 이하`}
            sub={selCP ? selCP.counterparty : undefined} active={!!selCP} />
          {selCP && extract && (
            <>
              <KpiCard label="차변 합계" value={`${fmtN(extractDrTotal)}`} color={BLUE} active sub={selCP.counterparty} />
              <KpiCard label="대변 합계" value={`${fmtN(extractCrTotal)}`} color={RED} active sub={selCP.counterparty} />
            </>
          )}
        </div>
      )}

      {/* ── Exception 내역 + 전표 추출 내역 2열 ─────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: selCP ? "1fr 2fr" : "1fr 0px",
        columnGap: selCP ? 14 : 0,
        transition: "grid-template-columns 0.28s ease, column-gap 0.28s ease",
        minWidth: 0,
        overflow: "hidden",
        marginBottom: 14,
      }}>
        {/* Exception 내역 — 거래처 목록 */}
        <div className="card" style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>시나리오 Exception 내역</div>
            {exceptions && <span style={{ fontSize: 12, color: "#aaa" }}>{fmtN(totalCPs)}건</span>}
            {!selCP && exceptions && exceptions.length > 0 && (
              <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>👆 행 클릭 → 전표 추출</span>
            )}
            {selCP && (
              <button onClick={() => { setSelCP(null); setExtract(null); setSelVch(null); setLines(null); }}
                style={{ fontSize: 10, color: "#aaa", background: "none", border: "1px solid #E0E0E0", borderRadius: 4, padding: "2px 8px", cursor: "pointer", marginLeft: "auto" }}>
                선택 해제
              </button>
            )}
          </div>
          <div style={{ height: 400, overflowY: "auto" }}>
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa" }}>
                <Spinner /> 조회 중...
              </div>
            ) : !exceptions ? null : exceptions.length === 0 ? (
              <div style={{ padding: 40, color: "#bbb", textAlign: "center" }}>탐지된 항목이 없습니다</div>
            ) : (
              <table>
                <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: "center" }}>거래처</th>
                    <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>빈도수</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((r, i) => {
                    const isSel = selCP?.counterparty === r.counterparty;
                    return (
                      <tr key={i} onClick={() => handleSelectCP(r)}
                        style={{ cursor: "pointer", background: isSel ? "#FFF4EC" : undefined, borderLeft: isSel ? `3px solid ${ORANGE}` : "3px solid transparent" }}>
                        <td style={{ textAlign: "left", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.counterparty}</td>
                        <td style={{ textAlign: "center" }}>
                          <RareBadge count={r.vch_cnt} maxCount={maxCnt} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 전표 추출 내역 */}
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="card" style={{ height: "100%", minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>전표 추출 내역</div>
              {selCP && (
                <span style={{ fontSize: 11, background: "#FFF4EC", color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 10, padding: "2px 8px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selCP.counterparty}
                </span>
              )}
              {extract && <span style={{ fontSize: 12, color: "#aaa" }}>{extract.length}건</span>}
              {!selVch && extract && extract.length > 0 && (
                <span style={{ fontSize: 11, color: "#bbb", marginLeft: "auto" }}>👆 행 클릭 → 상세 내역</span>
              )}
            </div>
            <div style={{ height: 366, overflowY: "auto", overflowX: "hidden" }}>
              {exLoading ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa" }}>
                  <Spinner /> 로딩 중...
                </div>
              ) : !extract || extract.length === 0 ? (
                <div style={{ padding: 20, color: "#bbb", textAlign: "center", fontSize: 12 }}>
                  {selCP ? "해당 거래처 전표 없음" : ""}
                </div>
              ) : (
                <table style={{ tableLayout: "fixed", width: "100%" }}>
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "32%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "25%" }} />
                  </colgroup>
                  <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                    <tr>
                      <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>일자</th>
                      <th style={{ textAlign: "center" }}>전표번호</th>
                      <th style={{ textAlign: "center", color: BLUE }}>차변</th>
                      <th style={{ textAlign: "center", color: RED }}>대변</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extract.map((r, i) => {
                      const isSel = selVch === r.voucher_no;
                      return (
                        <tr key={i} onClick={() => handleSelectVch(r.voucher_no)}
                          style={{ cursor: "pointer", background: isSel ? "#FFF4EC" : undefined, borderLeft: isSel ? `3px solid ${ORANGE}` : "3px solid transparent" }}>
                          <td style={{ textAlign: "center", color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>{r.date}</td>
                          <td style={{ textAlign: "center", color: "#888", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.voucher_no}</td>
                          <td style={{ textAlign: "right", color: r.dr_amount ? BLUE : "#DDD", fontWeight: r.dr_amount ? 600 : 400, whiteSpace: "nowrap" }}>
                            {r.dr_amount ? fmtN(r.dr_amount) : "-"}
                          </td>
                          <td style={{ textAlign: "right", color: r.cr_amount ? RED : "#DDD", fontWeight: r.cr_amount ? 600 : 400, whiteSpace: "nowrap" }}>
                            {r.cr_amount ? fmtN(r.cr_amount) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#FFF7F0" }}>
                      <td colSpan={2}>합계</td>
                      <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap" }}>{fmtN(extractDrTotal)}</td>
                      <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>{fmtN(extractCrTotal)}</td>
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

/** 빈도수 배지 — 낮을수록 더 붉음 */
function RareBadge({ count, maxCount }: { count: number; maxCount: number }) {
  const t = maxCount > 1 ? 1 - Math.log(count + 1) / Math.log(maxCount + 2) : 1;
  const r = Math.round(255 - t * 75);
  const g = Math.round(220 - t * 220);
  const b = Math.round(220 - t * 220);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, borderRadius: "50%", background: `rgb(${r},${g},${b})`, fontSize: 11, color: "#fff", fontWeight: 700 }}>
      {count}
    </span>
  );
}

function KpiCard({ label, value, sub, active, color }: { label: string; value: string; sub?: string; active?: boolean; color?: string }) {
  return (
    <div className="card" style={{ padding: "12px 20px", minWidth: 0, flex: 1, borderTop: active ? `3px solid ${ORANGE}` : "3px solid transparent", transition: "border-color 0.2s" }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color ?? "#1a1a1a" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: active ? ORANGE : "#bbb", marginTop: 4, fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
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
      <span style={{ className="spinner" style={{ width:14, height:14 }} }} />
      
    </>
  );
}

const inputSt: React.CSSProperties = { fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, color: "#333" };
