"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header, { type TopTab, ROLE_TABS } from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import ResourceRoom from "@/components/layout/ResourceRoom";
import ServiceIntro from "@/components/pages/ServiceIntro";
import FilterBar from "@/components/layout/FilterBar";
import CommentPanel from "@/components/layout/CommentPanel";
import ChatBot from "@/components/ui/ChatBot";
import LoginPage from "@/components/layout/LoginPage";
import Inquiry from "@/components/pages/Inquiry";
import Settings, { applyTheme } from "@/components/pages/Settings";
import { useComment } from "@/hooks/useComment";
import { useCommentedItems } from "@/hooks/useCommentedItems";
import { usePendingInquiry } from "@/hooks/usePendingInquiry";
import { useChatAttachment } from "@/hooks/useChatAttachment";
import { adminAuthApi } from "@/lib/admin-api";
import { fetchActiveReportInfo } from "@/lib/api";

const AdminAccounts  = dynamic(() => import("@/app/admin/accounts/page"),  { ssr: false });
const AdminCompanies = dynamic(() => import("@/app/admin/companies/page"), { ssr: false });
const AdminReports   = dynamic(() => import("@/app/admin/reports/page"),   { ssr: false });

const Summary      = dynamic(() => import("@/components/pages/Summary"),         { ssr: false });
const PLSummary    = dynamic(() => import("@/components/pages/pl/PLSummary"),    { ssr: false });
const PLTrend      = dynamic(() => import("@/components/pages/pl/PLTrend"),      { ssr: false });
const PLAccount    = dynamic(() => import("@/components/pages/pl/PLAccount"),    { ssr: false });
const PLSales      = dynamic(() => import("@/components/pages/pl/PLSales"),      { ssr: false });
const PLItems      = dynamic(() => import("@/components/pages/pl/PLItems"),      { ssr: false });
const BSSummary    = dynamic(() => import("@/components/pages/bs/BSSummary"),    { ssr: false });
const BSTrend      = dynamic(() => import("@/components/pages/bs/BSTrend"),      { ssr: false });
const BSAccount    = dynamic(() => import("@/components/pages/bs/BSAccount"),    { ssr: false });
const VCHAnalysis  = dynamic(() => import("@/components/pages/vch/VCHAnalysis"), { ssr: false });
const VCHSearch    = dynamic(() => import("@/components/pages/vch/VCHSearch"),   { ssr: false });
const SC1          = dynamic(() => import("@/components/pages/sc/SC1"),          { ssr: false });
const SC2          = dynamic(() => import("@/components/pages/sc/SC2"),          { ssr: false });
const SC3          = dynamic(() => import("@/components/pages/sc/SC3"),          { ssr: false });
const SC4          = dynamic(() => import("@/components/pages/sc/SC4"),          { ssr: false });
const SC5          = dynamic(() => import("@/components/pages/sc/SC5"),          { ssr: false });
const SC6          = dynamic(() => import("@/components/pages/sc/SC6"),          { ssr: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PAGE_MAP: Record<string, React.ComponentType<any>> = {
  summary: Summary, settings: Settings, inquiry: Inquiry,
  "pl-sum": PLSummary, "pl-trend": PLTrend, "pl-acct": PLAccount, "pl-sale": PLSales, "pl-item": PLItems,
  "bs-sum": BSSummary, "bs-trend": BSTrend, "bs-acct": BSAccount,
  "vch-analysis": VCHAnalysis, "vch-search": VCHSearch,
  "sc-dup": SC1, "sc-cash": SC2, "sc-wknd": SC3, "sc-big": SC4, "sc-sc5": SC5, "sc-sc6": SC6,
};

const PAGE_TO_TAB: Record<string, TopTab> = {
  service: "서비스 소개", report: "리포트", resource: "자료실", inquiry: "문의게시판", admin: "관리자",
};
const TAB_TO_PAGE: Record<TopTab, string> = {
  "서비스 소개": "service", "리포트": "report", "자료실": "resource", "문의게시판": "inquiry", "관리자": "admin",
};

function PageInner() {
  const router = useRouter();
  const [authed, setAuthed]             = useState<boolean | null>(null);
  const [topTab, setTopTab]             = useState<TopTab>("서비스 소개");
  const [adminSubPage, setAdminSubPage] = useState("accounts");
  const [inquirySubPage, setInquirySubPage] = useState<"inquiry" | "faq">("inquiry");
  const [activeTab, setActiveTab] = useState("summary");
  const [activeSub, setActiveSub] = useState("summary");
  const [pageLabel, setPageLabel] = useState("Summary");
  const [user, setUser]           = useState("");
  const [role, setRole]           = useState("admin");
  const [userCompany, setUserCompany] = useState("");
  // undefined=로딩중, null=활성리포트없음(오픈), string=회사명(제한)
  const [activeReportCompany, setActiveReportCompany] = useState<string | null | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { target: commentTarget, rect: commentRect, panelOpen, openPanel, closeAll } = useComment();
  const loadCommentedItems = useCommentedItems(state => state.load);
  const addToChat = useChatAttachment(s => s.add);
  const pendingInquiryId   = usePendingInquiry(state => state.pendingId);

  useEffect(() => {
    if (localStorage.getItem("ev_auto_auth") === "1") {
      sessionStorage.setItem("ev_auth", "1");
      sessionStorage.setItem("ev_user", localStorage.getItem("ev_auto_user") ?? "");
    }
    const ok = sessionStorage.getItem("ev_auth") === "1";
    const hash = window.location.hash.slice(1);
    const hp = new URLSearchParams(hash);
    const page = hp.get("page");
    const sub = hp.get("sub");
    const label = hp.get("label");
    setUser(sessionStorage.getItem("ev_user") ?? "");
    setRole(sessionStorage.getItem("ev_role") ?? "admin");
    setUserCompany(sessionStorage.getItem("ev_company") ?? "");
    if (ok) loadCommentedItems();
    const savedTheme = localStorage.getItem("ev_theme") as "light" | "dark" | null;
    if (savedTheme) applyTheme(savedTheme);

    if (ok && page) {
      const tab = PAGE_TO_TAB[page];
      if (tab) setTopTab(tab);
      if (sub) {
        setActiveSub(sub);
        setActiveTab(sub.split("-")[0]);
        setPageLabel(label ? decodeURIComponent(label) : sub);
      }
    }
    setAuthed(ok ? true : false);

    // 🆕 hashchange 리스너 — 김삼일 action의 navigate 버튼 지원
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      const np = new URLSearchParams(newHash);
      const newPage = np.get("page");
      const newSub = np.get("sub");
      const newLabel = np.get("label");
      if (newPage) {
        const newTab = PAGE_TO_TAB[newPage];
        if (newTab) setTopTab(newTab);
      }
      if (newSub) {
        setActiveSub(newSub);
        setActiveTab(newSub.split("-")[0]);
        setPageLabel(newLabel ? decodeURIComponent(newLabel) : newSub);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL 동기화 헬퍼 — location.hash 직접 할당 (pushState 우회)
  const pushUrl = (tab: TopTab, sub?: string, label?: string) => {
    const params = new URLSearchParams({ page: TAB_TO_PAGE[tab] });
    if (sub)   params.set("sub", sub);
    if (label) params.set("label", encodeURIComponent(label));
    window.location.hash = params.toString();
  };

  const handleTopTabChange = (tab: TopTab) => {
    closeAll();
    setTopTab(tab);
    pushUrl(tab);
  };

  const handleNavigate = (tab: string, sub: string, label: string, keepComment = false) => {
    if (!keepComment) closeAll();
    setActiveTab(tab);
    setActiveSub(sub);
    setPageLabel(label);
    const topTabFor: TopTab = tab === "inquiry" ? "문의게시판" : "리포트";
    setTopTab(topTabFor);
    pushUrl(topTabFor, sub, label);
  };

  useEffect(() => {
    if (pendingInquiryId !== null && authed) {
      handleNavigate("inquiry", "inquiry", "문의");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInquiryId]);
  // mount 시마다 admin token 갱신 — 만료 토큰으로 인한 빈 화면 방지
  useEffect(() => {
    adminAuthApi.login("admin@pwc.com", "admin1234!")
      .then((res) => { localStorage.setItem("admin_token", res.access_token); })
      .catch(() => {});
  }, []);

  // 활성 리포트 회사 조회
  useEffect(() => {
    if (!authed) return;
    fetchActiveReportInfo()
      .then((info) => setActiveReportCompany(info.active ? info.company : null))
      .catch(() => setActiveReportCompany(null));
  }, [authed]);

  if (authed === null) return null;

  const handleLogout = () => {
    sessionStorage.removeItem("ev_auth");
    sessionStorage.removeItem("ev_user");
    localStorage.removeItem("ev_auto_auth");
    localStorage.removeItem("ev_auto_user");
    setAuthed(false);
    setUser("");
    router.push("/");
  };

  if (!authed) {
    return <LoginPage onLogin={() => {
      setUser(sessionStorage.getItem("ev_user") ?? "");
      setRole(sessionStorage.getItem("ev_role") ?? "admin");
      setUserCompany(sessionStorage.getItem("ev_company") ?? "");
      loadCommentedItems();
      setTopTab("서비스 소개");
      setAuthed(true);
      pushUrl("서비스 소개");
      adminAuthApi.login("admin@pwc.com", "admin1234!")
        .then((res) => { localStorage.setItem("admin_token", res.access_token); })
        .catch(() => {});
    }} />;
  }

  const ActivePage = PAGE_MAP[activeSub] ?? Summary;

  return (
    <>
<Header
        user={user}
        activeTopTab={topTab}
        onTopTabChange={handleTopTabChange}
        onLogout={handleLogout}
        onSettings={() => setShowSettings(true)}
        allowedTabs={ROLE_TABS[role] ?? ROLE_TABS["admin"]}
      />

      {topTab === "서비스 소개" && (
        <ServiceIntro onNavigateToReport={() => handleNavigate("summary", "summary", "Summary")} />
      )}

      {topTab === "문의게시판" && (() => {
        const BASE_ICON = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const INQUIRY_NAV: { key: "inquiry" | "faq"; label: string; icon: string }[] = [
          { key: "inquiry", label: "문의", icon: `${BASE_ICON}/icons/icon-email.svg` },
          { key: "faq",     label: "FAQ",  icon: `${BASE_ICON}/icons/icon-trust.svg` },
        ];
        return (
          <div className="app-body">
            <aside className="sidebar" style={{ position: "sticky", top: 52, height: "calc(100vh - 52px)", alignSelf: "flex-start" }}>
              <div className="sb-list">
                {INQUIRY_NAV.map(item => (
                  <button
                    key={item.key}
                    onClick={() => setInquirySubPage(item.key)}
                    className={`sb-item${inquirySubPage === item.key ? " active" : ""}`}
                  >
                    <span className="sb-icon">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.icon} alt="" width={22} height={22} style={{ display: "block" }} />
                    </span>
                    <span className="sb-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </aside>
            <div className="main-content">
              <Inquiry onNavigate={handleNavigate} activeSub={inquirySubPage} />
            </div>
            <ChatBot activePage="inquiry" />
          </div>
        );
      })()}

      {topTab === "관리자" && (() => {
        const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const ADMIN_NAV = [
          { key: "accounts",  label: "계정 관리",   icon: `${BASE}/icons/icon-building.svg` },
          { key: "companies", label: "회사 관리",   icon: `${BASE}/icons/icon-trust.svg` },
          { key: "reports",   label: "리포트 관리", icon: `${BASE}/icons/icon-journal.svg` },
        ];
        return (
          <div className="app-body">
            <aside className="sidebar" style={{ position: "sticky", top: 52, height: "calc(100vh - 52px)", alignSelf: "flex-start" }}>
              <div className="sb-list">
                {ADMIN_NAV.map(item => (
                  <button key={item.key} onClick={() => setAdminSubPage(item.key)} className={`sb-item${adminSubPage === item.key ? " active" : ""}`}>
                    <span className="sb-icon">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.icon} alt="" width={22} height={22} style={{ display: "block" }} />
                    </span>
                    <span className="sb-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </aside>
            <div className="main-content admin-page" style={{ padding: 24 }}>
              <Suspense fallback={<div style={{ color: "#9ca3af" }}>로딩 중...</div>}>
                {adminSubPage === "accounts"  && <AdminAccounts />}
                {adminSubPage === "companies" && <AdminCompanies />}
                {adminSubPage === "reports"   && <AdminReports />}
              </Suspense>
            </div>
          </div>
        );
      })()}

      <div className="app-body" style={{ display: topTab !== "리포트" && topTab !== "자료실" ? "none" : undefined }}>
        {topTab === "리포트" && (() => {
          const isAdmin = role === "admin";
          // undefined=로딩중이면 접근허용, null=활성리포트없음이면 전체접근, string이면 회사 일치 여부 확인
          const hasAccess = isAdmin || activeReportCompany === undefined || activeReportCompany === null || activeReportCompany === userCompany;
          if (!hasAccess) {
            return (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#6b7280", padding: 40 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>귀사의 리포트가 아직 준비되지 않았습니다.</p>
                <p style={{ fontSize: 13, margin: 0, opacity: 0.7 }}>관리자가 리포트를 배포하면 이 페이지에서 확인할 수 있습니다.</p>
              </div>
            );
          }
          return (
            <>
              <Sidebar activeTab={activeTab} activeSub={activeSub} onNavigate={handleNavigate} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />
              <div className={`main-content${panelOpen ? " panel-open" : ""}`}>
                <div className="ptb">
                  <span className="ptb-sub">{pageLabel}</span>
                  <FilterBar activeSub={activeSub} inline />
                </div>
                <ActivePage onNavigate={handleNavigate} />
              </div>
            </>
          );
        })()}

        {topTab === "자료실" && (
          <div style={{ flex: 1, overflow: "hidden" }}><ResourceRoom /></div>
        )}

        {topTab === "리포트" && commentTarget && !panelOpen && (() => {
          // chatAttachment가 없으면 commentTarget 정보로 자동 생성
          const attachment = commentTarget.chatAttachment ?? {
            label: commentTarget.value
              ? `${commentTarget.label} ${commentTarget.value}`
              : commentTarget.label,
            summary: [
              `페이지: ${commentTarget.page}`,
              `항목: ${commentTarget.label}`,
              commentTarget.value ? `값: ${commentTarget.value}` : "",
              commentTarget.sub ? commentTarget.sub : "",
            ].filter(Boolean).join(" | "),
            source: `${commentTarget.page} - ${commentTarget.label}`,
          };
          return (
            <div className="feedback-toolbar"
              style={commentRect ? { position: "fixed", top: commentRect.top - 42, left: commentRect.right - 10, transform: "translateX(-100%)" } : undefined}>
              <button className="comment-badge" onClick={openPanel}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                Comment
              </button>
              <button className="add-to-chat-badge" onClick={() => {
                addToChat(attachment);
                closeAll();
              }}>
                <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/samilkim_nobg2_Faceonly.png`} alt="김삼일" className="samilkim-face-only" />
                <span className="a2c-tooltip">김삼일에게 질문하기</span>
              </button>
            </div>
          );
        })()}
        {topTab === "리포트" && panelOpen && (
          <CommentPanel key={`${commentTarget?.page ?? ""}-${commentTarget?.label ?? ""}-${commentTarget?.inquiryId ?? ""}`} />
        )}
        {topTab === "리포트" && <ChatBot activePage={activeSub} />}
      </div>

      {topTab !== "서비스 소개" && topTab !== "리포트" && topTab !== "문의게시판" && topTab !== "관리자" && (
        <ChatBot activePage="resource" />
      )}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg, #f8f9fb)", overflowY: "auto" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 40px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--txt, #1a1a2e)" }}>설정</span>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#888", lineHeight: 1 }}>✕</button>
            </div>
            <Settings />
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  );
}
