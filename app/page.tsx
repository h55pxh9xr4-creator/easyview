"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import FilterBar from "@/components/layout/FilterBar";
import CommentPanel from "@/components/layout/CommentPanel";
import LoginPage from "@/components/layout/LoginPage";
import Inquiry from "@/components/pages/Inquiry";
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
  summary:        Summary,
  inquiry:        Inquiry,
  "pl-sum":       PLSummary,
  "pl-trend":     PLTrend,
  "pl-acct":      PLAccount,
  "pl-sale":      PLSales,
  "pl-item":      PLItems,
  "bs-sum":       BSSummary,
  "bs-trend":     BSTrend,
  "bs-acct":      BSAccount,
  "vch-analysis": VCHAnalysis,
  "vch-search":   VCHSearch,
  "sc-dup":       SC1,
  "sc-cash":      SC2,
  "sc-wknd":      SC3,
  "sc-big":       SC4,
  "sc-sc5":       SC5,
  "sc-sc6":       SC6,
};

function PageInner() {
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [activeSub, setActiveSub] = useState("summary");
  const [pageLabel, setPageLabel] = useState("Summary");
  const [user, setUser] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { target: commentTarget, rect: commentRect, panelOpen, openPanel, closeAll } = useComment();
  const loadCommentedItems = useCommentedItems(state => state.load);
  const pendingInquiryId = usePendingInquiry(state => state.pendingId);
  const clearPendingId   = usePendingInquiry(state => state.setPendingId);

  // mount 시점의 params를 ref에 고정 — effect 재실행으로 인한 루프 방지
  const initParams = useRef({
    tab:   searchParams.get("tab"),
    sub:   searchParams.get("sub"),
    label: searchParams.get("label"),
  });

  useEffect(() => {
    // 자동 로그인
    if (localStorage.getItem("ev_auto_auth") === "1") {
      sessionStorage.setItem("ev_auth", "1");
      sessionStorage.setItem("ev_user", localStorage.getItem("ev_auto_user") ?? "");
    }

    const ok  = sessionStorage.getItem("ev_auth") === "1";
    const { tab, sub, label } = initParams.current;
    setUser(sessionStorage.getItem("ev_user") ?? "");

    if (ok) loadCommentedItems();

    if (ok && tab && sub && label) {
      setActiveTab(tab);
      setActiveSub(sub);
      setPageLabel(decodeURIComponent(label));
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (ok) {
      setAuthed(true);
    } else {
      setAuthed(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = (tab: string, sub: string, label: string, keepComment = false) => {
    if (!keepComment) closeAll();
    setActiveTab(tab);
    setActiveSub(sub);
    setPageLabel(label);
  };

  // CommentDot 클릭 시 → Inquiry 페이지로 이동
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
  };

  if (!authed) {
    return <LoginPage onLogin={() => {
      setUser(sessionStorage.getItem("ev_user") ?? "");
      loadCommentedItems();
      setAuthed(true);
    }} />;
  }

  const ActivePage = PAGE_MAP[activeSub] ?? Summary;

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <div className="app-body">
        <Sidebar
          activeTab={activeTab}
          activeSub={activeSub}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />
        <div className={`main-content${panelOpen ? " panel-open" : ""}`}>
          <div className="ptb">
            <span className="ptb-sub">{pageLabel}</span>
            <FilterBar activeSub={activeSub} inline />
          </div>
          <ActivePage onNavigate={handleNavigate} />
        </div>

        {/* Comment 배지 — 클릭된 요소 오른쪽 상단 */}
        {commentTarget && !panelOpen && (
          <button
            className="comment-badge"
            onClick={openPanel}
            style={commentRect ? {
              position: "fixed",
              top: commentRect.top - 14,
              left: commentRect.right - 10,
              transform: "translateX(-100%)",
            } : undefined}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Comment
          </button>
        )}

        {/* Comment 패널 — target이 바뀔 때마다 재마운트해서 상태 초기화 */}
        {panelOpen && <CommentPanel key={`${commentTarget?.page ?? ""}-${commentTarget?.label ?? ""}-${commentTarget?.inquiryId ?? ""}`} />}
      </div>
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
