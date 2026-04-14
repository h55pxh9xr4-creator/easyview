"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const ok = sessionStorage.getItem("ev_auth") === "1";
    if (!ok) {
      router.replace("/");
    } else {
      router.replace("/?tab=summary&sub=summary&label=Summary");
    }
  }, [router]);

  return null;
}
