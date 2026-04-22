"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  onLogin: () => void;
}

const CREDENTIALS: Record<string, string> = {
  admin: "easyview123",
};

export default function LoginPage({ onLogin }: Props) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [lampOn, setLampOn] = useState(false);

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

  const dark = lampOn;

  const bg        = dark ? "#111318" : "#F5F5F5";
  const cardBg    = dark ? "#1c2030" : "#fff";
  const headerBg  = dark ? "#0d1117" : "#2C2C2C";
  const inputBg   = dark ? "#141720" : "#fff";
  const inputBdr  = dark ? "#2a2f3d" : "#E0E0E0";
  const labelClr  = dark ? "#6b7280" : "#999";
  const textClr   = dark ? "#e2e8f0" : "#2C2C2C";
  const subClr    = dark ? "#4b5563" : "#bbb";

  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      transition: "background 0.6s ease",
      position: "relative",
    }}>
      {/* 램프 */}
      <div
        onClick={() => setLampOn(p => !p)}
        title={lampOn ? "램프 끄기" : "램프 켜기"}
        style={{ cursor: "pointer", marginBottom: 24, userSelect: "none" }}
      >
        <svg width="72" height="110" viewBox="0 0 72 110" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ filter: lampOn ? "drop-shadow(0 0 18px rgba(255,210,80,0.85)) drop-shadow(0 0 40px rgba(255,180,40,0.4))" : "none", transition: "filter 0.5s ease" }}>
          {/* 전구 빛 번짐 */}
          {lampOn && (
            <ellipse cx="36" cy="38" rx="28" ry="20" fill="rgba(255,220,80,0.13)" />
          )}
          {/* 갓 (dome shade) */}
          <path
            d="M6 46 Q12 10 36 8 Q60 10 66 46 Z"
            fill={lampOn ? "#f0c040" : "#555"}
            style={{ transition: "fill 0.5s ease" }}
          />
          {/* 갓 테두리 */}
          <path
            d="M4 46 Q10 9 36 7 Q62 9 68 46"
            stroke={lampOn ? "#c8900a" : "#333"}
            strokeWidth="2.5"
            fill="none"
            style={{ transition: "stroke 0.5s ease" }}
          />
          {/* 갓 안쪽 빛 */}
          {lampOn && (
            <path d="M12 44 Q18 18 36 14 Q54 18 60 44 Z" fill="rgba(255,240,160,0.25)" />
          )}
          {/* 전구 */}
          <ellipse
            cx="36" cy="46" rx="7" ry="6"
            fill={lampOn ? "#fff9c4" : "#333"}
            style={{ transition: "fill 0.5s ease" }}
          />
          {/* 기둥 */}
          <rect x="33.5" y="52" width="5" height="38" rx="2"
            fill={dark ? "#374151" : "#888"}
            style={{ transition: "fill 0.5s ease" }}
          />
          {/* 받침대 */}
          <ellipse cx="36" cy="92" rx="18" ry="5"
            fill={dark ? "#1f2937" : "#666"}
            style={{ transition: "fill 0.5s ease" }}
          />
          <ellipse cx="36" cy="97" rx="14" ry="4"
            fill={dark ? "#111827" : "#444"}
            style={{ transition: "fill 0.5s ease" }}
          />
          {/* 스위치 줄 */}
          <line x1="36" y1="46" x2="36" y2="64" stroke={dark ? "#6b7280" : "#bbb"} strokeWidth="1.2" />
          <circle cx="36" cy="65" r="3"
            fill={lampOn ? "#fbbf24" : (dark ? "#374151" : "#ccc")}
            style={{ transition: "fill 0.5s ease" }}
          />
        </svg>
      </div>

      {/* 로그인 카드 */}
      <div style={{
        background: cardBg,
        borderRadius: "12px",
        boxShadow: dark
          ? "0 0 0 1px rgba(255,255,255,.06), 0 8px 40px rgba(0,0,0,.6)"
          : "0 2px 16px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.05)",
        width: "100%",
        maxWidth: "400px",
        overflow: "hidden",
        transition: "background 0.6s ease, box-shadow 0.6s ease",
      }}>
        {/* 브랜드 헤더 */}
        <div style={{
          background: headerBg,
          padding: "28px 32px 24px",
          textAlign: "center",
          transition: "background 0.6s ease",
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

        {/* 오렌지 라인 */}
        <div style={{ height: "3px", background: "#E87722" }} />

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} style={{ padding: "32px" }}>
          <p style={{ fontSize: "16px", fontWeight: 700, color: textClr, marginBottom: "24px", letterSpacing: "-0.3px", transition: "color 0.5s" }}>
            로그인
          </p>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: labelClr, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px", transition: "color 0.5s" }}>
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
                width: "100%", border: `1px solid ${inputBdr}`, borderRadius: "6px",
                padding: "9px 12px", fontSize: "13px", fontFamily: "inherit",
                color: textClr, background: inputBg, outline: "none",
                transition: "border-color .15s, background 0.5s, color 0.5s",
                boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#E87722"}
              onBlur={e => e.target.style.borderColor = inputBdr}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: labelClr, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px", transition: "color 0.5s" }}>
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
                width: "100%", border: `1px solid ${inputBdr}`, borderRadius: "6px",
                padding: "9px 12px", fontSize: "13px", fontFamily: "inherit",
                color: textClr, background: inputBg, outline: "none",
                transition: "border-color .15s, background 0.5s, color 0.5s",
                boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "#E87722"}
              onBlur={e => e.target.style.borderColor = inputBdr}
            />
          </div>

          <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              id="auto-login"
              type="checkbox"
              checked={autoLogin}
              onChange={e => setAutoLogin(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: "#E87722", cursor: "pointer" }}
            />
            <label htmlFor="auto-login" style={{ fontSize: "12px", color: labelClr, cursor: "pointer", userSelect: "none", transition: "color 0.5s" }}>
              자동 로그인
            </label>
          </div>

          {error && (
            <div style={{
              background: "#FDECEA", border: "1px solid #FCCAC7", borderRadius: "6px",
              padding: "8px 12px", fontSize: "12px", color: "#EF4444",
              marginBottom: "16px", fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "10px",
              background: loading ? "#F0A060" : "#E87722",
              color: "#fff", border: "none", borderRadius: "6px",
              fontSize: "14px", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "background .15s",
              letterSpacing: "-0.2px",
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.background = "#D06010"; }}
            onMouseLeave={e => { if (!loading) (e.target as HTMLElement).style.background = "#E87722"; }}
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>

      <p style={{ marginTop: "20px", fontSize: "11px", color: subClr, transition: "color 0.5s" }}>
        © 2026 PwC. All rights reserved.
      </p>
    </div>
  );
}
