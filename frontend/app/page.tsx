"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header, { type TopTab } from "@/components/layout/Header";
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
  const [activeTab, setActiveTab] = useState("summary");
  const [activeSub, setActiveSub] = useState("summary");
  const [pageLabel, setPageLabel] = useState("Summary");
  const [user, setUser]           = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { target: commentTarget, rect: commentRect, panelOpen, openPanel, closeAll } = useComment();
  const loadCommentedItems = useCommentedItems(state => state.load);
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
    if (tab === "관리자") { router.push("/admin"); return; }
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
      loadCommentedItems();
      setTopTab("서비스 소개");
      setAuthed(true);
      pushUrl("서비스 소개");
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
        onSettings={() => { handleNavigate("settings", "settings", "설정"); }}
      />

      {topTab === "서비스 소개" && (
        <ServiceIntro onNavigateToReport={() => handleNavigate("summary", "summary", "Summary")} />
      )}

      {topTab === "문의게시판" && (
        <div className="app-body">
          <div className="main-content"><Inquiry onNavigate={handleNavigate} /></div>
          <ChatBot activePage="inquiry" />
        </div>
      )}

      <div className="app-body" style={{ display: topTab !== "리포트" && topTab !== "자료실" ? "none" : undefined }}>
        {topTab === "리포트" && (
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
        )}

        {topTab === "자료실" && (
          <div style={{ flex: 1, overflow: "hidden" }}><ResourceRoom /></div>
        )}

        {topTab === "리포트" && commentTarget && !panelOpen && (
          <button className="comment-badge" onClick={openPanel}
            style={commentRect ? { position: "fixed", top: commentRect.top - 14, left: commentRect.right - 10, transform: "translateX(-100%)" } : undefined}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Comment
          </button>
        )}
        {topTab === "리포트" && panelOpen && (
          <CommentPanel key={`${commentTarget?.page ?? ""}-${commentTarget?.label ?? ""}-${commentTarget?.inquiryId ?? ""}`} />
        )}
        {topTab === "리포트" && <ChatBot activePage={activeSub} />}
      </div>

      {topTab === "자료실" && (
        <ChatBot activePage="resource" />
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
