"use client";

import { useState } from "react";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems } from "@/hooks/useCommentedItems";
import { createInquiry, replyInquiry, INQUIRY_CATEGORIES } from "@/lib/api";

export default function CommentPanel() {
  const { target, closeAll } = useComment();
  const refreshCommentedItems = useCommentedItems(state => state.refresh);

  const currentUser = typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? "") : "";
  const isAdmin = currentUser === "admin";

  // ── 원문 보기 모드 (inquiryId 있을 때) ─────────────────────
  const isViewMode = !!target?.inquiryId;

  const defaultTitle = target?.existingTitle
    ?? (target ? `[${target.page}] ${target.label}${target.value ? ` (${target.value})` : ""} 관련 문의` : "");
  const defaultContent = target?.existingContent
    ?? (target ? `페이지: ${target.page}\n항목: ${target.label}${target.sub ? `\n${target.sub}` : ""}${target.value ? `\n값: ${target.value}` : ""}\n\n문의 내용:\n` : "");

  const [form, setForm] = useState({
    category: target?.existingCategory ?? "Comment",
    title: defaultTitle,
    content: defaultContent,
    is_secret: false,
  });
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [replyDone, setReplyDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      await createInquiry({ ...form, author: currentUser });
      refreshCommentedItems();
      setDone(true);
    } catch {
      alert("등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!target?.inquiryId || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await replyInquiry(target.inquiryId, replyText);
      setReplyDone(true);
    } catch {
      alert("답변 등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="comment-panel">
      {/* 헤더 */}
      <div className="cp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E87722" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span className="cp-title">{isViewMode ? "문의 원문" : "문의 작성"}</span>
        </div>
        <button className="cp-close" onClick={closeAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* 연결된 항목 */}
      {target && (
        <div className="cp-context">
          <span className="cp-context-label">연결 항목</span>
          <span className="cp-context-page">{target.page}</span>
          <span className="cp-context-sep">›</span>
          <span className="cp-context-item">{target.label}</span>
          {target.value && <span className="cp-context-val">{target.value}</span>}
        </div>
      )}

      {/* ── 원문 보기 모드 ─────────────────────────────────── */}
      {isViewMode ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* 원문 내용 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2C", marginBottom: 8 }}>{target?.existingTitle}</p>
            <p style={{ fontSize: 12, color: "#555", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{target?.existingContent}</p>
          </div>

          {/* 구분선 */}
          <div style={{ borderTop: "1px solid #EBEBEB", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#E87722", margin: 0 }}>관리자 답변</p>

            {replyDone ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 0" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                <p style={{ fontSize: 12, color: "#666", margin: 0 }}>답변이 등록되었습니다.</p>
              </div>
            ) : (
              <>
                {/* 기존 답변 */}
                {(target?.existingReply) ? (
                  <p style={{ fontSize: 12, color: "#333", lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>
                    {target.existingReply}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: "#bbb", margin: 0 }}>아직 답변이 등록되지 않았습니다.</p>
                )}

                {/* 관리자 답변 입력 */}
                {isAdmin && (
                  <>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="답변 내용을 입력하세요"
                      rows={4}
                      style={{
                        width: "100%", border: "1px solid #E0E0E0", borderRadius: 6,
                        padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                        color: "#2C2C2C", outline: "none", resize: "vertical",
                        boxSizing: "border-box", lineHeight: 1.7,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={handleReply}
                        disabled={submitting || !replyText.trim()}
                        style={{
                          padding: "7px 18px", background: "#E87722", color: "#fff",
                          border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700,
                          cursor: submitting || !replyText.trim() ? "default" : "pointer",
                          opacity: submitting || !replyText.trim() ? 0.6 : 1,
                          fontFamily: "inherit",
                        }}
                      >
                        {submitting ? "등록 중..." : "답변 등록"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ) : done ? (
        /* ── 등록 완료 ──────────────────────────────────────── */
        <div className="cp-done">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          <p>문의가 등록되었습니다.</p>
          <button className="cp-done-btn" onClick={closeAll}>닫기</button>
        </div>
      ) : (
        /* ── 문의 작성 모드 ──────────────────────────────────── */
        <form onSubmit={handleSubmit} className="cp-form">
          {/* 카테고리 */}
          <div className="cp-field">
            <label className="cp-label">카테고리</label>
            <select
              className="cp-input"
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            >
              {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 제목 */}
          <div className="cp-field">
            <label className="cp-label">제목</label>
            <input
              className="cp-input"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="제목을 입력하세요"
              required
            />
          </div>

          {/* 내용 */}
          <div className="cp-field" style={{ flex: 1 }}>
            <label className="cp-label">내용</label>
            <textarea
              className="cp-input cp-textarea"
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="문의 내용을 입력하세요"
              required
            />
          </div>

          {/* 비밀글 */}
          <label className="cp-secret">
            <input
              type="checkbox"
              checked={form.is_secret}
              onChange={e => setForm(p => ({ ...p, is_secret: e.target.checked }))}
            />
            비밀글로 등록
          </label>

          {/* 버튼 */}
          <div className="cp-actions">
            <button type="button" className="cp-btn-cancel" onClick={closeAll}>취소</button>
            <button type="submit" className="cp-btn-submit" disabled={submitting}>
              {submitting ? "등록 중..." : "문의 등록"}
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}
