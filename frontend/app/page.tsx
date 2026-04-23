"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginPage from "@/components/layout/LoginPage";
import { adminAuthApi } from "@/lib/admin-api";
import { applyTheme } from "@/components/pages/Settings";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // 자동 로그인
    if (localStorage.getItem("ev_auto_auth") === "1") {
      sessionStorage.setItem("ev_auth", "1");
      sessionStorage.setItem("ev_user", localStorage.getItem("ev_auto_user") ?? "");
    }
    if (sessionStorage.getItem("ev_auth") === "1") {
      router.replace("/service");
    }
    const savedTheme = localStorage.getItem("ev_theme") as "light" | "dark" | null;
    if (savedTheme) applyTheme(savedTheme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = () => {
    router.push("/service");
    adminAuthApi.login("admin@pwc.com", "admin1234!")
      .then((res) => { localStorage.setItem("admin_token", res.access_token); })
      .catch(() => {});
  };

  return <LoginPage onLogin={handleLogin} />;
}
