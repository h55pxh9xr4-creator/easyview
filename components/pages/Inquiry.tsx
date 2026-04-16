"use client";

import { useEffect, useState } from "react";
import {
  fetchInquiries, fetchInquiry, createInquiry, replyInquiry, deleteInquiry,
  InquiryItem, InquiryDetail, INQUIRY_CATEGORIES,
} from "@/lib/api";

type View = "list" | "detail" | "write";
const ADMIN_ID = "admin";
const PAGE_SIZE = 10;

export default function Inquiry() {
  const [view,       setView]      = useState<View>("list");
  const [list,       setList]      = useState<InquiryItem[]>([]);
  const [detail,     setDetail]    = useState<InquiryDetail | null>(null);
  const [loading,    setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]     = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [form,       setForm]      = useState({ category: "기타 문의", title: "", content: "", is_secret: false });
  const [replyText,  setReplyText] = useState("");
  const [selected,   setSelected]  = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [filterCat,  setFilterCat]  = useState("");
  const [page,       setPage]       = useState(1);

  const currentUser = typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? "") : "";
  const isAdmin = currentUser === ADMIN_ID;

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadList = () => {
    setLoading(true);
    fetchInquiries().then(setList).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, []);

  const openDetail = (id: number) => {
    fetchInquiry(id).then(d => { setDetail(d); setReplyText(d.reply ?? ""); setView("detail"); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      await createInquiry({ ...form, author: currentUser });
      setForm({ category: "기타 문의", title: "", content: "", is_secret: false });
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

  // ── 필터링 + 페이지네이션 ─────────────────────────────────
  const filtered = list.filter(item => {
    const matchCat  = !filterCat  || item.category === filterCat;
    const matchText = !searchText || item.title.includes(searchText) || item.author.includes(searchText);
    return matchCat && matchText;
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#bbb" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setPage(1); }}
            placeholder="검색어를 입력해주세요..."
            style={{ border: "1px solid #E0E0E0", borderRadius: 6, padding: "7px 12px 7px 30px", fontSize: 12, fontFamily: "inherit", width: 200, outline: "none" }}
          />
        </div>
        <select
          value={filterCat}
          onChange={e => { setFilterCat(e.target.value); setPage(1); }}
          style={{ border: "1px solid #E0E0E0", borderRadius: 6, padding: "7px 28px 7px 10px", fontSize: 12, fontFamily: "inherit", color: filterCat ? "#333" : "#aaa", appearance: "none", background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E\") no-repeat right 10px center" }}
        >
          <option value="">* 카테고리를 선택해주세요.</option>
          {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => { if (selected.size > 0) handleDelete([...selected]); }}
            disabled={selected.size === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", border: "1px solid #E0E0E0", borderRadius: 6, background: "#fff", color: selected.size > 0 ? "#555" : "#bbb", fontSize: 12, fontWeight: 600, cursor: selected.size > 0 ? "pointer" : "default", fontFamily: "inherit" }}
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
            <tr style={{ borderBottom: "1px solid #E8E8E8", background: "#FAFAFA" }}>
              <th style={{ ...th, width: 40 }}>
                <input type="checkbox"
                  checked={paged.length > 0 && paged.every(i => selected.has(i.id))}
                  onChange={e => toggleAll(e.target.checked)}
                />
              </th>
              <th style={{ ...th, width: 60 }}>번호</th>
              <th style={{ ...th, width: 120 }}>구분</th>
              <th style={{ ...th }}>제목</th>
              <th style={{ ...th, width: 100 }}>작성자</th>
              <th style={{ ...th, width: 130 }}>작성일시</th>
              <th style={{ ...th, width: 90 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "52px", color: "#ccc" }}>불러오는 중...</td></tr>
            )}
            {!loading && paged.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "52px", color: "#ccc" }}>등록된 문의가 없습니다.</td></tr>
            )}
            {paged.map(item => (
              <tr
                key={item.id}
                style={{ borderBottom: "1px solid #F0F0F0", cursor: "pointer", transition: "background .1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                </td>
                <td style={{ ...td, textAlign: "center", color: "#999" }} onClick={() => openDetail(item.id)}>{item.id}</td>
                <td style={{ ...td, textAlign: "center" }} onClick={() => openDetail(item.id)}>
                  <span style={{ ...badge, ...catColor(item.category) }}>{item.category}</span>
                </td>
                <td style={{ ...td, color: "#2C2C2C", fontWeight: 500, textAlign: "left" }} onClick={() => openDetail(item.id)}>
                  {item.is_secret && !isAdmin && item.author !== currentUser
                    ? <span style={{ color: "#bbb" }}>🔒 비밀글입니다.</span>
                    : item.title}
                </td>
                <td style={{ ...td, textAlign: "center", color: "#666" }} onClick={() => openDetail(item.id)}>{item.author}</td>
                <td style={{ ...td, textAlign: "center", color: "#999", fontSize: 12 }} onClick={() => openDetail(item.id)}>{item.created_at}</td>
                <td style={{ ...td, textAlign: "center" }} onClick={() => openDetail(item.id)}>
                  <span style={{ ...badge, background: item.status === "답변완료" ? "#EBF0FD" : "#FFF5EE", color: item.status === "답변완료" ? "#2563EB" : "#E87722" }}>
                    {item.status}
                  </span>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid #EBEBEB" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2C" }}>게시글 작성</span>
          <button onClick={() => setView("list")} style={backBtn}>← 목록으로</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>카테고리</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp, width: 200, cursor: "pointer" }}>
              {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>제목</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="제목을 입력하세요" required style={inp} />
          </div>
          <div>
            <label style={lbl}>내용</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="문의 내용을 상세히 입력해주세요." required rows={9} style={{ ...inp, resize: "vertical", lineHeight: 1.7 }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666", cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_secret} onChange={e => setForm(p => ({ ...p, is_secret: e.target.checked }))} />
            비밀글로 등록
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid #F0F0F0" }}>
            <button type="button" onClick={() => setView("list")} style={cancelBtn}>취소</button>
            <button type="submit" disabled={submitting} style={{ ...submitBtn, opacity: submitting ? 0.7 : 1 }}>{submitting ? "등록 중..." : "등록"}</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── 상세 ──────────────────────────────────────────────────
  if (view === "detail" && detail) {
    const canView = isAdmin || detail.author === currentUser || !detail.is_secret;
    return (
      <div className="wrap">
        <Toast />
        <div className="card">
          <div style={{ borderBottom: "1px solid #EBEBEB", paddingBottom: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#2C2C2C", flex: 1, lineHeight: 1.4 }}>
                {detail.is_secret && <span style={{ fontSize: 13, marginRight: 5 }}>🔒</span>}
                {detail.title}
              </span>
              <span style={{ ...badge, ...catColor(detail.category), flexShrink: 0 }}>{detail.category}</span>
              <span style={{ ...badge, flexShrink: 0, background: detail.status === "답변완료" ? "#EBF0FD" : "#FFF5EE", color: detail.status === "답변완료" ? "#2563EB" : "#E87722" }}>{detail.status}</span>
            </div>
            <div style={{ fontSize: 12, color: "#aaa", display: "flex", gap: 20 }}>
              <span>작성자: <strong style={{ color: "#666" }}>{detail.author}</strong></span>
              <span>작성일: {detail.created_at}</span>
            </div>
          </div>
          {!canView
            ? <p style={{ color: "#ccc", textAlign: "center", padding: "40px 0" }}>비밀글입니다.</p>
            : <p style={{ fontSize: 13, color: "#333", lineHeight: 1.9, whiteSpace: "pre-wrap", minHeight: 120 }}>{detail.content}</p>
          }
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 14, borderTop: "1px solid #F0F0F0" }}>
            <button onClick={() => setView("list")} style={backBtn}>← 목록으로</button>
            {(isAdmin || detail.author === currentUser) && (
              <button onClick={() => handleDelete([detail.id])} style={{ ...cancelBtn, color: "#EF4444", borderColor: "#FCCAC7" }}>삭제</button>
            )}
          </div>
        </div>
        {canView && (
          <div style={{ ...cardS, marginTop: 12, borderLeft: "3px solid #E87722" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#E87722", marginBottom: 14 }}>관리자 답변</p>
            {detail.reply
              ? <>
                  <p style={{ fontSize: 13, color: "#333", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{detail.reply}</p>
                  <p style={{ fontSize: 11, color: "#bbb", marginTop: 10, textAlign: "right" }}>답변일: {detail.reply_at}</p>
                </>
              : <p style={{ fontSize: 12, color: "#ccc" }}>아직 답변이 등록되지 않았습니다.</p>
            }
            {isAdmin && (
              <div style={{ marginTop: 16, borderTop: "1px solid #F0F0F0", paddingTop: 16 }}>
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
const catColor = (cat: string): React.CSSProperties => {
  if (cat === "조회 오류")  return { background: "#FDECEA", color: "#EF4444" };
  if (cat === "데이터 오류") return { background: "#EBF0FD", color: "#2563EB" };
  return { background: "#F5F5F5", color: "#888" };
};
const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, color: "#555", textAlign: "center" as const, whiteSpace: "nowrap", background: "#FAFAFA" };
const td: React.CSSProperties = { padding: "11px 12px", whiteSpace: "nowrap" };
const cardS: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" };
const inp: React.CSSProperties = { width: "100%", border: "1px solid #E0E0E0", borderRadius: 6, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", color: "#2C2C2C", outline: "none", boxSizing: "border-box" };
const backBtn: React.CSSProperties = { padding: "5px 14px", border: "1px solid #E0E0E0", borderRadius: 6, background: "#fff", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const cancelBtn: React.CSSProperties = { padding: "7px 18px", background: "#fff", color: "#888", border: "1px solid #E0E0E0", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const submitBtn: React.CSSProperties = { padding: "7px 22px", background: "#E87722", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const pgBtn = (active: boolean): React.CSSProperties => ({
  width: 32, height: 32, border: active ? "none" : "1px solid #E8E8E8", borderRadius: 6,
  background: active ? "#E87722" : "#fff", color: active ? "#fff" : "#555",
  fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center",
});
