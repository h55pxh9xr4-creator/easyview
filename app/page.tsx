"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import FilterBar from "@/components/layout/FilterBar";
import LoginPage from "@/components/layout/LoginPage";
import Summary from "@/components/pages/Summary";
import Inquiry from "@/components/pages/Inquiry";

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

export default function Page() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [activeSub, setActiveSub] = useState("summary");
  const [pageLabel, setPageLabel] = useState("Summary");

  const [user, setUser] = useState("");

  useEffect(() => {
    setAuthed(sessionStorage.getItem("ev_auth") === "1");
    setUser(sessionStorage.getItem("ev_user") ?? "");
  }, []);

  const handleNavigate = (tab: string, sub: string, label: string) => {
    setActiveTab(tab);
    setActiveSub(sub);
    setPageLabel(label);
  };

  // 초기 hydration 전
  if (authed === null) return null;

  const handleLogout = () => {
    sessionStorage.removeItem("ev_auth");
    sessionStorage.removeItem("ev_user");
    setAuthed(false);
    setUser("");
  };

  if (!authed) {
    return <LoginPage onLogin={() => {
      setAuthed(true);
      setUser(sessionStorage.getItem("ev_user") ?? "");
    }} />;
  }

  const ActivePage = PAGE_MAP[activeSub] ?? Summary;

  return (
    <>
      <Header activeTab={activeTab} activeSub={activeSub} onNavigate={handleNavigate} user={user} onLogout={handleLogout} />
      <FilterBar activeSub={activeSub} />
      <div className="ptb">
        <span className="ptb-sub">{pageLabel}</span>
      </div>
      <ActivePage onNavigate={handleNavigate} />
    </>
  );
}
