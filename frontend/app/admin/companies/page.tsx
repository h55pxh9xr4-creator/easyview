"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "../_components/Toast";
import { adminCompaniesApi } from "@/lib/admin-api";

interface Subsidiary { id: number; name: string; }
interface Company {
  id: number;
  name: string;
  subsidiaries?: Subsidiary[];
  biz_start?: string;
  biz_end?: string;
  country?: string;
  company_type?: string;
  contract_start?: string;
  contract_end?: string;
  base_currency?: string;
  base_period?: string;
}

// 자회사 항목 (id 없으면 새로 추가, _delete=true면 삭제 대상)
interface SubEntry { id?: number; name: string; _delete?: boolean; }

type View = "list" | "register" | "edit";

const EMPTY_FORM = {
  name: "", biz_start: "", biz_end: "",
  country: "", company_type: "", contract_start: "", contract_end: "",
  base_currency: "", base_period: "",
};

export default function CompaniesPage() {
  const [view, setView] = useState<View>("list");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [subEntries, setSubEntries] = useState<SubEntry[]>([]);
  const [subInputVal, setSubInputVal] = useState("");

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminCompaniesApi.list();
      setCompanies(data.companies ?? []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filtered = companies.filter((c) =>
    !search ||
    c.name.includes(search) ||
    (c.subsidiaries ?? []).some(s => s.name.includes(search)) ||
    (c.country ?? "").includes(search)
  );

  const openRegister = () => {
    setForm(EMPTY_FORM);
    setSubEntries([]);
    setSubInputVal("");
    setEditTarget(null);
    setView("register");
  };

  const openEdit = (c: Company) => {
    setEditTarget(c);
    setForm({
      name: c.name,
      biz_start: c.biz_start ?? "", biz_end: c.biz_end ?? "",
      country: c.country ?? "", company_type: c.company_type ?? "",
      contract_start: c.contract_start ?? "", contract_end: c.contract_end ?? "",
      base_currency: c.base_currency ?? "", base_period: c.base_period ?? "",
    });
    setSubEntries((c.subsidiaries ?? []).map(s => ({ id: s.id, name: s.name })));
    setSubInputVal("");
    setView("edit");
  };

  const addSub = () => {
    const trimmed = subInputVal.trim();
    if (!trimmed) return;
    setSubEntries(prev => [...prev, { name: trimmed }]);
    setSubInputVal("");
  };

  const removeSub = (idx: number) => {
    setSubEntries(prev => prev.map((s, i) => i === idx ? { ...s, _delete: true } : s));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name) { showToast("회사명을 입력해주세요.", "error"); return; }
    setSaving(true);
    const dateFields = ["biz_start", "biz_end", "contract_start", "contract_end"] as const;
    const payload: Record<string, unknown> = { ...form };
    dateFields.forEach((k) => { if (!payload[k]) payload[k] = null; });
    try {
      if (view === "edit" && editTarget) {
        await adminCompaniesApi.update(editTarget.id, payload);
        // 삭제 대상 자회사
        for (const sub of subEntries) {
          if (sub._delete && sub.id) {
            await adminCompaniesApi.deleteSubsidiary(sub.id);
          }
        }
        // 새 자회사 추가
        for (const sub of subEntries) {
          if (!sub.id && !sub._delete) {
            await adminCompaniesApi.createSubsidiary({ name: sub.name, company_id: editTarget.id });
          }
        }
        showToast("수정 완료", "success");
      } else {
        const created = await adminCompaniesApi.create(payload);
        for (const sub of subEntries.filter(s => !s._delete)) {
          await adminCompaniesApi.createSubsidiary({ name: sub.name, company_id: created.id });
        }
        showToast(`${form.name} 회사가 등록되었습니다.`, "success");
      }
      await fetchCompanies();
      setView("list");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "저장 실패", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (c: Company) => {
    if (!confirm(`${c.name}을(를) 삭제하시겠습니까?`)) return;
    try {
      await adminCompaniesApi.delete(c.id);
      showToast("삭제 완료", "success");
      await fetchCompanies();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "삭제 실패", "error");
    }
  };

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // ── 등록/수정 화면 ──
  if (view === "register" || view === "edit") {
    const isEdit = view === "edit";
    const visibleSubs = subEntries.filter(s => !s._delete);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-2 rounded hover:bg-pwc-gray-100 text-pwc-gray-500 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-pwc-black">{isEdit ? "회사 정보 수정" : "회사 등록"}</h1>
            <p className="text-sm text-pwc-gray-500 mt-1">회사 정보와 자회사 목록을 관리합니다.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">

              {/* 기본 정보 */}
              <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
                <h3 className="text-sm font-semibold text-pwc-black mb-4">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">회사명 *</label>
                    <input type="text" value={form.name} onChange={f("name")} className="input-field" placeholder="삼성전자" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">회사 유형</label>
                    <select value={form.company_type} onChange={f("company_type")} className="input-field">
                      <option value="">선택 안 함</option>
                      <option value="대기업">대기업</option>
                      <option value="중견기업">중견기업</option>
                      <option value="중소기업">중소기업</option>
                      <option value="스타트업">스타트업</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 자회사 목록 */}
              <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
                <h3 className="text-sm font-semibold text-pwc-black mb-4">자회사 목록</h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* 왼쪽: 국가 */}
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">국가</label>
                    <input type="text" value={form.country} onChange={f("country")} className="input-field" placeholder="Korea" />
                  </div>

                  {/* 오른쪽: 자회사 */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-medium text-pwc-gray-700">자회사</label>
                      {visibleSubs.length === 0 && (
                        <span className="text-xs text-pwc-gray-400">등록된 자회사가 없습니다.</span>
                      )}
                    </div>

                    <div className="space-y-2 mb-2">
                      {subEntries.map((sub, idx) => sub._delete ? null : (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="flex-1 px-3 py-2 bg-pwc-gray-50 rounded border border-pwc-gray-200 text-sm text-pwc-black">
                            {sub.name}
                            {!sub.id && <span className="ml-2 text-xs text-pwc-orange font-medium">새로 추가</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSub(idx)}
                            className="p-1.5 rounded hover:bg-red-50 text-pwc-gray-400 hover:text-red-500 cursor-pointer"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={subInputVal}
                        onChange={e => setSubInputVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                        placeholder="자회사명 입력 후 Enter"
                        className="input-field flex-1 text-sm"
                      />
                      <button type="button" onClick={addSub} className="btn-primary px-4 py-2 text-sm">
                        + 추가
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 영업 기간 */}
              <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
                <h3 className="text-sm font-semibold text-pwc-black mb-4">영업 기간</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">시작일</label>
                    <input type="date" value={form.biz_start} onChange={f("biz_start")} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">종료일</label>
                    <input type="date" value={form.biz_end} onChange={f("biz_end")} className="input-field" />
                  </div>
                </div>
              </div>

              {/* 계약 정보 */}
              <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
                <h3 className="text-sm font-semibold text-pwc-black mb-4">계약 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">계약 시작일</label>
                    <input type="date" value={form.contract_start} onChange={f("contract_start")} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">계약 종료일</label>
                    <input type="date" value={form.contract_end} onChange={f("contract_end")} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">기준 통화</label>
                    <select value={form.base_currency} onChange={f("base_currency")} className="input-field">
                      <option value="">선택 안 함</option>
                      <option value="KRW">KRW (원)</option>
                      <option value="USD">USD (달러)</option>
                      <option value="EUR">EUR (유로)</option>
                      <option value="JPY">JPY (엔)</option>
                      <option value="CNY">CNY (위안)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pwc-gray-700 mb-1">기준 분기</label>
                    <select value={form.base_period} onChange={f("base_period")} className="input-field">
                      <option value="">선택 안 함</option>
                      <option value="Q1">Q1</option>
                      <option value="Q2">Q2</option>
                      <option value="Q3">Q3</option>
                      <option value="Q4">Q4</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 오른쪽 버튼 */}
            <div className="space-y-4">
              <div className="bg-pwc-gray-50 rounded-xl border border-pwc-gray-200 p-5">
                <h4 className="text-xs font-semibold text-pwc-gray-600 mb-3">입력 안내</h4>
                <ul className="space-y-2 text-xs text-pwc-gray-500">
                  <li>· 회사명은 필수입니다.</li>
                  <li>· 자회사는 여러 개 추가할 수 있습니다.</li>
                  <li>· 계약 기간은 EasyView 서비스 계약 기간입니다.</li>
                  <li>· 기준 통화/분기는 리포트 기본값으로 사용됩니다.</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-5 space-y-2">
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saving ? "저장 중..." : isEdit ? "수정" : "등록"}
                </button>
                <button type="button" onClick={() => setView("list")} className="w-full text-sm px-4 py-2 rounded border border-pwc-gray-300 text-pwc-gray-700 hover:bg-pwc-gray-50 cursor-pointer">취소</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ── 목록 화면 ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">회사 관리</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">계약 회사 및 자회사 정보를 관리합니다.</p>
        </div>
        <button onClick={openRegister} className="btn-primary">+ 회사 등록</button>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-5">
        <div className="max-w-sm">
          <label className="block text-xs font-medium text-pwc-gray-500 mb-1">검색</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="회사명, 자회사명, 국가" className="input-field" />
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
        <div className="px-6 py-3 border-b border-pwc-gray-200 bg-pwc-gray-50">
          <span className="text-sm text-pwc-gray-600">총 {filtered.length}개사</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? <div className="py-12 text-center text-pwc-gray-400">불러오는 중...</div> : (
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                  {["회사명", "자회사 (국가)", "유형", "계약기간", "기준 통화/분기", "관리"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-pwc-gray-100 hover:bg-pwc-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-pwc-black">{c.name}</td>
                    <td className="py-3 px-4 text-pwc-gray-600">
                      {(c.subsidiaries ?? []).length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {c.country && (
                            <span className="text-xs text-pwc-gray-400">{c.country}</span>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {(c.subsidiaries ?? []).map(s => (
                              <span key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-pwc-gray-100 text-pwc-gray-700">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-pwc-gray-400">{c.country || "-"}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {c.company_type
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.company_type}</span>
                        : <span className="text-pwc-gray-400">-</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-pwc-gray-600">
                      {c.contract_start && c.contract_end
                        ? `${c.contract_start} ~ ${c.contract_end}`
                        : c.contract_start ? `${c.contract_start} ~` : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs text-pwc-gray-600">
                      {[c.base_currency, c.base_period].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-pwc-gray-100 text-pwc-gray-500 hover:text-blue-600 cursor-pointer" title="수정">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-1.5 rounded hover:bg-red-50 text-pwc-gray-500 hover:text-red-600 cursor-pointer" title="삭제">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-pwc-gray-400">검색 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
