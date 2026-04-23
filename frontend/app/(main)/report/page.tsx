"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Sidebar from "@/components/layout/Sidebar";
import FilterBar from "@/components/layout/FilterBar";
import CommentPanel from "@/components/layout/CommentPanel";
import ChatBot from "@/components/ui/ChatBot";
import { useComment } from "@/hooks/useComment";
import { usePendingInquiry } from "@/hooks/usePendingInquiry";
import Settings from "@/components/pages/Settings";

const Summary     = dynamic(() => import("@/components/pages/Summary"),         { ssr: false });
const PLSummary   = dynamic(() => import("@/components/pages/pl/PLSummary"),    { ssr: false });
const PLTrend     = dynamic(() => import("@/components/pages/pl/PLTrend"),      { ssr: false });
const PLAccount   = dynamic(() => import("@/components/pages/pl/PLAccount"),    { ssr: false });
const PLSales     = dynamic(() => import("@/components/pages/pl/PLSales"),      { ssr: false });
const PLItems     = dynamic(() => import("@/components/pages/pl/PLItems"),      { ssr: false });
const BSSummary   = dynamic(() => import("@/components/pages/bs/BSSummary"),    { ssr: false });
const BSTrend     = dynamic(() => import("@/components/pages/bs/BSTrend"),      { ssr: false });
const BSAccount   = dynamic(() => import("@/components/pages/bs/BSAccount"),    { ssr: false });
const VCHAnalysis = dynamic(() => import("@/components/pages/vch/VCHAnalysis"), { ssr: false });
const VCHSearch   = dynamic(() => import("@/components/pages/vch/VCHSearch"),   { ssr: false });
const SC1         = dynamic(() => import("@/components/pages/sc/SC1"),          { ssr: false });
const SC2         = dynamic(() => import("@/components/pages/sc/SC2"),          { ssr: false });
const SC3         = dynamic(() => import("@/components/pages/sc/SC3"),          { ssr: false });
const SC4         = dynamic(() => import("@/components/pages/sc/SC4"),          { ssr: false });
const SC5         = dynamic(() => import("@/components/pages/sc/SC5"),          { ssr: false });
const SC6         = dynamic(() => import("@/components/pages/sc/SC6"),          { ssr: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PAGE_MAP: Record<string, React.ComponentType<any>> = {
  summary:        Summary,
  settings:       Settings,
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

const SUB_LABEL: Record<string, string> = {
  summary:        "Summary",
  settings:       "설정",
  "pl-sum":       "PL 요약",
  "pl-trend":     "PL 추이분석",
  "pl-acct":      "PL 계정분석",
  "pl-sale":      "매출분석",
  "pl-item":      "손익항목",
  "bs-sum":       "BS 요약",
  "bs-trend":     "BS 추이분석",
  "bs-acct":      "BS 계정분석",
  "vch-analysis": "전표분석내역",
  "vch-search":   "전표검색",
  "sc-dup":       "동일금액 중복 전표",
  "sc-cash":      "현금지급 後 부채인식",
  "sc-wknd":      "주말 현금지급",
  "sc-big":       "고액 현금지급",
  "sc-sc5":       "비용인식 동시 현금지급",
  "sc-sc6":       "Seldom Used Customer",
};

const TAB_OF: Record<string, string> = {
  summary: "summary",
  settings: "settings",
  "pl-sum": "pl", "pl-trend": "pl", "pl-acct": "pl", "pl-sale": "pl", "pl-item": "pl",
  "bs-sum": "bs", "bs-trend": "bs", "bs-acct": "bs",
  "vch-analysis": "vch", "vch-search": "vch",
  "sc-dup": "sc", "sc-cash": "sc", "sc-wknd": "sc", "sc-big": "sc", "sc-sc5": "sc", "sc-sc6": "sc",
};

function ReportInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initSub      = useRef(searchParams.get("sub") ?? "summary");
  const [activeSub, setActiveSub] = useState(initSub.current);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { target: commentTarget, rect: commentRect, panelOpen, openPanel, closeAll } = useComment();
  const pendingInquiryId = usePendingInquiry(state => state.pendingId);

  // Sync activeSub when URL ?sub= changes (e.g. back/forward, settings link)
  useEffect(() => {
    const sub = searchParams.get("sub");
    if (sub && sub !== activeSub) {
      setActiveSub(sub);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Redirect to /inquiry when CommentDot is clicked
  useEffect(() => {
    if (pendingInquiryId !== null) {
      router.push("/inquiry");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInquiryId]);

  const handleNavigate = (tab: string, sub: string, _label: string, keepComment = false) => {
    if (!keepComment) closeAll();
    if (tab === "inquiry") { router.push("/inquiry"); return; }
    router.push(`/report?sub=${sub}`);
    setActiveSub(sub);
  };

  const activeTab  = TAB_OF[activeSub] ?? "summary";
  const pageLabel  = SUB_LABEL[activeSub] ?? "Summary";
  const ActivePage = PAGE_MAP[activeSub] ?? Summary;

  return (
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

      {panelOpen && (
        <CommentPanel key={`${commentTarget?.page ?? ""}-${commentTarget?.label ?? ""}-${commentTarget?.inquiryId ?? ""}`} />
      )}

      <ChatBot activePage={activeSub} />
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  );
}
