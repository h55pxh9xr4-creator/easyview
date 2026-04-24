"use client";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

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
  /** i18n key */
  labelKey: string;
  icon?: string;
  directSub?: string;
  sub?: { id: string; labelKey: string }[];
  dividerAfter?: boolean;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const NAV: NavGroup[] = [
  { tab: "summary", labelKey: "sidebar.summary", directSub: "summary", icon: `${BASE}/icons/icon-dashboard.svg` },
  {
    tab: "pl", labelKey: "sidebar.pl", icon: `${BASE}/icons/icon-pl.svg`,
    sub: [
      { id: "pl-sum",   labelKey: "sidebar.plSum" },
      { id: "pl-trend", labelKey: "sidebar.plTrend" },
      { id: "pl-acct",  labelKey: "sidebar.plAcct" },
      { id: "pl-sale",  labelKey: "sidebar.plSale" },
      { id: "pl-item",  labelKey: "sidebar.plItem" },
    ],
  },
  {
    tab: "bs", labelKey: "sidebar.bs", icon: `${BASE}/icons/icon-balance.svg`,
    sub: [
      { id: "bs-sum",   labelKey: "sidebar.bsSum" },
      { id: "bs-trend", labelKey: "sidebar.bsTrend" },
      { id: "bs-acct",  labelKey: "sidebar.bsAcct" },
    ],
  },
  {
    tab: "vch", labelKey: "sidebar.vch", icon: `${BASE}/icons/icon-journal.svg`,
    sub: [
      { id: "vch-analysis", labelKey: "sidebar.vchAnalysis" },
      { id: "vch-search",   labelKey: "sidebar.vchSearch" },
    ],
  },
  {
    tab: "sc", labelKey: "sidebar.sc", icon: `${BASE}/icons/icon-scenario.svg`,
    dividerAfter: true,
    sub: [
      { id: "sc-dup",  labelKey: "sidebar.scDup" },
      { id: "sc-cash", labelKey: "sidebar.scCash" },
      { id: "sc-wknd", labelKey: "sidebar.scWknd" },
      { id: "sc-big",  labelKey: "sidebar.scBig" },
      { id: "sc-sc5",  labelKey: "sidebar.scSc5" },
      { id: "sc-sc6",  labelKey: "sidebar.scSc6" },
    ],
  },
  { tab: "inquiry", labelKey: "sidebar.inquiry", directSub: "inquiry", icon: `${BASE}/icons/icon-email.svg` },
];

interface Props {
  activeTab: string;
  activeSub: string;
  onNavigate: (tab: string, sub: string, label: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeTab, activeSub, onNavigate, collapsed, onToggleCollapse }: Props) {
  const { t } = useTranslation();
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
          const itemLabel = t(item.labelKey);

          return (
            <div key={item.tab}>
              {/* 그룹 헤더 버튼 */}
              <button
                className={`sb-item${isActive ? " active" : ""}`}
                title={collapsed ? itemLabel : undefined}
                onClick={() => {
                  if (item.directSub) {
                    onNavigate(item.tab, item.directSub, itemLabel);
                  } else if (collapsed) {
                    onToggleCollapse();
                    setOpenGroups(new Set([item.tab]));
                    const firstSub = item.sub![0];
                    onNavigate(item.tab, firstSub.id, t(firstSub.labelKey));
                  } else {
                    toggle(item.tab);
                  }
                }}
              >
                <span className="sb-icon">{item.icon ? <NavIcon src={item.icon} /> : null}</span>
                {!collapsed && <span className="sb-label">{itemLabel}</span>}
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
                      onClick={() => onNavigate(item.tab, s.id, t(s.labelKey))}
                    >
                      {t(s.labelKey)}
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
            <span style={{ fontSize: 11, marginLeft: 4, color: "#aaa" }}>{t("sidebar.collapse", "접기")}</span>
          </>
        )}
      </button>
    </aside>
  );
}
