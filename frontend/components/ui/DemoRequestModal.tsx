"use client";

import { useState, FormEvent } from "react";

interface DemoRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoRequestModal({ isOpen, onClose }: DemoRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      company: formData.get("company"),
    };

    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("데모 요청 전송 실패");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Modal Card */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 border-2 border-[#FD5108] overflow-hidden">
        {/* Orange top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FD5108] to-[#FF7520]" />

        <div className="p-6 md:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FD5108]/10 hover:bg-[#FD5108]/20 flex items-center justify-center text-[#FD5108] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="text-[12px] font-semibold text-[#FD5108] tracking-wide uppercase mb-1">Demo Request</div>
          <h2 className="text-lg md:text-xl font-bold text-[#222C40]">Easy View 데모를 신청하세요</h2>
        </div>

        {/* Form or Success Message */}
        {success ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-400 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-green-400">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-[#222C40]">데모 요청이 전송되었습니다!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 성함 */}
            <div>
              <input
                type="text"
                name="firstName"
                placeholder="성함"
                required
                className="w-full px-3 py-2.5 rounded border border-[#DFE3E6] bg-[#F5F7F8] text-sm text-[#222C40] placeholder-[#A1A8B3] focus:outline-none focus:ring-2 focus:ring-[#FD5108]/30 focus:border-[#FD5108] transition-all"
              />
            </div>

            {/* 이메일 */}
            <div>
              <input
                type="email"
                name="email"
                placeholder="이메일"
                required
                className="w-full px-3 py-2.5 rounded border border-[#DFE3E6] bg-[#F5F7F8] text-sm text-[#222C40] placeholder-[#A1A8B3] focus:outline-none focus:ring-2 focus:ring-[#FD5108]/30 focus:border-[#FD5108] transition-all"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <input
                type="tel"
                name="phone"
                placeholder="전화번호"
                required
                className="w-full px-3 py-2.5 rounded border border-[#DFE3E6] bg-[#F5F7F8] text-sm text-[#222C40] placeholder-[#A1A8B3] focus:outline-none focus:ring-2 focus:ring-[#FD5108]/30 focus:border-[#FD5108] transition-all"
              />
            </div>

            {/* 회사 */}
            <div>
              <input
                type="text"
                name="company"
                placeholder="회사"
                required
                className="w-full px-3 py-2.5 rounded border border-[#DFE3E6] bg-[#F5F7F8] text-sm text-[#222C40] placeholder-[#A1A8B3] focus:outline-none focus:ring-2 focus:ring-[#FD5108]/30 focus:border-[#FD5108] transition-all"
              />
            </div>

            {/* reCAPTCHA Notice */}
            <div className="flex items-center justify-between mt-4 py-3">
              <div className="text-[11px] text-[#4B535E]">
                <input type="checkbox" defaultChecked disabled className="mr-1" />
                로봇이 아닙니다.
              </div>
              <div className="flex items-center gap-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#A1A8B3]">
                  <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <div className="text-[9px] text-[#A1A8B3]">
                  <div>reCAPTCHA</div>
                  <div className="flex gap-1">
                    <a href="#" className="hover:underline">Privacy</a>
                    <span>-</span>
                    <a href="#" className="hover:underline">Terms</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mt-2">
                {error}
              </div>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 px-4 py-2.5 rounded bg-[#FD5108] hover:bg-[#E84A00] disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? "전송 중..." : "신청하기"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
