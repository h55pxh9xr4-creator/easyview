"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { showToast } from "../_components/Toast";
import { adminUsersApi, adminCompaniesApi, adminGroupsApi } from "@/lib/admin-api";
import { downloadCSV } from "@/lib/admin-export";

interface User {
  id: number; name: string; email: string; company: string; group_id: number | null;
  role: string; status: string; trust_level: string; two_fa: boolean; last_login?: string | null;
}
interface Company { id: number; name: string; subsidiaries: { id: number; name: string }[]; }
interface Group { id: number; name: string; company: string; default_role: string; member_count: number; }

interface BulkRow {
  name: string; email: string; company: string; role: string; password: string; error?: string;
}

type View = "list" | "register";
type RegisterTab = "individual" | "bulk";

const ROLE_LABELS: Record<string, string> = {
  viewer:          "User (viewer)",
  uploader:        "User (uploader)",
  viewer_uploader: "User (viewer & Uploader)",
  admin:           "Manager",
};
const ROLE_COLORS: Record<string, string> = {
  viewer:          "bg-blue-100 text-blue-700",
  uploader:        "bg-green-100 text-green-700",
  viewer_uploader: "bg-purple-100 text-purple-700",
  admin:           "bg-orange-100 text-orange-700",
};
const roleLabel = (role: string) => ROLE_LABELS[role] || role;
const roleColor = (role: string) => ROLE_COLORS[role] || "bg-gray-100 text-gray-600";

const ROLE_MENU = [
  { menu: "서비스 소개",       uploader: true,  viewer: true,  viewer_uploader: true,  admin: true  },
  { menu: "리포트 페이지",     uploader: false, viewer: true,  viewer_uploader: true,  admin: true  },
  { menu: "자료실 (자료 요청)", uploader: true,  viewer: false, viewer_uploader: true,  admin: true  },
  { menu: "문의",              uploader: true,  viewer: true,  viewer_uploader: true,  admin: true  },
  { menu: "권한 관리",         uploader: false, viewer: false, viewer_uploader: false, admin: true  },
];

