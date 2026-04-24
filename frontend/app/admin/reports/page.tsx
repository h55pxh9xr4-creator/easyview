"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { adminReportsApi, adminCompaniesApi } from "@/lib/admin-api";
import { showToast } from "../_components/Toast";

// ── 타입 ─────────────────────────────────────────────────────
interface ReportFile {
  id: number; reportId: number; fileType: string;
  originalName: string; size: number; uploadedBy: string; uploadedAt: string;
}
interface Report {
  id: number; dataRequestId: number | null; company: string; title: string;
  period: string; status: string; version: number; isActive: boolean;
  generatedBy: string; generatedAt: string;
  reviewedBy: string; reviewedAt: string; activatedAt: string; createdAt: string;
  files?: Record<string, ReportFile>;
}
interface Company { id: number; name: string; subsidiary_name?: string; subsidiaries?: { id: number; name: string }[]; }

// ── 상태 배지 ────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; cls: string }> = {
  upload:             { label: "파일 대기",  cls: "bg-gray-100 text-gray-600" },
  pending_generation: { label: "생성 대기",  cls: "bg-yellow-100 text-yellow-700" },
  generated:          { label: "생성 완료",  cls: "bg-blue-100 text-blue-700" },
  reviewing:          { label: "검토 중",    cls: "bg-purple-100 text-purple-700" },
  active:             { label: "활성",       cls: "bg-green-100 text-green-700" },
  archived:           { label: "보관",       cls: "bg-gray-100 text-gray-500" },
};
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── 드래그앤드롭 업로드 카드 ──────────────────────────────────
function UploadZone({
  label, description, accept, required, file, onFile, disabled,
}: {
  label: string; description: string; accept: string;
  required: boolean; file: File | null;
  onFile: (f: File) => void; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div className="bg-white rounded-xl border border-pwc-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-pwc-black">{label}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          required ? "bg-pwc-orange text-white" : "bg-pwc-gray-100 text-pwc-gray-600"
        }`}>{required ? "필수" : "선택"}</span>
      </div>
      <p className="text-xs text-pwc-gray-400 mb-3">{description}</p>

      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 py-8 px-4 ${
          disabled
            ? "border-pwc-gray-200 bg-pwc-gray-50 cursor-default"
            : file
            ? "border-green-400 bg-green-50 cursor-pointer"
            : dragging
            ? "border-pwc-orange bg-orange-50 cursor-pointer"
            : required
            ? "border-pwc-orange bg-orange-50/40 cursor-pointer hover:bg-orange-50"
            : "border-pwc-gray-300 bg-pwc-gray-50 cursor-pointer hover:bg-pwc-gray-100"
        }`}
      >
        {file ? (
          <>
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-700 text-center max-w-xs truncate">{file.name}</p>
            <p className="text-xs text-green-500">{fmtSize(file.size)} · 클릭하여 재선택</p>
          </>
        ) : (
          <>
            <svg className={`w-7 h-7 ${required ? "text-pwc-orange" : "text-pwc-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-pwc-gray-500">클릭하여 파일을 선택하세요</p>
            <p className="text-xs text-pwc-gray-400">{accept.replaceAll(",", ", ")}</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ── 업로드 탭 ────────────────────────────────────────────────
function UploadTab({ onRefresh }: { onRefresh: () => void }) {
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentYear = now.getFullYear();
  const [year, setYear] = useState(prevMonthDate.getFullYear());
  const [month, setMonth] = useState(prevMonthDate.getMonth() + 1);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedParent, setSelectedParent] = useState<Company | null>(null);
  const [selectedSub, setSelectedSub] = useState<{ id: number; name: string } | null>(null);
  const [jeFile, setJeFile] = useState<File | null>(null);
  const [tbFile, setTbFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminCompaniesApi.list()
      .then((d: { companies: Company[] }) => setCompanies(d.companies ?? []))
      .catch(() => {});
  }, []);

  const period = `${year}-${String(month).padStart(2, "0")}`;
  const canGenerate = !!selectedParent && !!jeFile && !!tbFile;

  const handleParentClick = (c: Company) => {
    if (selectedParent?.id === c.id) {
      setSelectedParent(null);
      setSelectedSub(null);
    } else {
      setSelectedParent(c);
      setSelectedSub(null);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setSubmitting(true);
    const companyName = selectedParent!.name;
    const subName = selectedSub?.name;
    const title = subName
      ? `${companyName} - ${subName} ${year}년 ${month}월 리포트`
      : `${companyName} ${year}년 ${month}월 리포트`;
    try {
      const rep: Report = await adminReportsApi.create({ company: companyName, period, title });
      await adminReportsApi.uploadFile(rep.id, "JE", jeFile!);
      await adminReportsApi.uploadFile(rep.id, "TB", tbFile!);
      const res = await adminReportsApi.generate(rep.id);
      showToast(res.message ?? "리포트 생성을 시작했습니다.", "success");
      setJeFile(null); setTbFile(null);
      setSelectedParent(null); setSelectedSub(null);
      onRefresh();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "오류 발생", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex gap-6 items-start">
      {/* ── 왼쪽 패널 ── */}
      <div className="w-60 flex-shrink-0 space-y-4 sticky top-0">
        {/* 결산 기간 */}
        <div className="bg-white rounded-xl border border-pwc-gray-200 p-5">
          <h3 className="text-sm font-semibold text-pwc-black mb-4">결산 기간</h3>

          <div className="mb-3">
            <label className="block text-xs text-pwc-gray-500 mb-1">연도</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="input-field text-sm"
            >
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-pwc-gray-500 mb-2">월</label>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    month === m
                      ? "bg-pwc-orange text-white"
                      : "bg-pwc-gray-100 text-pwc-gray-600 hover:bg-pwc-gray-200"
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 py-2 px-3 bg-pwc-gray-50 rounded-lg text-center">
            <span className="text-sm font-semibold text-pwc-black">{year}년 {month}월</span>
          </div>
        </div>

        {/* 대상 회사 — 2단계 선택 */}
        <div className="bg-white rounded-xl border border-pwc-gray-200 p-5">
          <h3 className="text-sm font-semibold text-pwc-black mb-3">대상 회사</h3>
          {companies.length === 0 ? (
            <p className="text-xs text-pwc-gray-400 text-center py-4">등록된 회사 없음</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {companies.map(c => {
                const subs = c.subsidiaries ?? [];
                const isParentSelected = selectedParent?.id === c.id;
                return (
                  <div key={c.id}>
                    {/* 모회사 버튼 */}
                    <button
                      onClick={() => handleParentClick(c)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between ${
                        isParentSelected
                          ? "border-pwc-orange bg-orange-50 ring-1 ring-pwc-orange"
                          : "border-pwc-gray-200 hover:border-pwc-gray-300 hover:bg-pwc-gray-50"
                      }`}
                    >
                      <p className="text-sm font-medium text-pwc-black leading-tight">{c.name}</p>
                      {subs.length > 0 && (
                        <svg
                          className={`w-3.5 h-3.5 text-pwc-gray-400 flex-shrink-0 transition-transform ${isParentSelected ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {/* 자회사 목록 (모회사 선택 시 표시) */}
                    {isParentSelected && subs.length > 0 && (
                      <div className="ml-3 mt-1 space-y-1">
                        {subs.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedSub(selectedSub?.id === sub.id ? null : sub)}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                              selectedSub?.id === sub.id
                                ? "border-pwc-orange bg-orange-50 ring-1 ring-pwc-orange font-medium text-pwc-black"
                                : "border-pwc-gray-200 hover:border-pwc-gray-300 hover:bg-pwc-gray-50 text-pwc-gray-600"
                            }`}
                          >
                            ↳ {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 선택 요약 */}
          {selectedParent && (
            <div className="mt-3 py-2 px-3 bg-orange-50 rounded-lg text-xs">
              <span className="font-semibold text-pwc-orange">{selectedParent.name}</span>
              {selectedSub && (
                <span className="text-pwc-gray-600"> › {selectedSub.name}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 오른쪽 패널 ── */}
      <div className="flex-1 space-y-4">
        {!selectedParent && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
            왼쪽에서 대상 회사를 선택하세요.
          </div>
        )}

        <UploadZone
          label="분개장 (JE) / 계정원장 (GL)"
          description="Journal Entry 또는 General Ledger 파일을 업로드합니다. (CSV, Excel, TXT)"
          accept=".csv,.xlsx,.xls,.txt"
          required
          file={jeFile}
          onFile={setJeFile}
          disabled={!selectedParent}
        />

        <UploadZone
          label="시산표 (TB)"
          description="Trial Balance 파일을 업로드합니다. (CSV, Excel, TXT)"
          accept=".csv,.xlsx,.xls,.txt"
          required
          file={tbFile}
          onFile={setTbFile}
          disabled={!selectedParent}
        />

        {/* 생성 버튼 */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-pwc-gray-400">
            {!selectedParent && "회사 선택 필요"}
            {selectedParent && !jeFile && "JE 파일 업로드 필요"}
            {selectedParent && jeFile && !tbFile && "TB 파일 업로드 필요"}
            {canGenerate && (
              <span className="text-green-600 font-medium">
                {selectedParent.name}{selectedSub ? ` - ${selectedSub.name}` : ""} · {year}년 {month}월 · JE + TB 준비 완료
              </span>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || submitting}
            className="btn-primary px-6 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "생성 중…" : "리포트 생성"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 현황 탭 ──────────────────────────────────────────────────
const STATUS_GROUPS = [
  { key: "all",       label: "전체" },
  { key: "generated", label: "생성 완료" },
  { key: "reviewing", label: "검토 중" },
  { key: "active",    label: "활성" },
  { key: "archived",  label: "보관" },
];

function StatusTab({ reports, onRefresh }: { reports: Report[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState("all");
  const [acting, setActing] = useState<number | null>(null);

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  const changeStatus = async (reportId: number, status: string, label: string) => {
    if (!confirm(`이 리포트를 "${label}" 상태로 변경하시겠습니까?`)) return;
    setActing(reportId);
    try {
      const res = await adminReportsApi.updateStatus(reportId, status);
      showToast(res.message ?? "변경 완료", "success");
      onRefresh();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "변경 실패", "error");
    } finally { setActing(null); }
  };

  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {STATUS_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => setFilter(g.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === g.key
                ? "bg-pwc-orange text-white"
                : "bg-pwc-gray-100 text-pwc-gray-600 hover:bg-pwc-gray-200"
            }`}
          >
            {g.label}
            <span className="ml-1 opacity-70">
              ({g.key === "all" ? reports.length : reports.filter(r => r.status === g.key).length})
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-pwc-gray-400 text-sm">해당 상태의 리포트가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                {["법인", "제목", "기간", "버전", "상태", "생성일", "검토자", "활성화일", ""].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`border-b border-pwc-gray-100 hover:bg-pwc-gray-50 ${r.isActive ? "bg-green-50" : ""}`}>
                  <td className="py-3 px-4 font-medium text-pwc-black">{r.company}</td>
                  <td className="py-3 px-4 text-pwc-gray-700 max-w-[180px] truncate" title={r.title}>{r.title}</td>
                  <td className="py-3 px-4 text-pwc-gray-600 text-xs">{r.period || "—"}</td>
                  <td className="py-3 px-4 text-center text-pwc-gray-500 text-xs">v{r.version}</td>
                  <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-4 text-xs text-pwc-gray-500 whitespace-nowrap">{r.generatedAt ? r.generatedAt.slice(0, 16) : "—"}</td>
                  <td className="py-3 px-4 text-xs text-pwc-gray-500">{r.reviewedBy || "—"}</td>
                  <td className="py-3 px-4 text-xs text-pwc-gray-500 whitespace-nowrap">{r.activatedAt ? r.activatedAt.slice(0, 16) : "—"}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {r.status === "generated" && (
                        <button
                          onClick={() => changeStatus(r.id, "reviewing", "검토 중")}
                          disabled={acting === r.id}
                          className="text-xs px-2.5 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-50 cursor-pointer disabled:opacity-50"
                        >
                          검토 승인
                        </button>
                      )}
                      {r.status === "reviewing" && (
                        <>
                          <button
                            onClick={() => changeStatus(r.id, "active", "활성")}
                            disabled={acting === r.id}
                            className="btn-primary text-xs py-1 px-2.5 disabled:opacity-50"
                          >
                            리포트 반영
                          </button>
                          <button
                            onClick={() => changeStatus(r.id, "generated", "생성 완료")}
                            disabled={acting === r.id}
                            className="text-xs px-2.5 py-1 rounded border border-pwc-gray-300 text-pwc-gray-600 hover:bg-pwc-gray-50 cursor-pointer disabled:opacity-50"
                          >
                            반려
                          </button>
                        </>
                      )}
                      {r.status === "active" && (
                        <button
                          onClick={() => changeStatus(r.id, "archived", "보관")}
                          disabled={acting === r.id}
                          className="text-xs px-2.5 py-1 rounded border border-pwc-gray-300 text-pwc-gray-500 hover:bg-pwc-gray-50 cursor-pointer disabled:opacity-50"
                        >
                          보관 처리
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState<"upload" | "status">("upload");
  const [reports, setReports] = useState<Report[]>([]);

  const loadReports = useCallback(async () => {
    try {
      const data = await adminReportsApi.list();
      setReports(data.reports ?? []);
    } catch { /* */ }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pwc-black">리포트 관리</h1>
        <p className="text-sm text-pwc-gray-500 mt-1">결산 기간과 대상 회사를 선택하고 JE / TB 파일을 업로드하여 리포트를 생성합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-pwc-gray-200">
        {([
          { key: "upload", label: "업로드" },
          { key: "status", label: "현황" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? "border-pwc-orange text-pwc-orange"
                : "border-transparent text-pwc-gray-500 hover:text-pwc-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className={tab === "upload" ? "" : "bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden"}>
        {tab === "upload" ? (
          <UploadTab onRefresh={loadReports} />
        ) : (
          <>
            <div className="px-6 py-3 border-b border-pwc-gray-200 bg-pwc-gray-50 text-sm text-pwc-gray-600">
              생성된 리포트의 검토 및 반영 상태를 관리합니다.
            </div>
            <div className="p-6">
              <StatusTab reports={reports} onRefresh={loadReports} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
