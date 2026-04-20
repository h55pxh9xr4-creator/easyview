"use client";

import { useEffect, useRef, useState } from "react";

export type TopTab = "서비스 소개" | "리포트" | "자료실";
const TOP_TABS: TopTab[] = ["서비스 소개", "리포트", "자료실"];

interface Props {
  user?: string;
  activeTopTab?: TopTab;
  onTopTabChange?: (tab: TopTab) => void;
  onLogout?: () => void;
  onSettings?: () => void;
}

export default function Header({ user, activeTopTab = "리포트", onTopTabChange, onLogout, onSettings }: Props) {
  const [displayName, setDisplayName] = useState(user ?? "");
  const [avatar, setAvatar]           = useState<string | null>(null);
  const [dropOpen, setDropOpen]       = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayName(localStorage.getItem("ev_nickname") || user || "");
    setAvatar(localStorage.getItem("ev_avatar") || null);
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="hdr">
      {/* 로고 + 포털명 */}
      <div className="hdr-brand">
        <img src="/easyview/logo2.png" alt="PwC" className="logo-img" />
        <span className="hdr-portal-name">Easyview</span>
      </div>

      {/* 상단 탭 */}
      <nav className="hdr-tabs">
        {TOP_TABS.map(t => (
          <span
            key={t}
            className={`hdr-tab${activeTopTab === t ? " active" : ""}`}
            onClick={() => onTopTabChange?.(t)}
            style={{ cursor: "pointer" }}
          >
            {t}
          </span>
        ))}
      </nav>

      {/* 유저 영역 */}
      <div className="hdr-right">
        {user && (
          <span className="hdr-username">
            <b>{displayName}</b>님, 환영합니다.
          </span>
        )}

        <div ref={dropRef} style={{ position: "relative" }}>
          <button
            className="hdr-user-icon"
            onClick={() => setDropOpen(p => !p)}
            style={{ cursor: "pointer" }}
          >
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
            }
          </button>

          {dropOpen && (
            <div className="hdr-dropdown">
              <div className="hdr-dropdown-user">
                <span className="hdr-dropdown-name">{displayName}</span>
                <span className="hdr-dropdown-role">관리자</span>
              </div>
              <div className="hdr-dropdown-divider" />
              <button className="hdr-dropdown-item" onClick={() => { setDropOpen(false); onSettings?.(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                설정
              </button>
              <div className="hdr-dropdown-divider" />
              <button className="hdr-dropdown-item hdr-dropdown-logout" onClick={() => { setDropOpen(false); onLogout?.(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
