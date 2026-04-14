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
    router.push(`/?tab=${tab}&sub=${sub}&label=${encodeURIComponent(label)}`);
  };

  return <BookShelf onNavigate={handleNavigate} />;
}
