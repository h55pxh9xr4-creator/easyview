"use client";
import { useState, useEffect } from "react";

const NavIcon = ({ src }: { src: string }) => (
  <img src={src} alt="" width={22} height={22} style={{ display: "block", opacity: 1 }} />
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const ChevronUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

interface NavGroup {
  tab: string;
  label: string;
  icon?: string;
  directSub?: string;
  sub?: { id: string; label: string }[];
  dividerAfter?: boolean;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const NAV: NavGroup[] = [
  { tab: "summary", label: "Summary", directSub: "summary", icon: `${BASE}/icons/icon-dashboard.svg` },
  {
    tab: "pl", label: "손익분석", icon: `${BASE}/icons/icon-pl.svg`,
    sub: [
      { id: "pl-sum",   label: "PL 요약" },
      { id: "pl-trend", label: "PL 추이분석" },
      { id: "pl-acct",  label: "PL 계정분석" },
      { id: "pl-sale",  label: "매출분석" },
      { id: "pl-item",  label: "손익항목" },
    ],
  },
  {
    tab: "bs", label: "재무상태분석", icon: `${BASE}/icons/icon-balance.svg`,
    sub: [
      { id: "bs-sum",   label: "BS 요약" },
      { id: "bs-trend", label: "BS 추이분석" },
      { id: "bs-acct",  label: "BS 계정분석" },
    ],
  },
  {
    tab: "vch", label: "전표분석", icon: `${BASE}/icons/icon-journal.svg`,
    sub: [
      { id: "vch-analysis", label: "전표분석내역" },
      { id: "vch-search",   label: "전표검색" },
    ],
  },
  {
    tab: "sc", label: "시나리오분석", icon: `${BASE}/icons/icon-scenario.svg`,
    dividerAfter: true,
    sub: [
      { id: "sc-dup",  label: "동일금액 중복 전표" },
      { id: "sc-cash", label: "현금지급 後 부채인식" },
      { id: "sc-wknd", label: "주말 현금지급" },
      { id: "sc-big",  label: "고액 현금지급" },
      { id: "sc-sc5",  label: "비용인식 동시 현금지급" },
      { id: "sc-sc6",  label: "Seldom Used Customer" },
    ],
  },
  { tab: "inquiry", label: "문의게시판", directSub: "inquiry", icon: `${BASE}/icons/icon-email.svg` },
];

interface Props {
  activeTab: string;
  activeSub: string;
  onNavigate: (tab: string, sub: string, label: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeTab, activeSub, onNavigate, collapsed, onToggleCollapse }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([activeTab]));

  useEffect(() => {
    setOpenGroups(prev => new Set([...prev, activeTab]));
  }, [activeTab]);

  const toggle = (tab: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(tab)) next.delete(tab);
      else next.add(tab);
      return next;
    });
  };

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sb-list">
        {NAV.map(item => {
          const isActive = activeTab === item.tab;
          const isOpen = !collapsed && openGroups.has(item.tab);

          return (
            <div key={item.tab}>
              {/* 그룹 헤더 버튼 */}
              <button
                className={`sb-item${isActive ? " active" : ""}`}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  if (item.directSub) {
                    onNavigate(item.tab, item.directSub, item.label);
                  } else if (collapsed) {
                    onToggleCollapse();
                    setOpenGroups(new Set([item.tab]));
                    onNavigate(item.tab, item.sub![0].id, item.sub![0].label);
                  } else {
                    toggle(item.tab);
                  }
                }}
              >
                <span className="sb-icon">{item.icon ? <NavIcon src={item.icon} /> : null}</span>
                {!collapsed && <span className="sb-label">{item.label}</span>}
                {!collapsed && item.sub && (
                  <span className="sb-arrow">
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                  </span>
                )}
              </button>

              {/* 서브 아이템 */}
              {isOpen && item.sub && (
                <div className="sb-subs">
                  {item.sub.map(s => (
                    <button
                      key={s.id}
                      className={`sb-sub-item${activeSub === s.id ? " active" : ""}`}
                      onClick={() => onNavigate(item.tab, s.id, s.label)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 구분선 */}
              {item.dividerAfter && !collapsed && <div className="sb-divider" />}
            </div>
          );
        })}
      </div>

      {/* 접기 버튼 */}
      <button className="sb-collapse-btn" onClick={onToggleCollapse}>
        {collapsed ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span style={{ fontSize: 11, marginLeft: 4, color: "#aaa" }}>접기</span>
          </>
        )}
      </button>
    </aside>
  );
}