export default function AccountsPage() {
  const [view, setView] = useState<View>("list");
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  // 목록
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [roleFilter, setRoleFilter] = useState("전체");
  const [companyFilter, setCompanyFilter] = useState("전체");
  const [companyOptions, setCompanyOptions] = useState(["전체"]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", company: "", group_id: null as number | null, role: "", status: "" });
  const [editSaving, setEditSaving] = useState(false);

  // 등록 공통
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [registerTab, setRegisterTab] = useState<RegisterTab>("individual");

  // 개별 등록
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regRole, setRegRole] = useState("viewer");
  const [regPassword, setRegPassword] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);

  // 일괄 등록
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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
      if (roleFilter !== "전체") params.role = roleFilter;
      if (companyFilter !== "전체") params.company = companyFilter;
      const data = await adminUsersApi.list(Object.keys(params).length > 0 ? params : undefined);
      setUsers(data.users ?? []); setTotal(data.total ?? 0);
    } catch { /* */ } finally { setLoading(false); }
  }, [search, statusFilter, roleFilter, companyFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { adminCompaniesApi.names().then((r) => setCompanyOptions(["전체", ...(r.names || [])])).catch(() => {}); }, []);

  const openRegister = () => {
    setRegName(""); setRegEmail(""); setRegCompany(""); setRegRole("viewer"); setRegPassword("");
    setBulkRows([]); setRegisterTab("individual");
    adminCompaniesApi.names().then((r) => setCompanyNames(r.names || [])).catch(() => {});
    setView("register");
  };

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
    setEditUser(user); setEditForm({ name: user.name, email: user.email, company: user.company, group_id: user.group_id, role: user.role, status: user.status });
  };

  const saveEdit = async () => {
    if (!editUser) return;
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

  // 개별 등록 제출
  const handleIndividualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!regName || !regEmail || !regCompany) { showToast("필수 항목을 입력해주세요.", "error"); return; }
    setRegSubmitting(true);
    try {
      await adminUsersApi.create({ email: regEmail, name: regName, company: regCompany, role: regRole, password: regPassword || undefined });
      showToast(`${regName} 사용자가 등록되었습니다.`, "success");
      await fetchUsers(); await loadCompanies();
      setView("list");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "등록 실패", "error");
    } finally { setRegSubmitting(false); }
  };

  // 일괄 등록 CSV 파싱
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^﻿/, "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const dataLines = lines[0]?.startsWith("이름") ? lines.slice(1) : lines;
      const rows: BulkRow[] = dataLines.map((line) => {
        const [n, em, co, ro, pw] = line.split(",").map((s) => s.trim());
        const error = !n ? "이름 필수" : !em ? "이메일 필수" : !co ? "회사 필수" : undefined;
        return { name: n || "", email: em || "", company: co || "", role: ro || "viewer", password: pw || "", error };
      });
      setBulkRows(rows);
    };
    reader.readAsText(file, "utf-8");
  };

  const downloadTemplate = () => {
    const header = "이름,이메일,회사,역할(viewer/uploader/viewer_uploader/admin),임시비밀번호(선택)";
    const sample = "홍길동,hong@example.com,삼성전자,viewer,";
    const blob = new Blob(["﻿" + header + "\n" + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "사용자_일괄등록_양식.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkSubmit = async () => {
    const validRows = bulkRows.filter((r) => !r.error);
    if (validRows.length === 0) { showToast("등록 가능한 행이 없습니다.", "error"); return; }
    setBulkSubmitting(true);
    let success = 0; let fail = 0;
    for (const row of validRows) {
      try { await adminUsersApi.create({ email: row.email, name: row.name, company: row.company, role: row.role, password: row.password || undefined }); success++; }
      catch { fail++; }
    }
    setBulkSubmitting(false);
    showToast(`${success}명 등록 완료${fail > 0 ? `, ${fail}명 실패` : ""}`, fail > 0 ? "error" : "success");
    if (success > 0) { await fetchUsers(); await loadCompanies(); setView("list"); }
  };

  // ── 등록 화면 ──
  if (view === "register") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-2 rounded hover:bg-pwc-gray-100 text-pwc-gray-500 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-pwc-black">사용자 등록</h1>
            <p className="text-sm text-pwc-gray-500 mt-1">개별 또는 CSV 파일로 사용자를 일괄 등록합니다.</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-pwc-gray-200">
          {(["individual", "bulk"] as RegisterTab[]).map((t) => (
            <button key={t} onClick={() => setRegisterTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${registerTab === t ? "border-pwc-orange text-pwc-orange" : "border-transparent text-pwc-gray-500 hover:text-pwc-black"}`}>
              {t === "individual" ? "개별 등록" : "일괄 등록"}
            </button>
          ))}
        </div>

        {/* 개별 등록 */}
        {registerTab === "individual" && (
          <form onSubmit={handleIndividualSubmit}>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-pwc-black mb-4">기본 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-pwc-gray-700 mb-1">이름 *</label>
                      <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="input-field" placeholder="홍길동" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pwc-gray-700 mb-1">이메일 *</label>
                      <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="input-field" placeholder="user@example.com" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pwc-gray-700 mb-1">회사 *</label>
                      <select value={regCompany} onChange={(e) => setRegCompany(e.target.value)} className="input-field" required>
                        <option value="">회사 선택</option>
                        {companyNames.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-pwc-gray-700 mb-1">역할</label>
                      <select value={regRole} onChange={(e) => setRegRole(e.target.value)} className="input-field">
                        <option value="viewer">User (viewer)</option>
                        <option value="uploader">User (uploader)</option>
                        <option value="viewer_uploader">User (viewer &amp; Uploader)</option>
                        <option value="admin">Manager</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-pwc-black mb-4">보안 설정</h3>
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">임시 비밀번호</label>
                    <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="input-field" placeholder="미입력 시 temp1234! 적용" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-pwc-gray-50 rounded-xl border border-pwc-gray-200 p-5">
                  <h4 className="text-xs font-semibold text-pwc-gray-600 mb-3">등록 안내</h4>
                  <ul className="space-y-2 text-xs text-pwc-gray-500">
                    <li>· 이름, 이메일, 회사는 필수입니다.</li>
                    <li>· 역할: viewer / uploader / viewer_uploader / admin(Manager)</li>
                    <li>· 임시 비밀번호 미입력 시 <span className="font-mono text-pwc-gray-700">temp1234!</span>가 적용됩니다.</li>
                    <li>· 등록 후 사용자에게 초기 비밀번호를 안내해주세요.</li>
                  </ul>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-5 space-y-2">
                  <button type="submit" disabled={regSubmitting} className="btn-primary w-full">{regSubmitting ? "등록 중..." : "등록"}</button>
                  <button type="button" onClick={() => setView("list")} className="w-full text-sm px-4 py-2 rounded border border-pwc-gray-300 text-pwc-gray-700 hover:bg-pwc-gray-50 cursor-pointer">취소</button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* 일괄 등록 */}
        {registerTab === "bulk" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
              <h3 className="text-sm font-semibold text-pwc-black mb-3">CSV 파일로 일괄 등록</h3>
              <p className="text-xs text-pwc-gray-500 mb-4">CSV 양식을 다운로드하여 사용자 정보를 입력한 뒤 업로드하세요. 역할 값: viewer, uploader, viewer_uploader, admin</p>
              <div className="flex gap-3">
                <button onClick={downloadTemplate} className="btn-secondary text-sm">양식 다운로드</button>
                <button onClick={() => fileRef.current?.click()} className="btn-primary text-sm">CSV 파일 업로드</button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            {bulkRows.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden">
                <div className="px-6 py-3 border-b border-pwc-gray-200 flex items-center justify-between bg-pwc-gray-50">
                  <span className="text-sm text-pwc-gray-600">
                    총 {bulkRows.length}행
                    {bulkRows.filter((r) => r.error).length > 0 && <span className="ml-2 text-red-500">· 오류 {bulkRows.filter((r) => r.error).length}행 (제외됨)</span>}
                  </span>
                  <button onClick={handleBulkSubmit} disabled={bulkSubmitting} className="btn-primary text-sm py-1.5">
                    {bulkSubmitting ? "등록 중..." : `${bulkRows.filter((r) => !r.error).length}명 일괄 등록`}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                        {["이름", "이메일", "회사", "역할", "임시비밀번호", "상태"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, i) => (
                        <tr key={i} className={`border-b border-pwc-gray-100 ${row.error ? "bg-red-50" : ""}`}>
                          <td className="py-3 px-4">{row.name}</td>
                          <td className="py-3 px-4">{row.email}</td>
                          <td className="py-3 px-4">{row.company}</td>
                          <td className="py-3 px-4">{row.role}</td>
                          <td className="py-3 px-4 text-pwc-gray-400">{row.password || "(기본값)"}</td>
                          <td className="py-3 px-4">
                            {row.error ? <span className="text-xs text-red-600 font-medium">{row.error}</span> : <span className="text-xs text-green-600 font-medium">등록 가능</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 목록 화면 ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">계정 관리</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">사용자 계정 및 보안 상태를 통합 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRoleModalOpen(true)} className="btn-secondary text-sm">역할 정의</button>
          <button onClick={() => downloadCSV(users as unknown as Record<string, unknown>[], [
            { key: "name", label: "이름" }, { key: "email", label: "이메일" }, { key: "company", label: "회사" },
            { key: "role", label: "역할" }, { key: "status", label: "상태" }, { key: "last_login", label: "최종로그인" },
          ], "계정목록")} className="btn-secondary text-sm">엑셀 추출</button>
          <button onClick={openRegister} className="btn-primary">+ 사용자 등록</button>
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
              <option value="전체">전체</option>
              <option value="viewer">User (viewer)</option>
              <option value="uploader">User (uploader)</option>
              <option value="viewer_uploader">User (viewer &amp; Uploader)</option>
              <option value="admin">Manager</option>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(user.role)}`}>{roleLabel(user.role)}</span>
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
                    <option value="viewer">User (viewer)</option>
                    <option value="uploader">User (uploader)</option>
                    <option value="viewer_uploader">User (viewer &amp; Uploader)</option>
                    <option value="admin">Manager</option>
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

      {/* 역할 정의 팝업 */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setRoleModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-pwc-gray-200">
              <h2 className="text-lg font-bold text-pwc-black">역할 정의</h2>
              <button onClick={() => setRoleModalOpen(false)} className="text-pwc-gray-400 hover:text-pwc-black cursor-pointer p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* 테이블 */}
            <div className="px-7 py-5">
              <p className="text-xs font-semibold text-pwc-gray-500 mb-3">고객사 메뉴 구성 (권한별)</p>
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b-2 border-pwc-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold text-pwc-gray-700 w-36">메뉴</th>
                    <th className="text-center py-2 px-3 font-semibold text-pwc-gray-700">고객사<br/>업로더</th>
                    <th className="text-center py-2 px-3 font-semibold text-pwc-gray-700">고객사<br/>뷰어</th>
                    <th className="text-center py-2 px-3 font-semibold text-pwc-gray-700">고객사<br/>뷰어&업로드</th>
                    <th className="text-center py-2 px-3 font-semibold text-pwc-gray-700">관리자</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_MENU.map((row) => (
                    <tr key={row.menu} className="border-b border-pwc-gray-100">
                      <td className="py-3 pr-4 font-medium text-pwc-gray-800">{row.menu}</td>
                      {([row.uploader, row.viewer, row.viewer_uploader, row.admin] as boolean[]).map((ok, i) => (
                        <td key={i} className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ok ? "bg-orange-50 text-pwc-orange" : "bg-gray-100 text-gray-400"}`}>
                            {ok ? "접근 가능" : "접근 불가"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 안내 박스 */}
              <div className="mt-5 bg-pwc-gray-50 rounded-lg px-4 py-3 border border-pwc-gray-200">
                <p className="text-xs text-pwc-gray-600">
                  <span className="font-semibold">페이지 설정 안내</span> — 관리자는 모든 메뉴에 접근 가능합니다.
                  고객사 역할은 계정 등록 시 지정하며, 이후 계정 수정에서 변경할 수 있습니다.
                </p>
              </div>
            </div>

            {/* 확인 버튼 */}
            <div className="flex justify-end px-7 pb-6">
              <button onClick={() => setRoleModalOpen(false)} className="btn-primary px-8">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
