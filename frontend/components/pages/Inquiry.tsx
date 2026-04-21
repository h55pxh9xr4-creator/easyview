"use client";

import { useEffect, useState } from "react";
import {
  fetchInquiries, fetchInquiry, createInquiry, updateInquiry, replyInquiry, deleteInquiry,
  InquiryItem, InquiryDetail, INQUIRY_CATEGORIES,
} from "@/lib/api";
import { useComment } from "@/hooks/useComment";
import { usePendingInquiry } from "@/hooks/usePendingInquiry";
import { useDarkMode } from "@/hooks/useDarkMode";

type View = "list" | "detail" | "write" | "edit";
const ADMIN_ID = "admin";
const PAGE_SIZE = 10;

// 페이지명 → 탭/서브 매핑
const PAGE_NAV: Record<string, { tab: string; sub: string; label: string }> = {
  "Summary":     { tab: "summary", sub: "summary",      label: "Summary" },
  "PL 요약":     { tab: "pl",      sub: "pl-sum",        label: "PL 요약" },
  "PL 추이분석": { tab: "pl",      sub: "pl-trend",      label: "PL 추이" },
  "PL 계정분석": { tab: "pl",      sub: "pl-acct",       label: "PL 계정" },
  "매출분석":    { tab: "pl",      sub: "pl-sale",       label: "매출분석" },
  "손익항목":    { tab: "pl",      sub: "pl-item",       label: "손익항목" },
  "BS 요약":     { tab: "bs",      sub: "bs-sum",        label: "BS 요약" },
  "BS 추이분석": { tab: "bs",      sub: "bs-trend",      label: "BS 추이" },
  "BS 계정분석": { tab: "bs",      sub: "bs-acct",       label: "BS 계정" },
  "전표분석":    { tab: "vch",     sub: "vch-analysis",  label: "전표분석" },
  "전표분석내역": { tab: "vch",     sub: "vch-analysis",  label: "전표분석" },
  "전표검색":    { tab: "vch",     sub: "vch-search",    label: "전표검색" },
};

function parseCommentTarget(content: string) {
  const get = (key: string) => content.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1]?.trim();
  return { page: get("페이지"), label: get("항목"), value: get("값"), sub: get("선택 월") };
}

