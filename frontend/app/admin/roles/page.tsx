"use client";

import { useState, useEffect } from "react";
import { adminRolesApi } from "@/lib/admin-api";
import { showToast } from "../_components/Toast";

interface Role { id: number; name: string; category: string; description: string | null; permissions: string[]; created_at: string | null; }

const PERM_OPTIONS = ["자료 업로드", "리포트 열람", "공유/인쇄", "Excel/PDF 추출", "코멘트", "사용자 추가 신청", "사용자 관리", "권한 설정"];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", category: "client", description: "", permissions: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminRolesApi.list().then((d) => setRoles(d.roles || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const createRole = async () => {
    if (!newRole.name.trim()) { showToast("역할명을 입력해주세요.", "error"); return; }
    setSaving(true);
    try {
      const created = await adminRolesApi.create(newRole as unknown as Record<string, unknown>);
      setRoles((prev) => [...prev, created]);
      setNewRole({ name: "", category: "client", description: "", permissions: [] });
      setShowCreate(false);
      showToast("역할이 생성되었습니다.", "success");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "생성 실패", "error"); }
    finally { setSaving(false); }
  };

  const deleteRole = async (id: number, name: string) => {
    if (!confirm(`'${name}' 역할을 삭제하시겠습니까?`)) return;
    try {
      await adminRolesApi.delete(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      showToast("역할이 삭제되었습니다.", "success");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "삭제 실패", "error"); }
  };

  const togglePerm = (perm: string) => {
    setNewRole((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm) ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm],
    }));
  };

  const pwcRoles = roles.filter((r) => r.category === "pwc");
  const clientRoles = roles.filter((r) => r.category === "client");

  const RoleCard = ({ role }: { role: Role }) => (
    <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-pwc-black">{role.name}</p>
          {role.description && <p className="text-xs text-pwc-gray-500 mt-0.5">{role.description}</p>}
        </div>
        <button onClick={() => deleteRole(role.id, role.name)} className="text-pwc-gray-400 hover:text-red-500 cursor-pointer p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {role.permissions.map((p) => (
          <span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pwc-gray-100 text-pwc-gray-600">{p}</span>
        ))}
        {role.permissions.length === 0 && <span className="text-xs text-pwc-gray-400">권한 없음</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">역할 정의</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">PwC 내부 및 고객사 사용자의 역할과 권한을 정의합니다.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ 역할 추가</button>
      </div>

      {loading ? <div className="flex items-center justify-center py-20 text-pwc-gray-400">로딩 중...</div> : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-pwc-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />PwC 내부 역할
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pwcRoles.map((r) => <RoleCard key={r.id} role={r} />)}
              {pwcRoles.length === 0 && <p className="text-sm text-pwc-gray-400">역할이 없습니다.</p>}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-pwc-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />고객사 역할
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientRoles.map((r) => <RoleCard key={r.id} role={r} />)}
              {clientRoles.length === 0 && <p className="text-sm text-pwc-gray-400">역할이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-pwc-black mb-4">역할 추가</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">역할명 *</label><input type="text" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className="input-field" placeholder="역할명 입력" /></div>
              <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">분류</label>
                <select value={newRole.category} onChange={(e) => setNewRole({ ...newRole, category: e.target.value })} className="input-field">
                  <option value="pwc">PwC 내부</option><option value="client">고객사</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">설명</label><input type="text" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} className="input-field" placeholder="역할 설명" /></div>
              <div>
                <label className="block text-sm font-medium text-pwc-gray-700 mb-2">권한</label>
                <div className="flex flex-wrap gap-2">
                  {PERM_OPTIONS.map((p) => (
                    <button key={p} type="button" onClick={() => togglePerm(p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${newRole.permissions.includes(p) ? "bg-pwc-orange text-white" : "bg-pwc-gray-100 text-pwc-gray-600 hover:bg-pwc-gray-200"}`}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="text-sm px-4 py-2 rounded border border-pwc-gray-300 text-pwc-gray-700 hover:bg-pwc-gray-50 cursor-pointer">취소</button>
              <button onClick={createRole} disabled={saving} className="btn-primary">{saving ? "생성 중..." : "생성"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
