"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  onLogin: () => void;
}

// 간단한 클라이언트 사이드 인증 (아이디/비번 변경 시 여기서 수정)
const CREDENTIALS: Record<string, string> = {
  admin: "easyview123",
};

export default function LoginPage({ onLogin }: Props) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (CREDENTIALS[id] && CREDENTIALS[id] === pw) {
        sessionStorage.setItem("ev_auth", "1");
        sessionStorage.setItem("ev_user", id);
        if (autoLogin) {
          localStorage.setItem("ev_auto_auth", "1");
          localStorage.setItem("ev_auto_user", id);
        } else {
          localStorage.removeItem("ev_auto_auth");
          localStorage.removeItem("ev_auto_user");
        }
        onLogin();
      } else {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F5F5F5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 16px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.05)",
        width: "100%",
        maxWidth: "400px",
        overflow: "hidden",
      }}>
        {/* 상단 브랜드 헤더 */}
        <div style={{
          background: "#2C2C2C",
          padding: "28px 32px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "6px" }}>
            <Image src="/easyview/logo.png" alt="logo" width={28} height={28} style={{ height: "28px", width: "auto" }} />
            <span style={{ fontSize: "22px", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              Easy <span style={{ color: "#E87722" }}>View</span>
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#888", marginTop: "4px", letterSpacing: "0.3px" }}>
            PwC Financial Analytics Platform
          </p>
        </div>

        {/* 오렌지 accent 라인 */}
        <div style={{ height: "3px", background: "#E87722" }} />

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} style={{ padding: "32px" }}>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#2C2C2C", marginBottom: "24px", letterSpacing: "-0.3px" }}>
            로그인
          </p>

          {/* 아이디 */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              아이디
            </label>
            <input
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              required
              style={{
                width: "100%",
                border: "1px solid #E0E0E0",
                borderRadius: "6px",
                padding: "9px 12px",
                fontSize: "13px",
                fontFamily: "inherit",
                color: "#2C2C2C",
                outline: "none",
                transition: "border-color .15s",
                boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#E87722"}
              onBlur={e => e.target.style.borderColor = "#E0E0E0"}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              비밀번호
            </label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                border: "1px solid #E0E0E0",
                borderRadius: "6px",
                padding: "9px 12px",
                fontSize: "13px",
                fontFamily: "inherit",
                color: "#2C2C2C",
                outline: "none",
                transition: "border-color .15s",
                boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#E87722"}
              onBlur={e => e.target.style.borderColor = "#E0E0E0"}
            />
          </div>

          {/* 자동 로그인 */}
          <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              id="auto-login"
              type="checkbox"
              checked={autoLogin}
              onChange={e => setAutoLogin(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: "#E87722", cursor: "pointer" }}
            />
            <label htmlFor="auto-login" style={{ fontSize: "12px", color: "#666", cursor: "pointer", userSelect: "none" }}>
              자동 로그인
            </label>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{
              background: "#FDECEA",
              border: "1px solid #FCCAC7",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "12px",
              color: "#EF4444",
              marginBottom: "16px",
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              background: loading ? "#F0A060" : "#E87722",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background .15s",
              letterSpacing: "-0.2px",
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.background = "#D06010"; }}
            onMouseLeave={e => { if (!loading) (e.target as HTMLElement).style.background = "#E87722"; }}
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>

      {/* 하단 카피 */}
      <p style={{ marginTop: "20px", fontSize: "11px", color: "#bbb" }}>
        © 2026 PwC. All rights reserved.
      </p>
    </div>
  );
}
