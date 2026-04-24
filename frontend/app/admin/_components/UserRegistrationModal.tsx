"use client";

import { useState, useEffect } from "react";
import { showToast } from "./Toast";
import { adminGroupsApi, adminCompaniesApi, adminUsersApi } from "@/lib/admin-api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserRegistrationModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [role, setRole] = useState("viewer");
  const [password, setPassword] = useState("");
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      adminCompaniesApi.names().then((res) => setCompanyNames(res.names || [])).catch(() => {});
      setEmail(""); setName(""); setCompany(""); setGroupId(null); setRole("viewer"); setPassword("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name || !company) { showToast("필수 항목을 입력해주세요.", "error"); return; }
    setSubmitting(true);
    try {
      await adminUsersApi.create({ email, name, company, group_id: groupId, role, password: password || undefined });
      showToast(`${name} 사용자가 등록되었습니다.`, "success");
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "등록 실패", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-pwc-black mb-4">사용자 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">이름 *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="홍길동" required /></div>
          <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">이메일 *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="user@example.com" required /></div>
          <div>
            <label className="block text-sm font-medium text-pwc-gray-700 mb-1">회사 *</label>
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="input-field" required>
              <option value="">회사 선택</option>
              {companyNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-pwc-gray-700 mb-1">역할</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field">
              {email.endsWith("@pwc.com") && <option value="admin">PwC (Admin)</option>}
              {email.endsWith("@pwc.com") && <option value="manager">PwC (Manager)</option>}
              <option value="viewer">User (Viewer)</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">임시 비밀번호 (미입력 시 temp1234!)</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="temp1234!" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded border border-pwc-gray-300 text-pwc-gray-700 hover:bg-pwc-gray-50">취소</button>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "등록 중..." : "등록"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
