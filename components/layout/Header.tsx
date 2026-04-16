"use client";

interface Props {
  user?: string;
  onLogout?: () => void;
}

const OTHER_TABS = ["Our Solutions", "Robotic", "XBRL", "Tax Hub"];

export default function Header({ user, onLogout }: Props) {
  return (
    <header className="hdr">
      {/* 로고 + 포털명 */}
      <div className="hdr-brand">
        <img src="/easyview/logo2.png" alt="PwC" className="logo-img" />
        <span className="hdr-portal-name">Digital Finance Portal</span>
      </div>

      {/* 상단 탭 */}
      <nav className="hdr-tabs">
        {OTHER_TABS.map(t => (
          <span key={t} className="hdr-tab">{t}</span>
        ))}
        <span className="hdr-tab active">Easyview</span>
      </nav>

      {/* 유저 영역 */}
      <div className="hdr-right">
        {user && (
          <>
            <span className="hdr-username">
              <b>{user}</b>님
            </span>
            <button className="hdr-logout" onClick={onLogout}>
              로그아웃
            </button>
          </>
        )}
        <div className="hdr-user-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>
    </header>
  );
}