export default function Inquiry({ onNavigate }: { onNavigate?: (tab: string, sub: string, label: string, keepComment?: boolean) => void }) {
  const isDark = useDarkMode();

  const [view,        setView]       = useState<View>("list");
  const [list,        setList]       = useState<InquiryItem[]>([]);
  const [detail,      setDetail]     = useState<InquiryDetail | null>(null);
  const [loading,     setLoading]    = useState(false);
  const [submitting,  setSubmitting] = useState(false);
  const [toast,       setToast]      = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [form,        setForm]       = useState({ category: "기타 문의", title: "", content: "", corporation: "", is_secret: false });
  const [replyText,   setReplyText]  = useState("");
  const [selected,    setSelected]   = useState<Set<number>>(new Set());
  const [searchText,  setSearchText] = useState("");
  const [filterCat,   setFilterCat]  = useState("");
  const [filterCorp,  setFilterCorp] = useState("");
  const [myOnly,      setMyOnly]     = useState(true);
  const [page,        setPage]       = useState(1);

  const currentUser = typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? "") : "";
  const isAdmin = currentUser === ADMIN_ID;
  const { triggerComment, openPanel } = useComment();
  const pendingId    = usePendingInquiry(state => state.pendingId);
  const clearPending = usePendingInquiry(state => state.setPendingId);

  // ── 다크모드 색상 ─────────────────────────────────────────
  const bg2     = isDark ? "#1C1F26" : "#fff";
  const bg3     = isDark ? "#252830" : "#FAFAFA";
  const bdr     = isDark ? "#2E3039" : "#E0E0E0";
  const bdr2    = isDark ? "#2E3039" : "#F0F0F0";
  const txtP    = isDark ? "#E2E5EC" : "#2C2C2C";
  const txtS    = isDark ? "#9198A8" : "#666";
  const txtD    = isDark ? "#5A6070" : "#aaa";
  const txtDim  = isDark ? "#5A6070" : "#999";
  const emptyClr = isDark ? "#5A6070" : "#ccc";

  // ── 동적 스타일 상수 ──────────────────────────────────────
  const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, color: isDark ? "#9198A8" : "#555", textAlign: "center" as const, whiteSpace: "nowrap", background: bg3 };
  const td: React.CSSProperties = { padding: "11px 12px", whiteSpace: "nowrap" };
  const cardS: React.CSSProperties = { background: bg2, borderRadius: 10, padding: "24px 28px", boxShadow: isDark ? "0 1px 4px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.2)" : "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: txtDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" };
  const inp: React.CSSProperties = { width: "100%", border: `1px solid ${bdr}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", color: txtP, background: bg2, outline: "none", boxSizing: "border-box" };
  const backBtn: React.CSSProperties = { padding: "5px 14px", border: `1px solid ${bdr}`, borderRadius: 6, background: bg2, color: isDark ? "#9198A8" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  const cancelBtn: React.CSSProperties = { padding: "7px 18px", background: bg2, color: isDark ? "#9198A8" : "#888", border: `1px solid ${bdr}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  const submitBtn: React.CSSProperties = { padding: "7px 22px", background: "#E87722", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const pgBtn = (active: boolean): React.CSSProperties => ({
    width: 32, height: 32, border: active ? "none" : `1px solid ${bdr2}`, borderRadius: 6,
    background: active ? "#E87722" : bg2, color: active ? "#fff" : (isDark ? "#9198A8" : "#555"),
    fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  const selStyle = (hasVal: boolean): React.CSSProperties => ({
    border: `1px solid ${bdr}`, borderRadius: 6, padding: "7px 28px 7px 10px", fontSize: 12,
    fontFamily: "inherit", color: hasVal ? txtP : txtDim, appearance: "none",
    background: `${bg2} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23${isDark ? "5A6070" : "999"}'/%3E%3C/svg%3E") no-repeat right 10px center`,
    cursor: "pointer",
  });

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadList = () => {
    setLoading(true);
    fetchInquiries().then(setList).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    if (pendingId !== null) {
      openDetail(pendingId);
      clearPending(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId]);

  const openDetail = (id: number) => {
    fetchInquiry(id).then(d => { setDetail(d); setReplyText(""); setView("detail"); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      await createInquiry({ ...form, author: currentUser });
      setForm({ category: "기타 문의", title: "", content: "", corporation: "", is_secret: false });
      loadList(); setView("list");
      showToast("문의가 등록되었습니다.");
    } catch { showToast("등록 중 오류가 발생했습니다.", "err"); }
    finally { setSubmitting(false); }
  };

  const handleReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await replyInquiry(detail.id, replyText);
      openDetail(detail.id);
      showToast("답변이 등록되었습니다.");
    } catch { showToast("답변 등록 중 오류가 발생했습니다.", "err"); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      await updateInquiry(detail.id, { category: form.category, title: detail.title, content: form.content, corporation: form.corporation, is_secret: form.is_secret });
      openDetail(detail.id);
      showToast("수정되었습니다.");
    } catch { showToast("수정 중 오류가 발생했습니다.", "err"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (ids: number[]) => {
    if (!confirm(`${ids.length}건을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(ids.map(id => deleteInquiry(id)));
      setSelected(new Set());
      if (view === "detail") setView("list");
      loadList();
      showToast("삭제되었습니다.");
    } catch { showToast("삭제 중 오류가 발생했습니다.", "err"); }
  };

  // ── 법인 목록 (등록된 법인 기준으로 동적 생성) ──────────────
  const corpOptions = Array.from(new Set(list.map(i => i.corporation).filter(Boolean))).sort();

  // ── 필터링 + 페이지네이션 ─────────────────────────────────
  const filtered = list.filter(item => {
    const matchMy   = !myOnly || isAdmin || item.author === currentUser;
    const matchCat  = !filterCat  || item.category === filterCat;
    const matchCorp = !filterCorp || item.corporation === filterCorp;
    const matchText = !searchText || item.title.includes(searchText) || item.author.includes(searchText);
    return matchMy && matchCat && matchCorp && matchText;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(paged.map(i => i.id)) : new Set());
  };
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetPage = () => setPage(1);

  // ── 공통 토스트 ────────────────────────────────────────────
  const Toast = () => toast ? (
    <div style={{
      position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)",
      background: toast.type === "ok" ? "#2C2C2C" : "#EF4444",
      color: "#fff", padding: "10px 24px", borderRadius: "8px",
      fontSize: "13px", fontWeight: 600, zIndex: 9999,
      boxShadow: "0 4px 16px rgba(0,0,0,.18)",
    }}>
      {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
    </div>
  ) : null;

  // ── 목록 ──────────────────────────────────────────────────
  if (view === "list") return (
    <div className="wrap">
      <Toast />

      {/* 툴바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {/* 검색 */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: isDark ? "#5A6070" : "#bbb" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchText}
            onChange={e => { setSearchText(e.target.value); resetPage(); }}
            placeholder="검색어를 입력해주세요..."
            style={{ border: `1px solid ${bdr}`, borderRadius: 6, padding: "7px 12px 7px 30px", fontSize: 12, fontFamily: "inherit", width: 200, outline: "none", background: bg2, color: txtP }}
          />
        </div>

        {/* 카테고리 필터 */}
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); resetPage(); }} style={selStyle(!!filterCat)}>
          <option value="">전체 카테고리</option>
          {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* 법인 필터 */}
        <select value={filterCorp} onChange={e => { setFilterCorp(e.target.value); resetPage(); }} style={selStyle(!!filterCorp)}>
          <option value="">전체 법인</option>
          {corpOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* 내 요청만 보기 토글 */}
        {!isAdmin && (
          <button
            onClick={() => { setMyOnly(p => !p); resetPage(); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              border: myOnly ? "none" : `1px solid ${bdr}`,
              background: myOnly ? "#E87722" : bg2,
              color: myOnly ? "#fff" : (isDark ? "#9198A8" : "#555"),
              transition: "all .15s",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {myOnly ? "내 요청만" : "전체 요청"}
          </button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => { if (selected.size > 0) handleDelete([...selected]); }}
            disabled={selected.size === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", border: `1px solid ${bdr}`, borderRadius: 6, background: bg2, color: selected.size > 0 ? (isDark ? "#9198A8" : "#555") : (isDark ? "#3A3F4A" : "#bbb"), fontSize: 12, fontWeight: 600, cursor: selected.size > 0 ? "pointer" : "default", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            삭제
          </button>
          <button
            onClick={() => setView("write")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px", border: "none", borderRadius: 6, background: "#E87722", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            게시글 작성
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${bdr2}`, background: bg3 }}>
              <th style={{ ...th, width: 40 }}>
                <input type="checkbox"
                  checked={paged.length > 0 && paged.every(i => selected.has(i.id))}
                  onChange={e => toggleAll(e.target.checked)}
                />
              </th>
              <th style={{ ...th, width: 60 }}>번호</th>
              <th style={{ ...th, width: 110 }}>법인</th>
              <th style={{ ...th, width: 120 }}>구분</th>
              <th style={{ ...th }}>제목</th>
              <th style={{ ...th, width: 100 }}>작성자</th>
              <th style={{ ...th, width: 130 }}>작성일시</th>
              <th style={{ ...th, width: 90 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "52px", color: emptyClr }}>불러오는 중...</td></tr>
            )}
            {!loading && paged.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "52px", color: emptyClr }}>등록된 문의가 없습니다.</td></tr>
            )}
            {paged.map(item => (
              <tr
                key={item.id}
                style={{ borderBottom: `1px solid ${bdr2}`, cursor: "pointer", transition: "background .1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = bg3)}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                </td>
                <td style={{ ...td, textAlign: "center", color: txtDim }} onClick={() => openDetail(item.id)}>{item.id}</td>
                <td style={{ ...td, textAlign: "center", color: txtS, fontSize: 12 }} onClick={() => openDetail(item.id)}>
                  {item.corporation || <span style={{ color: emptyClr }}>-</span>}
                </td>
                <td style={{ ...td, textAlign: "center" }} onClick={() => openDetail(item.id)}>
                  <span style={{ ...badge, ...catColor(item.category, isDark) }}>{item.category}</span>
                </td>
                <td style={{ ...td, color: txtP, fontWeight: 500, textAlign: "left" }} onClick={() => openDetail(item.id)}>
                  {item.is_secret && !isAdmin && item.author !== currentUser
                    ? <span style={{ color: emptyClr }}>🔒 비밀글입니다.</span>
                    : item.title}
                </td>
                <td style={{ ...td, textAlign: "center", color: txtS }} onClick={() => openDetail(item.id)}>{item.author}</td>
                <td style={{ ...td, textAlign: "center", color: txtDim, fontSize: 12 }} onClick={() => openDetail(item.id)}>{item.created_at}</td>
                <td style={{ ...td, textAlign: "center", color: item.status === "답변완료" ? txtS : emptyClr, fontSize: 12 }} onClick={() => openDetail(item.id)}>
                  {item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn(false)}>{"<"}</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setPage(n)} style={pgBtn(n === page)}>{n}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtn(false)}>{">"}</button>
        </div>
      )}
    </div>
  );

  // ── 글쓰기 ────────────────────────────────────────────────
  if (view === "write") return (
    <div className="wrap">
      <Toast />
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${bdr2}` }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: txtP }}>게시글 작성</span>
          <button onClick={() => setView("list")} style={backBtn}>← 목록으로</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>카테고리</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>법인</label>
              <input
                value={form.corporation}
                onChange={e => setForm(p => ({ ...p, corporation: e.target.value }))}
                placeholder="법인명을 입력하세요"
                list="corp-list"
                style={inp}
              />
              <datalist id="corp-list">
                {corpOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label style={lbl}>제목</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="제목을 입력하세요" required style={inp} />
          </div>
          <div>
            <label style={lbl}>내용</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="문의 내용을 상세히 입력해주세요." required rows={9} style={{ ...inp, resize: "vertical", lineHeight: 1.7 }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: txtS, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_secret} onChange={e => setForm(p => ({ ...p, is_secret: e.target.checked }))} />
            비밀글로 등록
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: `1px solid ${bdr2}` }}>
            <button type="button" onClick={() => setView("list")} style={cancelBtn}>취소</button>
            <button type="submit" disabled={submitting} style={{ ...submitBtn, opacity: submitting ? 0.7 : 1 }}>{submitting ? "등록 중..." : "등록"}</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── 수정 ──────────────────────────────────────────────────
  if (view === "edit" && detail) {
    return (
      <div className="wrap">
        <Toast />
        <div className="card">
          <div style={{ borderBottom: `1px solid ${bdr2}`, paddingBottom: 14, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: txtP }}>문의 수정</span>
            <button onClick={() => setView("detail")} style={backBtn}>← 취소</button>
          </div>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <select className="fsel" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 13, padding: "6px 28px 6px 10px", background: bg2, color: txtP, border: `1px solid ${bdr}`, borderRadius: 6, fontFamily: "inherit" }}>
                {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                value={form.corporation}
                onChange={e => setForm(p => ({ ...p, corporation: e.target.value }))}
                placeholder="법인명"
                list="corp-list-edit"
                style={{ fontSize: 13, padding: "6px 12px", background: bg2, color: txtP, border: `1px solid ${bdr}`, borderRadius: 6, fontFamily: "inherit", outline: "none" }}
              />
              <datalist id="corp-list-edit">
                {corpOptions.map(c => <option key={c} value={c} />)}
              </datalist>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: txtS, cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_secret} onChange={e => setForm(p => ({ ...p, is_secret: e.target.checked }))} />
                비밀글
              </label>
            </div>
            <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="제목" required />
            <textarea style={{ ...inp, resize: "vertical", minHeight: 160 }} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="내용" required />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setView("detail")} style={cancelBtn}>취소</button>
              <button type="submit" disabled={submitting} style={{ ...submitBtn, opacity: submitting ? 0.7 : 1 }}>{submitting ? "저장 중..." : "저장"}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── 상세 ──────────────────────────────────────────────────
  if (view === "detail" && detail) {
    const canView = isAdmin || detail.author === currentUser || !detail.is_secret;
    const canEdit = isAdmin || detail.author === currentUser;
    return (
      <div className="wrap">
        <Toast />
        <div className="card">
          <div style={{ borderBottom: `1px solid ${bdr2}`, paddingBottom: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: txtP, lineHeight: 1.4 }}>
                  {detail.is_secret && <span style={{ fontSize: 13, marginRight: 5 }}>🔒</span>}
                  {detail.title}
                </span>
                <span style={{ ...badge, ...catColor(detail.category, isDark) }}>{detail.category}</span>
                <span style={{ ...badge, background: isDark ? "#252830" : "#EFEFEF", color: isDark ? "#9198A8" : "#444" }}>{detail.status}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {(() => {
                  const parsed = parseCommentTarget(detail.content);
                  const nav = parsed.page ? PAGE_NAV[parsed.page] : null;
                  if (!nav || !onNavigate) return null;
                  return (
                    <button
                      style={{ ...cancelBtn, background: isDark ? "#1E1812" : "#FFF8F3", color: "#E87722", borderColor: isDark ? "#5C3A1A" : "#F5C8A0" }}
                      onClick={() => {
                        triggerComment({
                          page: parsed.page!, label: parsed.label ?? "", value: parsed.value, sub: parsed.sub,
                          existingTitle: detail.title, existingContent: detail.content, existingCategory: detail.category,
                          inquiryId: detail.id, existingReply: detail.reply,
                        });
                        openPanel();
                        onNavigate(nav.tab, nav.sub, nav.label, true);
                      }}
                    >
                      Report 보기
                    </button>
                  );
                })()}
                <button onClick={() => setView("list")} style={backBtn}>목록으로</button>
                {canEdit && <button onClick={() => { setForm({ category: detail.category, title: detail.title, content: detail.content, corporation: detail.corporation || "", is_secret: detail.is_secret }); setView("edit"); }} style={cancelBtn}>수정</button>}
                {canEdit && <button onClick={() => handleDelete([detail.id])} style={{ ...cancelBtn, color: "#EF4444", borderColor: isDark ? "#7F1D1D" : "#FCCAC7" }}>삭제</button>}
              </div>
            </div>
            <div style={{ fontSize: 12, color: txtD, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <span>작성자: <strong style={{ color: txtS }}>{detail.author}</strong></span>
              {detail.corporation && <span>법인: <strong style={{ color: txtS }}>{detail.corporation}</strong></span>}
              <span>작성일: {detail.created_at}</span>
            </div>
          </div>
          {!canView
            ? <p style={{ color: emptyClr, textAlign: "center", padding: "40px 0" }}>비밀글입니다.</p>
            : <p style={{ fontSize: 13, color: isDark ? "#C4C9D4" : "#333", lineHeight: 1.9, whiteSpace: "pre-wrap", minHeight: 120 }}>{detail.content}</p>
          }
        </div>
        {canView && (
          <div style={{ ...cardS, marginTop: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#E87722", marginBottom: 14 }}>관리자 답변</p>
            {detail.reply
              ? <>
                  <p style={{ fontSize: 13, color: isDark ? "#C4C9D4" : "#333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{detail.reply}</p>
                  <p style={{ fontSize: 11, color: txtD, marginTop: 10, textAlign: "right" }}>답변일: {detail.reply_at}</p>
                </>
              : <p style={{ fontSize: 12, color: emptyClr }}>아직 답변이 등록되지 않았습니다.</p>
            }
            {isAdmin && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${bdr2}`, paddingTop: 16 }}>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="답변 내용을 입력하세요" rows={4} style={{ ...inp, resize: "vertical", marginBottom: 10 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={handleReply} disabled={submitting} style={{ ...submitBtn, opacity: submitting ? 0.7 : 1 }}>{submitting ? "등록 중..." : "답변 등록"}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── 스타일 상수 ───────────────────────────────────────────────
const badge: React.CSSProperties = { display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" };
const catColor = (cat: string, isDark: boolean): React.CSSProperties => {
  if (cat === "Comment")    return { background: isDark ? "rgba(232,119,34,0.15)" : "rgba(232,119,34,0.12)", color: "#E87722" };
  if (cat === "조회 오류")  return { background: isDark ? "rgba(239,68,68,0.15)" : "#FDECEA", color: "#EF4444" };
  if (cat === "데이터 오류") return { background: isDark ? "rgba(139,92,246,0.15)" : "#F3EEFF", color: "#8B5CF6" };
  return { background: isDark ? "#252830" : "#F5F5F5", color: isDark ? "#9198A8" : "#888" };
};
