"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Header, { type TopTab } from "@/components/layout/Header";
import { applyTheme } from "@/components/pages/Settings";
import { useCommentedItems } from "@/hooks/useCommentedItems";

function getTopTab(pathname: string | null): TopTab {
  if (!pathname) return "서비스 소개";
  if (pathname.startsWith("/service")) return "서비스 소개";
  if (pathname.startsWith("/report"))  return "리포트";
  if (pathname.startsWith("/resource")) return "자료실";
  if (pathname.startsWith("/inquiry")) return "문의게시판";
  return "서비스 소개";
}

const TAB_PATH: Record<TopTab, string> = {
  "서비스 소개": "/service",
  "리포트":      "/report",
  "자료실":      "/resource",
  "문의게시판":  "/inquiry",
  "관리자":      "/admin",
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user,   setUser]   = useState("");
  const loadCommentedItems  = useCommentedItems(state => state.load);

  useEffect(() => {
    if (localStorage.getItem("ev_auto_auth") === "1") {
      sessionStorage.setItem("ev_auth", "1");
      sessionStorage.setItem("ev_user", localStorage.getItem("ev_auto_user") ?? "");
    }
    const ok = sessionStorage.getItem("ev_auth") === "1";
    if (!ok) { router.replace("/"); return; }
    setUser(sessionStorage.getItem("ev_user") ?? "");
    loadCommentedItems();
    const savedTheme = localStorage.getItem("ev_theme") as "light" | "dark" | null;
    if (savedTheme) applyTheme(savedTheme);
    setAuthed(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authed === null) return null;

  const handleLogout = () => {
    sessionStorage.removeItem("ev_auth");
    sessionStorage.removeItem("ev_user");
    localStorage.removeItem("ev_auto_auth");
    localStorage.removeItem("ev_auto_user");
    router.push("/");
  };

  const handleTopTabChange = (tab: TopTab) => {
    if (tab === "관리자") {
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      window.location.href = `${base}/admin/`;
      return;
    }
    router.push(TAB_PATH[tab]);
  };

  return (
    <>
      <Header
        user={user}
        activeTopTab={getTopTab(pathname)}
        onTopTabChange={handleTopTabChange}
        onLogout={handleLogout}
        onSettings={() => router.push("/report?sub=settings")}
      />
      {children}
    </>
  );
}
