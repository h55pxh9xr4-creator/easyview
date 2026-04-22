"use client";

import { useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (e: string, p: string) => {
    setError("");
    setLoading(true);
    try {
      await login(e, p);
      router.push("/admin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    await doLogin(email, password);
  };

  const quickLogin = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    doLogin(e, p);
  };

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#f3f4f6" }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-8">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pwc-logo.png`} alt="PwC" style={{ height: 36, margin: "0 auto 12px" }} />
            <h1 className="text-2xl font-bold text-pwc-black mb-1">Easy View Admin</h1>
            <p className="text-sm text-pwc-gray-500">관리자 포털에 로그인하세요</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-pwc-gray-700 mb-1">이메일</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="admin@pwc.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-pwc-gray-700 mb-1">비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="비밀번호를 입력하세요" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-50">
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-pwc-gray-200">
            <p className="text-xs text-pwc-gray-500 font-medium mb-2 text-center">테스트 계정</p>
            <div className="space-y-1.5">
              <button type="button" onClick={() => quickLogin("admin@pwc.com", "admin1234!")}
                className="w-full text-left px-3 py-2 rounded border border-pwc-gray-200 hover:bg-pwc-gray-50 transition-colors cursor-pointer">
                <span className="text-xs font-medium text-pwc-orange">관리자 (PwC)</span>
                <span className="text-xs text-pwc-gray-500 ml-2">admin@pwc.com</span>
              </button>
              <button type="button" onClick={() => quickLogin("park.jm@seah.co.kr", "admin1234!")}
                className="w-full text-left px-3 py-2 rounded border border-pwc-gray-200 hover:bg-pwc-gray-50 transition-colors cursor-pointer">
                <span className="text-xs font-medium text-blue-600">User (매니저)</span>
                <span className="text-xs text-pwc-gray-500 ml-2">park.jm@seah.co.kr</span>
              </button>
            </div>
            <p className="text-xs text-pwc-gray-400 mt-3 text-center">클릭하면 자동 로그인됩니다</p>
          </div>
        </div>
      </div>
    </main>
  );
}
