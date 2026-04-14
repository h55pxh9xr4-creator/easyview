"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookShelf from "@/components/layout/BookShelf";

export default function HomePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = sessionStorage.getItem("ev_auth") === "1";
    if (!ok) router.replace("/");
    else setAuthed(true);
  }, [router]);

  if (!authed) return null;

  const handleNavigate = (tab: string, sub: string, label: string) => {
    // 선택한 페이지 정보를 sessionStorage에 저장하고 메인으로 이동
    // router.push 대신 window.location으로 강제 full reload — useEffect 재실행 보장
    sessionStorage.setItem("ev_goto_tab", tab);
    sessionStorage.setItem("ev_goto_sub", sub);
    sessionStorage.setItem("ev_goto_label", label);
    window.location.href = "/";
  };

  return <BookShelf onNavigate={handleNavigate} />;
}
