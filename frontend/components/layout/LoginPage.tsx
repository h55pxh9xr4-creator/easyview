"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Spline from "@splinetool/react-spline";

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
  const [showPw, setShowPw] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const hide = () => {
      document.querySelectorAll("a").forEach(a => {
        if (a.href.includes("spline")) {
          a.style.display = "none";
        }
      });
    };
    const observer = new MutationObserver(hide);
    observer.observe(document.body, { childList: true, subtree: true });
    hide();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      if (!canvas) return;
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true, clientX: e.clientX, clientY: e.clientY,
        screenX: e.screenX, screenY: e.screenY,
      }));
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>

      {/* Spline 3D 배경 */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <Spline
          scene="https://prod.spline.design/NWKwPxi83XRPKiFM/scene.splinecode"
          onLoad={(spline: any) => {
            try { spline._renderer.pipeline.setWatermark(null); } catch {}
          }}
        />
      </div>

      {/* 로그인 카드 */}
      <div style={{
        position: "relative", zIndex: 2,
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "15vh 24px 24px",
        pointerEvents: "none",
      }}>
        <div style={{
          pointerEvents: "auto",
          opacity: cardVisible ? 1 : 0,
          transform: cardVisible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "16px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.4)",
          width: "100%",
          maxWidth: "320px",
          overflow: "hidden",
        }}>
          {/* 브랜드 헤더 */}
          <div style={{ background: "rgba(44,44,44,0.92)", padding: "20px 24px 16px", textAlign: "center" }}>
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
          <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#2C2C2C", marginBottom: "24px", letterSpacing: "-0.3px" }}>
              로그인
            </p>

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
                  width: "100%", border: "1px solid #E0E0E0", borderRadius: "6px",
                  padding: "9px 12px", fontSize: "13px", fontFamily: "inherit",
                  color: "#2C2C2C", background: "rgba(255,255,255,0.9)", outline: "none",
                  transition: "border-color .15s", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "#E87722"}
                onBlur={e => e.target.style.borderColor = "#E0E0E0"}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#999", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                비밀번호
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  required
                  style={{
                    width: "100%", border: "1px solid #E0E0E0", borderRadius: "6px",
                    padding: "9px 40px 9px 12px", fontSize: "13px", fontFamily: "inherit",
                    color: "#2C2C2C", background: "rgba(255,255,255,0.9)", outline: "none",
                    transition: "border-color .15s", boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = "#E87722"}
                  onBlur={e => e.target.style.borderColor = "#E0E0E0"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 4,
                    color: "#999", display: "flex", alignItems: "center",
                  }}
                >
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

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

        <p style={{ marginTop: "20px", fontSize: "11px", color: "rgba(255,255,255,0.7)", pointerEvents: "auto", opacity: cardVisible ? 1 : 0, transition: "opacity 0.7s ease 0.2s" }}>
          © 2026 PwC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
