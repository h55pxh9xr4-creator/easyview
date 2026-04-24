"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchVCHSearchDiscAccts, fetchVCHSearch, fetchVCHVoucherDetail,
  VCHSearchItem, VCHCounterLineItem,
} from "@/lib/api";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems, commentKey } from "@/hooks/useCommentedItems";
import { CommentDot } from "@/components/ui/CommentDot";
import { useDarkMode } from "@/hooks/useDarkMode";

const ORANGE = "#E87722";
const BLUE   = "rgba(37,99,235,1)";
const RED    = "rgba(220,38,38,1)";
const fmtN   = (n: number) => Math.round(n).toLocaleString("ko-KR");

type DrCrFilter = "" | "차변" | "대변";

const PAGE = "VCH 검색";

export default function VCHSearch() {
  const isDark = useDarkMode();
  const { triggerComment } = useComment();
  const ck = useCommentedItems(state => state.ck);

  const [dateFrom,     setDateFrom]     = useState("2024-01-01");
  const [dateTo,       setDateTo]       = useState("2025-09-30");
  const [discAcct,     setDiscAcct]     = useState("");
  const [cpFilter,     setCpFilter]     = useState("");
  const [keyword,      setKeyword]      = useState("");
  const [drCr,         setDrCr]         = useState<DrCrFilter>("");
  const [discAcctList, setDiscAcctList] = useState<string[]>([]);

  const [searchResult, setSearchResult] = useState<{ total: number; items: VCHSearchItem[] } | null>(null);
  const [searchPage,   setSearchPage]   = useState(1);
  const [searching,    setSearching]    = useState(false);
  const SEARCH_PAGE = 50;

  const [selectedVno,  setSelectedVno]  = useState<string | null>(null);
  const [detail,       setDetail]       = useState<VCHCounterLineItem[] | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const [w1, setW1] = useState<Record<string, number>>({ date: 90, vno: 130, acct: 220, cp: 80, dr: 150, cr: 150 });
  const [w2, setW2] = useState<Record<string, number>>({ acct: 150, disc: 130, dr: 90, cr: 90 });
  const [w3, setW3] = useState<Record<string, number>>({ acct: 150, cp: 100, dr: 120, cr: 120 });

  const startResize = (setter: React.Dispatch<React.SetStateAction<Record<string, number>>>, col: string, curW: number, e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const onMove = (ev: MouseEvent) => setter(p => ({ ...p, [col]: Math.max(50, curW + ev.clientX - x0) }));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    fetchVCHSearchDiscAccts(dateFrom, dateTo).then(setDiscAcctList).catch(console.error);
  }, [dateFrom, dateTo]);

  const searchParams = useCallback(() => ({
    keyword:      keyword   || undefined,
    disc_acct:    discAcct  || undefined,
    counterparty: cpFilter  || undefined,
    date_from:    dateFrom  || undefined,
    date_to:      dateTo    || undefined,
    dr_cr:        drCr      || undefined,
  }), [keyword, discAcct, cpFilter, dateFrom, dateTo, drCr]);

  const doSearch = useCallback(async (p = 1) => {
    setSearching(true);
    setSearchResult(null);
    setSelectedVno(null);
    setDetail(null);
    setSearchPage(p);
    try {
      const res = await fetchVCHSearch({ ...searchParams(), page: p, page_size: SEARCH_PAGE });
      setSearchResult(res);
    } finally {
      setSearching(false);
    }
  }, [searchParams]);

  const doPageSearch = async (p: number) => {
    const res = await fetchVCHSearch({ ...searchParams(), page: p, page_size: SEARCH_PAGE });
    setSearchResult(res);
    setSearchPage(p);
    setSelectedVno(null);
    setDetail(null);
  };

  const handleRowClick = async (vno: string) => {
    if (selectedVno === vno) { setSelectedVno(null); setDetail(null); return; }
    setSelectedVno(vno);
    setDetail(null);
    try {
      const d = await fetchVCHVoucherDetail(vno);
      setDetail(d);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) { console.error(e); }
  };

  const detailSummary = detail
    ? Object.values(
        detail.reduce<Record<string, { account_name: string; disclosure_acct: string; dr: number; cr: number }>>(
          (acc, r) => {
            if (!acc[r.account_name]) acc[r.account_name] = { account_name: r.account_name, disclosure_acct: r.disclosure_acct, dr: 0, cr: 0 };
            if (r.dr_cr === "차변") acc[r.account_name].dr += r.amount;
            else acc[r.account_name].cr += r.amount;
            return acc;
          }, {}
        )
      ).sort((a, b) => (b.dr + b.cr) - (a.dr + a.cr))
    : [];

  // 다크모드 색상
  const subTxt    = isDark ? "#9198A8" : "#888";
  const dimTxt    = isDark ? "#5A6070" : "#aaa";
  const valTxt    = isDark ? "#C8CCDA" : "#666";
  const zeroClr   = isDark ? "#3A3F4A" : "#DDD";
  const theadBg   = isDark ? "#1C1F26" : "#FFF";
  const tfootBg   = isDark ? "rgba(232,119,34,0.10)" : "#FFF7F0";
  const selRowBg  = isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC";
  const selBadgeBg = isDark ? "rgba(232,119,34,0.15)" : "#FFF4EC";
  const toggleInactiveBg  = isDark ? "#1C1F26" : "#F5F5F5";
  const toggleInactiveClr = isDark ? "#9198A8" : "#555";
  const toggleInactiveBdr = isDark ? "#2E3039" : "#E0E0E0";
  const inputBdr  = isDark ? "#2E3039" : "#ddd";
  const inputClr  = isDark ? "#E2E5EC" : "#333";
  const inputBg   = isDark ? "#1C1F26" : "#fff";

  const inputStyle: React.CSSProperties = {
    fontSize: 12, padding: "4px 8px",
    border: `1px solid ${inputBdr}`,
    borderRadius: 4, color: inputClr,
    background: inputBg,
    colorScheme: isDark ? "dark" : "light",
  };

  return (
    <div className="wrap">

      {/* ── 필터 바 ──────────────────────────────────────────── */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: subTxt, whiteSpace: "nowrap" }}>기간</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 11, color: dimTxt }}>~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: subTxt, whiteSpace: "nowrap" }}>계정과목</span>
            <select value={discAcct} onChange={e => setDiscAcct(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
              <option value="">모두</option>
              {discAcctList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: subTxt, whiteSpace: "nowrap" }}>거래처</span>
            <input value={cpFilter} onChange={e => setCpFilter(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch(1)}
              placeholder="거래처명 검색" style={{ ...inputStyle, width: 140 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 11, color: subTxt, whiteSpace: "nowrap" }}>키워드</span>
            <div style={{ position: "relative", flex: 1 }}>
              <input value={keyword} onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch(1)}
                placeholder="적요 / 전표번호"
                style={{ ...inputStyle, width: "100%", paddingRight: 28 }} />
              {keyword && (
                <button onClick={() => setKeyword("")}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: dimTxt, fontSize: 14, lineHeight: 1, padding: 0 }}>
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 차/대 토글 */}
          <div style={{ display: "flex", gap: 2 }}>
            {([["", "모두"], ["차변", "차변"], ["대변", "대변"]] as [DrCrFilter, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setDrCr(val)}
                style={{
                  fontSize: 12, padding: "4px 12px", borderRadius: 4, cursor: "pointer",
                  fontWeight: drCr === val ? 700 : 400,
                  background: drCr === val ? ORANGE : toggleInactiveBg,
                  color: drCr === val ? "#FFF" : toggleInactiveClr,
                  border: `1px solid ${drCr === val ? ORANGE : toggleInactiveBdr}`,
                }}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => doSearch(1)} disabled={searching}
            style={{ fontSize: 12, padding: "5px 18px", background: ORANGE, color: "#FFF", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, opacity: searching ? 0.6 : 1 }}>
            {searching ? "검색 중..." : "검색"}
          </button>
        </div>
      </div>

      {/* ── 전표검색 표 ──────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 12, color: ORANGE, fontWeight: 600, marginBottom: 6 }}>
          💡 (Step1) 위쪽 FILTER 기능을 활용하여 분석 대상 전표 필터링
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>전표검색</div>
            {searchResult && <span style={{ fontSize: 12, color: dimTxt }}>총 {fmtN(searchResult.total)}건</span>}
            {searchResult && !selectedVno && (
              <span style={{ fontSize: 11, color: dimTxt, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13 }}>👆</span> 전표 행을 클릭하면 상세 내역을 볼 수 있습니다
              </span>
            )}
            {selectedVno && (
              <span style={{ fontSize: 11, background: selBadgeBg, color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 12, padding: "2px 10px", marginLeft: "auto" }}>
                📄 {selectedVno} 선택됨
                <button onClick={() => { setSelectedVno(null); setDetail(null); }}
                  style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", color: ORANGE, fontWeight: 700, fontSize: 11 }}>✕</button>
              </span>
            )}
          </div>

          <div style={{ height: 300, overflowY: "auto", overflowX: "auto" }}>
            {searching ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: dimTxt, fontSize: 13 }}>
                <Spinner /> 검색 중...
              </div>
            ) : !searchResult ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: dimTxt, fontSize: 13 }}>
                검색 조건을 설정하고 검색 버튼을 누르세요
              </div>
            ) : searchResult.items.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: dimTxt, fontSize: 13 }}>검색 결과가 없습니다</div>
            ) : (
              <table style={{ tableLayout: "fixed", width: "100%" }}>
                <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
                  <tr>
                    {([["date","일자"],["vno","전표번호"],["acct","계정과목"],["cp","거래처"]] as [string,string][]).map(([col, label]) => (
                      <th key={col} style={{ textAlign: "center", whiteSpace: "nowrap", width: w1[col], position: "relative" }}>
                        {label}
                        <div onMouseDown={e => startResize(setW1, col, w1[col], e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                      </th>
                    ))}
                    <th style={{ textAlign: "center" }}>적요</th>
                    {([["dr","차변"],["cr","대변"]] as [string,string][]).map(([col, label]) => (
                      <th key={col} style={{ textAlign: "center", whiteSpace: "nowrap", width: w1[col], position: "relative" }}>
                        {label}
                        <div onMouseDown={e => startResize(setW1, col, w1[col], e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchResult.items.map((r, i) => {
                    const isSelected = selectedVno === r.voucher_no;
                    return (
                      <tr key={i}
                        onClick={(e) => {
                          if (isSelected) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            triggerComment({ page: PAGE, label: r.voucher_no, value: `${fmtN(r.amount)}원` }, { top: rect.top, right: rect.right }, e.currentTarget);
                          } else { handleRowClick(r.voucher_no); }
                        }}
                        style={{ cursor: "pointer", background: isSelected ? selRowBg : undefined, borderLeft: "3px solid transparent" }}>
                        <td style={{ whiteSpace: "nowrap", color: subTxt, fontSize: 11, textAlign: "center" }}>{r.date}</td>
                        <td style={{ color: isSelected ? ORANGE : subTxt, fontSize: 11, whiteSpace: "nowrap", fontWeight: isSelected ? 700 : undefined, textAlign: "center" }}>
                          {r.voucher_no}
                          {ck.has(commentKey(PAGE, r.voucher_no)) && <CommentDot inline inquiryId={ck.get(commentKey(PAGE, r.voucher_no))!} />}
                        </td>
                        <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{r.account_name}</td>
                        <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{r.counterparty}</td>
                        <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: valTxt, textAlign: "left" }}>{r.description}</td>
                        <td style={{ textAlign: "right", color: r.dr_cr === "차변" ? BLUE : zeroClr, whiteSpace: "nowrap" }}>
                          {r.dr_cr === "차변" ? fmtN(r.amount) : "-"}
                        </td>
                        <td style={{ textAlign: "right", color: r.dr_cr === "대변" ? RED : zeroClr, whiteSpace: "nowrap" }}>
                          {r.dr_cr === "대변" ? fmtN(r.amount) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: tfootBg }}>
                    <td colSpan={5}>합계</td>
                    <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap" }}>
                      {fmtN(searchResult.items.filter(v => v.dr_cr === "차변").reduce((s, v) => s + v.amount, 0))}
                    </td>
                    <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>
                      {fmtN(searchResult.items.filter(v => v.dr_cr === "대변").reduce((s, v) => s + v.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {searchResult && Math.ceil(searchResult.total / SEARCH_PAGE) > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", justifyContent: "center" }}>
              <button className="ftbtn" disabled={searchPage <= 1} onClick={() => doPageSearch(searchPage - 1)}>◀ 이전</button>
              <span style={{ color: subTxt, fontSize: 13 }}>{searchPage} / {Math.ceil(searchResult.total / SEARCH_PAGE)}</span>
              <button className="ftbtn" disabled={searchPage >= Math.ceil(searchResult.total / SEARCH_PAGE)} onClick={() => doPageSearch(searchPage + 1)}>다음 ▶</button>
            </div>
          )}
        </div>
      </div>

      {/* ── 전표 상세 ─────────────────────────────────────────── */}
      {selectedVno && (
        <div ref={detailRef}>
          <div style={{ fontSize: 12, color: ORANGE, fontWeight: 600, marginBottom: 8 }}>
            💡 (Step2) 선택한 전표의 계정별 요약과 전체 라인을 확인하세요
          </div>

          {detail === null ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: dimTxt, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Spinner /> 로딩 중...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

              {/* 계정별 요약 */}
              <div className="card">
                <div className="card-title">계정별 요약 — {selectedVno}</div>
                <div style={{ height: 260, overflowY: "auto" }}>
                  <table style={{ tableLayout: "fixed", width: "100%" }}>
                    <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: "center", width: w2.acct, position: "relative" }}>
                          계정과목
                          <div onMouseDown={e => startResize(setW2, "acct", w2.acct, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                        <th style={{ textAlign: "center", width: w2.disc, color: subTxt, fontSize: 11, fontWeight: 500, position: "relative" }}>
                          공시용계정
                          <div onMouseDown={e => startResize(setW2, "disc", w2.disc, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                        <th style={{ textAlign: "center", width: w2.dr, position: "relative" }}>
                          차변
                          <div onMouseDown={e => startResize(setW2, "dr", w2.dr, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                        <th style={{ textAlign: "center", width: w2.cr, position: "relative" }}>
                          대변
                          <div onMouseDown={e => startResize(setW2, "cr", w2.cr, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailSummary.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, textAlign: "left" }}>{r.account_name}</td>
                          <td style={{ color: subTxt, fontSize: 11, textAlign: "center" }}>{r.disclosure_acct}</td>
                          <td style={{ textAlign: "right", color: r.dr > 0 ? BLUE : zeroClr, whiteSpace: "nowrap" }}>
                            {r.dr > 0 ? fmtN(r.dr) : "-"}
                          </td>
                          <td style={{ textAlign: "right", color: r.cr > 0 ? RED : zeroClr, whiteSpace: "nowrap" }}>
                            {r.cr > 0 ? fmtN(r.cr) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: tfootBg }}>
                        <td colSpan={2}>합계</td>
                        <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap" }}>
                          {fmtN(detailSummary.reduce((s, r) => s + r.dr, 0))}
                        </td>
                        <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap" }}>
                          {fmtN(detailSummary.reduce((s, r) => s + r.cr, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 전표 라인 상세 */}
              <div className="card">
                <div className="card-title">전표 상세 내역</div>
                <div style={{ height: 260, overflowY: "auto", overflowX: "hidden" }}>
                  <table style={{ tableLayout: "fixed", width: "100%" }}>
                    <thead style={{ position: "sticky", top: 0, background: theadBg, zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: "center", width: w3.acct, position: "relative" }}>
                          계정과목
                          <div onMouseDown={e => startResize(setW3, "acct", w3.acct, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                        <th style={{ textAlign: "center", width: w3.cp, position: "relative" }}>
                          거래처
                          <div onMouseDown={e => startResize(setW3, "cp", w3.cp, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                        <th style={{ textAlign: "center" }}>적요</th>
                        <th style={{ textAlign: "center", width: w3.dr, position: "relative" }}>
                          차변
                          <div onMouseDown={e => startResize(setW3, "dr", w3.dr, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                        <th style={{ textAlign: "center", width: w3.cr, position: "relative" }}>
                          대변
                          <div onMouseDown={e => startResize(setW3, "cr", w3.cr, e)} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize" }} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.map((v, i) => (
                        <tr key={i}>
                          <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{v.account_name}</td>
                          <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{v.counterparty}</td>
                          <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: valTxt, textAlign: "left" }}>{v.description}</td>
                          <td style={{ textAlign: v.dr_cr === "차변" ? "right" : "center", color: v.dr_cr === "차변" ? BLUE : zeroClr, whiteSpace: "nowrap", paddingRight: v.dr_cr === "차변" ? 12 : undefined }}>
                            {v.dr_cr === "차변" ? fmtN(v.amount) : "-"}
                          </td>
                          <td style={{ textAlign: v.dr_cr === "대변" ? "right" : "center", color: v.dr_cr === "대변" ? RED : zeroClr, whiteSpace: "nowrap", paddingRight: v.dr_cr === "대변" ? 12 : undefined }}>
                            {v.dr_cr === "대변" ? fmtN(v.amount) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: tfootBg }}>
                        <td colSpan={3}>합계</td>
                        <td style={{ textAlign: "right", color: BLUE, whiteSpace: "nowrap", paddingRight: 12 }}>
                          {fmtN(detail.filter(v => v.dr_cr === "차변").reduce((s, v) => s + v.amount, 0))}
                        </td>
                        <td style={{ textAlign: "right", color: RED, whiteSpace: "nowrap", paddingRight: 12 }}>
                          {fmtN(detail.filter(v => v.dr_cr === "대변").reduce((s, v) => s + v.amount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="spinner" style={{ width:14, height:14 }} />;
}
