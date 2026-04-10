"use client";

import { useEffect, useState } from "react";
import {
  fetchInquiries, fetchInquiry, createInquiry, replyInquiry, deleteInquiry,
  InquiryItem, InquiryDetail, INQUIRY_CATEGORIES,
} from "@/lib/api";

type View = "list" | "detail" | "write";
const ADMIN_ID = "admin";

export default function Inquiry() {
  const [view,       setView]      = useState<View>("list");
  const [list,       setList]      = useState<InquiryItem[]>([]);
  const [detail,     setDetail]    = useState<InquiryDetail | null>(null);
  const [loading,    setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]     = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [form,       setForm]      = useState({ category: "기타 문의", title: "", content: "", is_secret: false });
  const [replyText,  setReplyText] = useState("");

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
      setForm({ title: "", content: "", is_secret: false });
      loadList();
      setView("list");
      showToast("문의가 등록되었습니다.");
    } catch {
      showToast("등록 중 오류가 발생했습니다.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await replyInquiry(detail.id, replyText);
      openDetail(detail.id);
      showToast("답변이 등록되었습니다.");
    } catch {
      showToast("답변 등록 중 오류가 발생했습니다.", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await deleteInquiry(id);
      setView("list");
      loadList();
      showToast("삭제되었습니다.");
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "err");
    }
  };

  // ── 공통 헤더/레이아웃 ────────────────────────────────────────
  const wrap = (content: React.ReactNode) => (
    <div style={{ padding: "36px 24px 60px", background: "#F5F5F5", minHeight: "calc(100vh - 140px)" }}>
      {/* 토스트 */}
      {toast && (
        <div style={{
          position: "fixed", top: "72px", left: "50%", transform: "translateX(-50%)",
          background: toast.type === "ok" ? "#2C2C2C" : "#EF4444",
          color: "#fff", padding: "10px 24px", borderRadius: "8px",
          fontSize: "13px", fontWeight: 600, zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,.18)",
        }}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}
      {/* 타이틀 */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: 800, color: "#2C2C2C", letterSpacing: "-0.5px" }}>Q&amp;A</h2>
        <div style={{ width: "36px", height: "3px", background: "#E87722", margin: "10px auto 0", borderRadius: "2px" }} />
      </div>
      {/* 콘텐츠 */}
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        {content}
      </div>
    </div>
  );

  // ── 목록 ─────────────────────────────────────────────────
  if (view === "list") return wrap(
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
        <button onClick={() => setView("write")} style={submitBtnStyle}>글쓰기</button>
      </div>
      <div style={{ background: "#fff", borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#FFF5EE", borderBottom: "2px solid #E87722" }}>
              <th style={{ ...th, width: 60, textAlign: "center" }}>No</th>
              <th style={{ ...th, width: 110 }}>카테고리</th>
              <th style={{ ...th }}>제목</th>
              <th style={{ ...th, width: 110 }}>글쓴이</th>
              <th style={{ ...th, width: 150 }}>작성시간</th>
              <th style={{ ...th, width: 90 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "#bbb" }}>불러오는 중...</td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "52px", color: "#ccc", fontSize: "13px" }}>등록된 문의가 없습니다.</td>
              </tr>
            )}
            {list.map((item, i) => (
              <tr
                key={item.id}
                onClick={() => openDetail(item.id)}
                style={{ borderBottom: "1px solid #F5F5F5", cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#FAFAFA", transition: "background .12s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#FFF5EE")}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
              >
                <td style={{ ...td, textAlign: "center", color: "#bbb" }}>{item.id}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{ ...categoryBadge, ...categoryColor(item.category) }}>{item.category}</span>
                </td>
                <td style={{ ...td, textAlign: "left", fontWeight: 600, color: "#2C2C2C" }}>
                  {item.is_secret
                    ? <span style={{ color: "#bbb", fontWeight: 400 }}>
                        <span style={{ marginRight: "5px", fontSize: "11px" }}>🔒</span>
                        {isAdmin || item.author === currentUser ? item.title : "비밀글입니다."}
                      </span>
                    : item.title}
                </td>
                <td style={{ ...td, textAlign: "center", color: "#666" }}>{item.author}</td>
                <td style={{ ...td, textAlign: "center", color: "#999", fontSize: "12px" }}>{item.created_at}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                    background: item.status === "답변완료" ? "#EBF0FD" : "#FFF5EE",
                    color:      item.status === "답변완료" ? "#2563EB" : "#E87722",
                  }}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  // ── 글쓰기 ───────────────────────────────────────────────
  if (view === "write") return wrap(
    <div style={cardStyle}>
      <div style={{ borderBottom: "2px solid #E87722", paddingBottom: "14px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#2C2C2C" }}>문의 작성</span>
        <button onClick={() => setView("list")} style={backBtnStyle}>← 목록으로</button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={labelStyle}>카테고리</label>
          <select
            value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={{ ...inputStyle, width: "200px", cursor: "pointer" }}
          >
            {INQUIRY_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>제목</label>
          <input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="제목을 입력하세요" required style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>내용</label>
          <textarea
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            placeholder="문의 내용을 상세히 입력해주세요." required rows={9}
            style={{ ...inputStyle, resize: "vertical", lineHeight: "1.7" }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#666", cursor: "pointer" }}>
          <input type="checkbox" checked={form.is_secret} onChange={e => setForm(p => ({ ...p, is_secret: e.target.checked }))} />
          비밀글로 등록
        </label>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", paddingTop: "8px", borderTop: "1px solid #F0F0F0" }}>
          <button type="button" onClick={() => setView("list")} style={cancelBtnStyle}>취소</button>
          <button type="submit" disabled={submitting} style={{ ...submitBtnStyle, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );

  // ── 상세 ─────────────────────────────────────────────────
  if (view === "detail" && detail) {
    const canView = isAdmin || detail.author === currentUser || !detail.is_secret;
    return wrap(
      <>
        <div style={cardStyle}>
          <div style={{ borderBottom: "2px solid #E87722", paddingBottom: "14px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#2C2C2C", flex: 1, lineHeight: 1.4 }}>
                {detail.is_secret && <span style={{ fontSize: "13px", marginRight: "5px" }}>🔒</span>}
                {detail.title}
              </span>
              <span style={{ ...categoryBadge, ...categoryColor(detail.category), flexShrink: 0 }}>
                {detail.category}
              </span>
              <span style={{
                flexShrink: 0, padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                background: detail.status === "답변완료" ? "#EBF0FD" : "#FFF5EE",
                color:      detail.status === "답변완료" ? "#2563EB" : "#E87722",
              }}>
                {detail.status}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#aaa", display: "flex", gap: "20px" }}>
              <span>작성자: <strong style={{ color: "#666" }}>{detail.author}</strong></span>
              <span>작성일: {detail.created_at}</span>
            </div>
          </div>

          {!canView
            ? <p style={{ color: "#ccc", textAlign: "center", padding: "40px 0", fontSize: "13px" }}>비밀글입니다.</p>
            : <p style={{ fontSize: "13px", color: "#333", lineHeight: "1.9", whiteSpace: "pre-wrap", minHeight: "120px" }}>{detail.content}</p>
          }

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", paddingTop: "14px", borderTop: "1px solid #F0F0F0" }}>
            <button onClick={() => setView("list")} style={backBtnStyle}>← 목록으로</button>
            {(isAdmin || detail.author === currentUser) && (
              <button onClick={() => handleDelete(detail.id)} style={{ ...cancelBtnStyle, color: "#EF4444", borderColor: "#FCCAC7" }}>삭제</button>
            )}
          </div>
        </div>

        {canView && (
          <div style={{ ...cardStyle, marginTop: "12px", borderLeft: "4px solid #E87722" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#E87722", marginBottom: "14px" }}>관리자 답변</p>
            {detail.reply
              ? <>
                  <p style={{ fontSize: "13px", color: "#333", lineHeight: "1.9", whiteSpace: "pre-wrap" }}>{detail.reply}</p>
                  <p style={{ fontSize: "11px", color: "#bbb", marginTop: "10px", textAlign: "right" }}>답변일: {detail.reply_at}</p>
                </>
              : <p style={{ fontSize: "12px", color: "#ccc" }}>아직 답변이 등록되지 않았습니다.</p>
            }
            {isAdmin && (
              <div style={{ marginTop: "16px", borderTop: "1px solid #F0F0F0", paddingTop: "16px" }}>
                <textarea
                  value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="답변 내용을 입력하세요" rows={4}
                  style={{ ...inputStyle, resize: "vertical", marginBottom: "10px" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={handleReply} disabled={submitting} style={{ ...submitBtnStyle, opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? "등록 중..." : "답변 등록"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return null;
}

// ── 공통 스타일 ──────────────────────────────────────────────
const categoryBadge: React.CSSProperties = {
  display: "inline-block", padding: "2px 10px", borderRadius: "20px",
  fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
};
const categoryColor = (cat: string): React.CSSProperties => {
  if (cat === "조회 오류")  return { background: "#FDECEA", color: "#EF4444" };
  if (cat === "데이터 오류") return { background: "#EBF0FD", color: "#2563EB" };
  return { background: "#F5F5F5", color: "#888" }; // 기타 문의
};

const th: React.CSSProperties = {
  padding: "10px 14px", fontWeight: 700, fontSize: "12px",
  color: "#E87722", whiteSpace: "nowrap", letterSpacing: "0.2px",
  textAlign: "center",
};
const td: React.CSSProperties = {
  padding: "11px 14px", whiteSpace: "nowrap",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: "10px", padding: "24px 28px",
  boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, color: "#999",
  marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid #E0E0E0", borderRadius: "6px",
  padding: "8px 12px", fontSize: "13px", fontFamily: "inherit",
  color: "#2C2C2C", outline: "none", boxSizing: "border-box",
};
const backBtnStyle: React.CSSProperties = {
  padding: "5px 14px", border: "1px solid #E0E0E0", borderRadius: "6px",
  background: "#fff", color: "#888", fontSize: "12px", fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
const cancelBtnStyle: React.CSSProperties = {
  padding: "7px 18px", background: "#fff", color: "#888",
  border: "1px solid #E0E0E0", borderRadius: "6px", fontSize: "12px",
  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const submitBtnStyle: React.CSSProperties = {
  padding: "7px 22px", background: "#E87722", color: "#fff",
  border: "none", borderRadius: "6px", fontSize: "12px",
  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
