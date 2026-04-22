"use client";

import { useState, useEffect, useCallback } from "react";
import UserRegistrationModal from "../_components/UserRegistrationModal";
import { showToast } from "../_components/Toast";
import { adminUsersApi, adminCompaniesApi, adminGroupsApi } from "@/lib/admin-api";
import { downloadCSV } from "@/lib/admin-export";

interface User {
  id: number; name: string; email: string; company: string; group_id: number | null;
  role: string; status: string; trust_level: string; two_fa: boolean; last_login?: string | null;
}
interface Company { id: number; name: string; subsidiaries: { id: number; name: string }[]; }
interface Group { id: number; name: string; company: string; default_role: string; member_count: number; }

const roleMapReverse: Record<string, string> = { admin: "PwC", manager: "PwC", viewer: "User" };
const roleLabel = (role: string) => roleMapReverse[role] || role;

export default function AccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [roleFilter, setRoleFilter] = useState("전체");
  const [companyFilter, setCompanyFilter] = useState("전체");
  const [companyOptions, setCompanyOptions] = useState(["전체"]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", company: "", group_id: null as number | null, role: "", status: "" });
  const [editSaving, setEditSaving] = useState(false);

  const loadCompanies = useCallback(async () => {
    try {
      const [cRes, gRes] = await Promise.all([adminCompaniesApi.list(), adminGroupsApi.list()]);
      setCompanies(cRes.companies || []); setGroups(gRes.groups || []);
    } catch { /* */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== "전체") params.status = statusFilter;
      if (roleFilter === "PwC") params.role = "admin";
      else if (roleFilter === "User") params.role = "viewer";
      if (companyFilter !== "전체") params.company = companyFilter;
      const data = await adminUsersApi.list(Object.keys(params).length > 0 ? params : undefined);
      setUsers(data.users ?? []); setTotal(data.total ?? 0);
    } catch { /* */ } finally { setLoading(false); }
  }, [search, statusFilter, roleFilter, companyFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { adminCompaniesApi.names().then((r) => setCompanyOptions(["전체", ...(r.names || [])])).catch(() => {}); }, []);

  const toggleSelectAll = () => setSelectedUsers(selectedUsers.length === users.length ? [] : users.map((u) => u.id));
  const toggleSelect = (id: number) => setSelectedUsers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleStatus = async (id: number) => {
    try { const r = await adminUsersApi.toggleStatus(id); showToast(r.message, "success"); await fetchUsers(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "실패", "error"); }
  };

  const deleteUser = async (id: number) => {
    const u = users.find((x) => x.id === id);
    if (u && confirm(`${u.name}님을 삭제하시겠습니까?`)) {
      try { await adminUsersApi.delete(id); showToast("삭제 완료", "success"); setSelectedUsers((p) => p.filter((x) => x !== id)); await fetchUsers(); }
      catch (e: unknown) { showToast(e instanceof Error ? e.message : "실패", "error"); }
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`${selectedUsers.length}명을 삭제하시겠습니까?`)) return;
    try { await Promise.all(selectedUsers.map((id) => adminUsersApi.delete(id))); showToast(`${selectedUsers.length}명 삭제`, "success"); setSelectedUsers([]); await fetchUsers(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "실패", "error"); }
  };

  const openEdit = (user: User) => {
    const correctedRole = (!user.email.endsWith("@pwc.com") && (user.role === "admin" || user.role === "manager")) ? "viewer" : user.role;
    setEditUser(user); setEditForm({ name: user.name, email: user.email, company: user.company, group_id: user.group_id, role: correctedRole, status: user.status });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    if ((editForm.role === "admin" || editForm.role === "manager") && !editForm.email.endsWith("@pwc.com")) {
      showToast("PwC 역할은 @pwc.com 도메인 계정만 설정 가능합니다.", "error"); return;
    }
    setEditSaving(true);
    try { await adminUsersApi.update(editUser.id, editForm); showToast("수정 완료", "success"); setEditUser(null); await fetchUsers(); await loadCompanies(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "실패", "error"); }
    finally { setEditSaving(false); }
  };

  const resetPassword = async (id: number) => {
    try { const r = await adminUsersApi.resetPassword(id); showToast(r.message, "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "실패", "error"); }
  };

  const statusBadge = (s: string) => {
    const m: Record<string, { c: string; l: string }> = { active: { c: "badge-active", l: "활성" }, inactive: { c: "badge-inactive", l: "비활성" }, pending: { c: "badge-pending", l: "대기" } };
    const x = m[s]; return x ? <span className={x.c}>{x.l}</span> : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">계정 관리</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">사용자 계정 및 보안 상태를 통합 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadCSV(users as unknown as Record<string, unknown>[], [
            { key: "name", label: "이름" }, { key: "email", label: "이메일" }, { key: "company", label: "회사" },
            { key: "role", label: "역할" }, { key: "status", label: "상태" }, { key: "last_login", label: "최종로그인" },
          ], "계정목록")} className="btn-secondary text-sm">엑셀 추출</button>
          <button onClick={() => setModalOpen(true)} className="btn-primary">+ 사용자 등록</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><label className="block text-xs font-medium text-pwc-gray-500 mb-1">검색</label><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름, 이메일, 회사명" className="input-field" /></div>
          <div><label className="block text-xs font-medium text-pwc-gray-500 mb-1">상태</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
              {["전체", "active", "inactive", "pending"].map((o) => <option key={o} value={o}>{o === "전체" ? "전체" : o === "active" ? "활성" : o === "inactive" ? "비활성" : "대기"}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-pwc-gray-500 mb-1">역할</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field">
              {["전체", "PwC", "User"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-pwc-gray-500 mb-1">회사</label>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="input-field">
              {companyOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
        <div className="px-6 py-3 border-b border-pwc-gray-200 flex items-center justify-between bg-pwc-gray-50">
          <span className="text-sm text-pwc-gray-600">총 {total}명{selectedUsers.length > 0 && <span className="ml-2 text-pwc-orange">· {selectedUsers.length}명 선택</span>}</span>
          {selectedUsers.length > 0 && (
            <button onClick={bulkDelete} className="text-xs btn-secondary py-1 px-3 text-red-600 border-red-200 hover:bg-red-50">일괄 삭제</button>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? <div className="py-12 text-center text-pwc-gray-400">불러오는 중...</div> : (
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                  <th className="py-3 px-3 w-10"><input type="checkbox" checked={users.length > 0 && selectedUsers.length === users.length} onChange={toggleSelectAll} className="w-4 h-4 rounded" /></th>
                  {["사용자", "소속", "역할", "상태", "최종 로그인", "관리"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border-b border-pwc-gray-100 hover:bg-pwc-gray-50 transition-colors ${selectedUsers.includes(user.id) ? "bg-orange-50" : ""}`}>
                    <td className="py-3 px-3"><input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => toggleSelect(user.id)} className="w-4 h-4 rounded" /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pwc-orange flex items-center justify-center text-white text-xs font-medium flex-shrink-0">{user.name[0]}</div>
                        <div><p className="font-medium text-pwc-black">{user.name}</p><p className="text-xs text-pwc-gray-500">{user.email}</p></div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-pwc-gray-700">{user.company}</p>
                        {(() => {
                          const g = groups.find((x) => x.id === user.group_id);
                          return g ? <p className="text-xs text-pwc-gray-400">{g.name}</p> : null;
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleLabel(user.role) === "PwC" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{roleLabel(user.role)}</span>
                    </td>
                    <td className="py-3 px-4">{statusBadge(user.status)}</td>
                    <td className="py-3 px-4 text-xs text-pwc-gray-500">{user.last_login?.slice(0, 16) || "-"}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleStatus(user.id)} className="p-1.5 rounded hover:bg-pwc-gray-100 text-pwc-gray-500 hover:text-pwc-orange cursor-pointer" title="상태변경">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                        <button onClick={() => openEdit(user)} className="p-1.5 rounded hover:bg-pwc-gray-100 text-pwc-gray-500 hover:text-blue-600 cursor-pointer" title="수정">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => resetPassword(user.id)} className="p-1.5 rounded hover:bg-pwc-gray-100 text-pwc-gray-500 hover:text-yellow-600 cursor-pointer" title="비밀번호 초기화">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        </button>
                        <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded hover:bg-red-50 text-pwc-gray-500 hover:text-red-600 cursor-pointer" title="삭제">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-pwc-gray-400">검색 결과가 없습니다.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditUser(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-pwc-black mb-4">사용자 정보 수정</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">이름</label><input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" /></div>
              <div><label className="block text-sm font-medium text-pwc-gray-700 mb-1">이메일</label><input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-pwc-gray-700 mb-1">회사</label>
                  <select value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value, group_id: null })} className="input-field">
                    {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pwc-gray-700 mb-1">자회사</label>
                  <select value={editForm.group_id ?? ""} onChange={(e) => setEditForm({ ...editForm, group_id: e.target.value ? Number(e.target.value) : null })} className="input-field">
                    <option value="">선택 안 함</option>
                    {companies.find((c) => c.name === editForm.company)?.subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-pwc-gray-700 mb-1">역할</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="input-field">
                    {editForm.email.endsWith("@pwc.com") && <option value="admin">PwC (Admin)</option>}
                    {editForm.email.endsWith("@pwc.com") && <option value="manager">PwC (Manager)</option>}
                    <option value="viewer">User (Viewer)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-pwc-gray-700 mb-1">상태</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input-field">
                    <option value="active">활성</option><option value="inactive">비활성</option><option value="pending">대기</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditUser(null)} className="text-sm px-4 py-2 rounded border border-pwc-gray-300 text-pwc-gray-700 hover:bg-pwc-gray-50 cursor-pointer">취소</button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-primary">{editSaving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      <UserRegistrationModal isOpen={modalOpen} onClose={() => { setModalOpen(false); fetchUsers(); loadCompanies(); }} />
    </div>
  );
}
