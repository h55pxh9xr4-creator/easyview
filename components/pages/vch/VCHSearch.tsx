"use client";

import { useState, useCallback } from "react";
import { fetchVCHSearch } from "@/lib/api";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

interface VCHItem {
  date: string; voucher_no: string; dr_cr: string; amount: number;
  counterparty: string; description: string; account_name: string;
  disclosure_acct: string; mgmt_acct: string;
}
interface SearchResult { total: number; page: number; page_size: number; items: VCHItem[] }

export default function VCHSearch() {
  const [keyword,     setKeyword]     = useState("");
  const [account,     setAccount]     = useState("");
  const [counterparty, setCp]         = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [drCr,        setDrCr]        = useState("");
  const [page,        setPage]        = useState(1);
  const [result,      setResult]      = useState<SearchResult | null>(null);
  const [loading,     setLoading]     = useState(false);

  const doSearch = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await fetchVCHSearch({
        keyword: keyword || undefined,
        account: account || undefined,
        counterparty: counterparty || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        dr_cr: drCr || undefined,
        page: p, page_size: 50,
      });
      setResult(data as SearchResult);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [keyword, account, counterparty, dateFrom, dateTo, drCr]);

  return (
    <div className="wrap">
      {/* 검색 폼 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">전표검색</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>키워드</div>
            <input className="fsel" style={{ width: "100%" }} value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch(1)}
              placeholder="적요/거래처/전표번호" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>계정</div>
            <input className="fsel" style={{ width: "100%" }} value={account}
              onChange={(e) => setAccount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch(1)}
              placeholder="계정과목명" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>거래처</div>
            <input className="fsel" style={{ width: "100%" }} value={counterparty}
              onChange={(e) => setCp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch(1)}
              placeholder="거래처명" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>시작일</div>
            <input className="fsel" type="date" style={{ width: "100%" }} value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>종료일</div>
            <input className="fsel" type="date" style={{ width: "100%" }} value={dateTo}
              onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>차/대</div>
            <select className="fsel" style={{ width: "100%" }} value={drCr} onChange={(e) => setDrCr(e.target.value)}>
              <option value="">전체</option>
              <option value="차변">차변</option>
              <option value="대변">대변</option>
            </select>
          </div>
        </div>
        <button className="ftbtn on" onClick={() => doSearch(1)} disabled={loading}>
          {loading ? "검색 중..." : "검색"}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="card">
          <div className="card-title">
            검색 결과 <span style={{ color: "#aaa", fontWeight: 400, fontSize: 13 }}>총 {result.total.toLocaleString()}건</span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>일자</th><th>전표번호</th><th>계정과목</th><th>공시용계정</th>
                  <th>거래처</th><th>적요</th><th>차/대</th><th>금액</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                    <td>{r.voucher_no}</td>
                    <td>{r.account_name}</td>
                    <td>{r.disclosure_acct}</td>
                    <td>{r.counterparty}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                    <td style={{ color: r.dr_cr === "차변" ? "#4fc3f7" : "#ef9a9a" }}>{r.dr_cr}</td>
                    <td>{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
            <button className="ftbtn" disabled={page <= 1} onClick={() => doSearch(page - 1)}>◀ 이전</button>
            <span style={{ color: "#aaa", fontSize: 13 }}>
              {page} / {Math.ceil(result.total / result.page_size)}
            </span>
            <button className="ftbtn" disabled={page >= Math.ceil(result.total / result.page_size)} onClick={() => doSearch(page + 1)}>다음 ▶</button>
          </div>
        </div>
      )}
    </div>
  );
}
