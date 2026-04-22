"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth";
import ToastContainer from "./_components/Toast";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", exact: true },
  { label: "계정 관리", href: "/admin/accounts" },
  { label: "사용자 추가 신청", href: "/admin/requests" },
  { label: "리포트 접근 권한", href: "/admin/permissions" },
  { label: "역할 정의", href: "/admin/roles" },
  { label: "로그/방문이력", href: "/admin/logs" },
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    if (!loading && !isAuthenticated) {
      router.push("/admin/login");
    } else if (!loading && isAuthenticated && user?.role !== "admin" && user?.role !== "manager") {
      router.push("/admin/login");
    }
  }, [loading, isAuthenticated, user, router, isLoginPage]);

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#f3f4f6" }}>
        <div style={{ color: "#6b7280" }}>로딩 중...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Top header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", height: 52, display: "flex", alignItems: "center", padding: "0 24px", position: "sticky", top: 0, zIndex: 200, boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pwc-logo.png`} alt="PwC" style={{ height: 22 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2d2d2d" }}>Easy View Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{user?.name} ({user?.company})</span>
          <button onClick={logout} style={{ padding: "4px 12px", border: "1px solid #e0e0e0", borderRadius: 6, background: "#fff", color: "#888", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            로그아웃
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <aside style={{ width: 220, background: "#fff", borderRight: "1px solid #e5e7eb", flexShrink: 0, position: "sticky", top: 52, height: "calc(100vh - 52px)", overflowY: "auto" }}>
          <nav style={{ padding: "8px 0" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "block", padding: "10px 20px", fontSize: 13, fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#d04a02" : "#555",
                  borderLeft: isActive ? "3px solid #d04a02" : "3px solid transparent",
                  background: isActive ? "#fff7ed" : "transparent",
                  textDecoration: "none", transition: "all .12s",
                }}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
