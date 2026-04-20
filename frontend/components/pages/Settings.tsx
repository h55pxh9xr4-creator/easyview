"use client";

import { useState, useRef, useEffect } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";

type Tab = "profile" | "theme";

export function applyTheme(t: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("ev_theme", t);
}

export default function Settings() {
  const isDark = useDarkMode();

  const [tab, setTab]           = useState<Tab>("profile");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar]     = useState<string | null>(null);
  const [theme, setTheme]       = useState<"light" | "dark">("light");
  const [saved, setSaved]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 다크모드 색상 ──────────────────────────────────────────
  const bg2    = isDark ? "#1C1F26" : "#fff";
  const bdr    = isDark ? "#2E3039" : "#EDEDED";
  const bdr2   = isDark ? "#2E3039" : "#F0F0F0";
  const txtP   = isDark ? "#E2E5EC" : "#2C2C2C";
  const txtS   = isDark ? "#9198A8" : "#666";
  const txtD   = isDark ? "#5A6070" : "#aaa";
  const inputBg = isDark ? "#252830" : "#fff";
  const avatarBg = isDark ? "#252830" : "#F5F5F5";
  const tabActiveBg = isDark ? "#2A1F14" : "#FFF5EE";

  useEffect(() => {
    setNickname(localStorage.getItem("ev_nickname") || sessionStorage.getItem("ev_user") || "");
    setAvatar(localStorage.getItem("ev_avatar") || null);
    setTheme((localStorage.getItem("ev_theme") as "light" | "dark") || "light");
  }, []);

  const saveProfile = () => {
    localStorage.setItem("ev_nickname", nickname);
    if (avatar) localStorage.setItem("ev_avatar", avatar);
    else localStorage.removeItem("ev_avatar");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleTheme = (t: "light" | "dark") => {
    setTheme(t);
    applyTheme(t);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "profile", label: "정보변경",  icon: "👤" },
    { key: "theme",   label: "테마변경",  icon: "🎨" },
  ];

  return (
    <div style={{ padding: "32px 28px", maxWidth: 820, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: txtP, marginBottom: 24, letterSpacing: "-0.3px" }}>
        설정
      </h2>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* ── 사이드 탭 ── */}
        <div style={{
          width: 160, flexShrink: 0,
          background: bg2,
          border: `1px solid ${bdr}`,
          borderRadius: 10, padding: 8, gap: 2, display: "flex", flexDirection: "column",
        }}>
          {TABS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", textAlign: "left",
              padding: "10px 14px", border: "none", borderRadius: 7,
              background: tab === key ? tabActiveBg : "transparent",
              color: tab === key ? "#E87722" : txtS,
              fontWeight: tab === key ? 700 : 400, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
            }}>
              <span style={{ fontSize: 15 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── 콘텐츠 영역 ── */}
        <div style={{
          flex: 1,
          background: bg2,
          border: `1px solid ${bdr}`,
          borderRadius: 12, padding: 28,
        }}>

          {/* ──────── 정보변경 탭 ──────── */}
          {tab === "profile" && (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: txtP, marginBottom: 24 }}>정보변경</p>

              {/* 프로필 사진 */}
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${bdr2}` }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: avatarBg, border: `2px solid ${bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", flexShrink: 0, position: "relative",
                }}>
                  {avatar
                    ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3A3F4A" : "#ccc"} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                </div>
                <div>
                  <button onClick={() => fileRef.current?.click()} style={{
                    padding: "7px 16px", border: `1px solid ${bdr}`, borderRadius: 6,
                    background: bg2, color: txtP,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    display: "block", marginBottom: 6,
                  }}>
                    사진 변경
                  </button>
                  {avatar && (
                    <button onClick={() => setAvatar(null)} style={{
                      padding: "5px 12px", border: `1px solid ${isDark ? "#7F1D1D" : "#FCCAC7"}`, borderRadius: 6,
                      background: isDark ? "rgba(239,68,68,0.1)" : "#FFF5F5", color: "#EF4444",
                      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      display: "block", marginBottom: 6,
                    }}>
                      사진 삭제
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: txtD }}>JPG, PNG · 최대 2MB</p>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
                </div>
              </div>

              {/* 닉네임 */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: txtD, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  닉네임
                </label>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  style={{
                    width: "100%", border: `1px solid ${bdr}`, borderRadius: 6,
                    padding: "9px 12px", fontSize: 13, fontFamily: "inherit",
                    color: txtP, outline: "none",
                    boxSizing: "border-box", background: inputBg,
                  }}
                  onFocus={e => e.target.style.borderColor = "#E87722"}
                  onBlur={e => e.target.style.borderColor = bdr}
                />
                <p style={{ fontSize: 11, color: txtD, marginTop: 5 }}>헤더에 표시되는 이름입니다.</p>
              </div>

              <button onClick={saveProfile} style={{
                padding: "9px 28px", border: "none", borderRadius: 6,
                background: saved ? "#3CB371" : "#E87722",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", transition: "background .2s",
              }}>
                {saved ? "저장 완료 ✓" : "저장"}
              </button>
            </>
          )}

          {/* ──────── 테마변경 탭 ──────── */}
          {tab === "theme" && (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: txtP, marginBottom: 8 }}>테마변경</p>
              <p style={{ fontSize: 12, color: txtD, marginBottom: 24 }}>선택한 테마는 즉시 적용됩니다.</p>

              <div style={{ display: "flex", gap: 16 }}>
                {/* 밝은 테마 */}
                <button onClick={() => handleTheme("light")} style={{
                  flex: 1, border: `2px solid ${theme === "light" ? "#E87722" : bdr}`,
                  borderRadius: 12, padding: 20, cursor: "pointer", background: "#F8F8F8",
                  textAlign: "left", fontFamily: "inherit", transition: "border-color .15s",
                }}>
                  <div style={{ background: "#fff", borderRadius: 8, padding: 12, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                    <div style={{ background: "#F0F0F0", borderRadius: 4, height: 8, marginBottom: 6, width: "60%" }}/>
                    <div style={{ background: "#F0F0F0", borderRadius: 4, height: 5, marginBottom: 4, width: "85%" }}/>
                    <div style={{ background: "#F0F0F0", borderRadius: 4, height: 5, width: "50%" }}/>
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      <div style={{ background: "#E87722", borderRadius: 3, height: 5, width: "25%" }}/>
                      <div style={{ background: "#F0F0F0", borderRadius: 3, height: 5, width: "35%" }}/>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {theme === "light" && <CheckIcon />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2C" }}>☀️ 밝은 테마</span>
                  </div>
                </button>

                {/* 어두운 테마 */}
                <button onClick={() => handleTheme("dark")} style={{
                  flex: 1, border: `2px solid ${theme === "dark" ? "#E87722" : (isDark ? "#3A3F4A" : "#444")}`,
                  borderRadius: 12, padding: 20, cursor: "pointer", background: "#1A1A2E",
                  textAlign: "left", fontFamily: "inherit", transition: "border-color .15s",
                }}>
                  <div style={{ background: "#16213E", borderRadius: 8, padding: 12, marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.3)" }}>
                    <div style={{ background: "#0F3460", borderRadius: 4, height: 8, marginBottom: 6, width: "60%", opacity: 0.8 }}/>
                    <div style={{ background: "#0F3460", borderRadius: 4, height: 5, marginBottom: 4, width: "85%", opacity: 0.5 }}/>
                    <div style={{ background: "#0F3460", borderRadius: 4, height: 5, width: "50%", opacity: 0.5 }}/>
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      <div style={{ background: "#E87722", borderRadius: 3, height: 5, width: "25%", opacity: 0.9 }}/>
                      <div style={{ background: "#0F3460", borderRadius: 3, height: 5, width: "35%", opacity: 0.4 }}/>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {theme === "dark" && <CheckIcon />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#ccc" }}>🌙 어두운 테마</span>
                  </div>
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#E87722", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
        <polyline points="1,4 5,8 11,1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}
