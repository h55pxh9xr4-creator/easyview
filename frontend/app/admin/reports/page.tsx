"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { adminReportsApi } from "@/lib/admin-api";
import { showToast } from "../_components/Toast";

// ── 타입 ──────────────────────────────────────────────────────
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
interface AcceptedRequest {
  id: number; reqCode: string; title: string; entity: string;
  requester: string; createdAt: string;
  report: Report | null;
  files: Record<string, ReportFile>;
}

// ── 상태 배지 ─────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; cls: string }> = {
  upload:             { label: "파일 대기",   cls: "bg-gray-100 text-gray-600" },
  pending_generation: { label: "생성 대기",   cls: "bg-yellow-100 text-yellow-700" },
  generated:          { label: "생성 완료",   cls: "bg-blue-100 text-blue-700" },
  reviewing:          { label: "검토 중",     cls: "bg-purple-100 text-purple-700" },
  active:             { label: "활성",        cls: "bg-green-100 text-green-700" },
  archived:           { label: "보관",        cls: "bg-gray-100 text-gray-500" },
};
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── 파일 업로드 셀 ───────────────────────────────────────────
function FileCell({
  label, fileInfo, reportId, fileType, onUploaded, disabled,
}: {
  label: string; fileInfo?: ReportFile; reportId: number;
  fileType: "JE" | "TB"; onUploaded: () => void; disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await adminReportsApi.uploadFile(reportId, fileType, file);
      showToast(`${label} 업로드 완료`, "success");
      onUploaded();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "업로드 실패", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      {fileInfo ? (
        <span className="flex items-center gap-1 text-xs text-green-700 font-medium truncate max-w-[140px]" title={fileInfo.originalName}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="truncate">{fileInfo.originalName}</span>
          <span className="text-gray-400 flex-shrink-0">({fmt(fileInfo.size)})</span>
        </span>
      ) : (
        <span className="text-xs text-gray-400">{label} 미업로드</span>
      )}
      {!disabled && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 text-xs px-2 py-1 rounded border border-pwc-gray-300 text-pwc-gray-600 hover:bg-pwc-gray-50 cursor-pointer disabled:opacity-50"
          >
            {uploading ? "업로드 중…" : fileInfo ? "재업로드" : "업로드"}
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </>
      )}
    </div>
  );
}

// ── 업로드 탭 ────────────────────────────────────────────────
function UploadTab({ onRefresh }: { onRefresh: () => void }) {
  const [rows, setRows] = useState<AcceptedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMap, setPeriodMap] = useState<Record<number, string>>({});
  const [starting, setStarting] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminReportsApi.acceptedRequests();
      setRows(data.requests ?? []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startReport = async (reqId: number) => {
    setStarting(reqId);
    try {
      await adminReportsApi.create({ data_request_id: reqId, period: periodMap[reqId] ?? "" });
      showToast("리포트 업로드를 시작합니다.", "success");
      await load(); onRefresh();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "오류 발생", "error");
    } finally { setStarting(null); }
  };

  const generate = async (reportId: number) => {
    setGenerating(reportId);
    try {
      const res = await adminReportsApi.generate(reportId);
      showToast(res.message ?? "생성 시작", "success");
      setTimeout(() => { load(); onRefresh(); }, 1500);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "생성 실패", "error");
    } finally { setGenerating(null); }
  };

  if (loading) return <div className="py-12 text-center text-pwc-gray-400">불러오는 중...</div>;
  if (rows.length === 0) return (
    <div className="py-16 text-center text-pwc-gray-400">
      <p className="text-sm">Accept된 자료 요청이 없습니다.</p>
      <p className="text-xs mt-1">자료실에서 요청을 Accept하면 여기에 표시됩니다.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
            {["요청 코드", "제목", "법인", "요청자", "Accept일", "기간", "JE 파일", "TB 파일", ""].map(h => (
              <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const rep = row.report;
            const hasJE = !!(rep ? row.files["JE"] : false);
            const hasTB = !!(rep ? row.files["TB"] : false);
            const canGenerate = rep && hasJE && hasTB && ["upload", "pending_generation"].includes(rep.status);
            const isDone = rep && !["upload", "pending_generation"].includes(rep.status);

            return (
              <tr key={row.id} className="border-b border-pwc-gray-100 hover:bg-pwc-gray-50">
                <td className="py-3 px-4 font-mono text-xs text-pwc-gray-500">{row.reqCode}</td>
                <td className="py-3 px-4 font-medium text-pwc-black max-w-[180px] truncate" title={row.title}>{row.title}</td>
                <td className="py-3 px-4 text-pwc-gray-700">{row.entity}</td>
                <td className="py-3 px-4 text-pwc-gray-600 text-xs">{row.requester}</td>
                <td className="py-3 px-4 text-pwc-gray-500 text-xs whitespace-nowrap">{row.createdAt}</td>
                <td className="py-3 px-4">
                  {rep ? (
                    <span className="text-xs text-pwc-gray-600">{rep.period || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="예) 2025-Q4"
                      value={periodMap[row.id] ?? ""}
                      onChange={e => setPeriodMap(p => ({ ...p, [row.id]: e.target.value }))}
                      className="input-field text-xs py-1 w-24"
                    />
                  )}
                </td>
                <td className="py-3 px-4">
                  {rep ? (
                    <FileCell
                      label="JE" fileInfo={row.files["JE"]} reportId={rep.id}
                      fileType="JE" onUploaded={load} disabled={isDone ?? false}
                    />
                  ) : <span className="text-xs text-pwc-gray-300">—</span>}
                </td>
                <td className="py-3 px-4">
                  {rep ? (
                    <FileCell
                      label="TB" fileInfo={row.files["TB"]} reportId={rep.id}
                      fileType="TB" onUploaded={load} disabled={isDone ?? false}
                    />
                  ) : <span className="text-xs text-pwc-gray-300">—</span>}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {!rep ? (
                    <button
                      onClick={() => startReport(row.id)}
                      disabled={starting === row.id}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {starting === row.id ? "시작 중…" : "업로드 시작"}
                    </button>
                  ) : isDone ? (
                    <StatusBadge status={rep.status} />
                  ) : (
                    <button
                      onClick={() => generate(rep.id)}
                      disabled={!canGenerate || generating === rep.id}
                      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {generating === rep.id ? "생성 중…" : "리포트 생성"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 현황 탭 ──────────────────────────────────────────────────
const STATUS_GROUPS = [
  { key: "all",      label: "전체" },
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
      <div className="flex gap-1 mb-4">
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

// ── 메인 페이지 ───────────────────────────────────────────────
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
        <p className="text-sm text-pwc-gray-500 mt-1">자료실 Accept 데이터로 리포트를 생성하고 배포를 관리합니다.</p>
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
      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
        <div className="px-6 py-3 border-b border-pwc-gray-200 bg-pwc-gray-50 text-sm text-pwc-gray-600">
          {tab === "upload" ? (
            <span>Accept된 자료 요청에 JE / TB 파일을 업로드하고 리포트를 생성합니다.</span>
          ) : (
            <span>생성된 리포트의 검토 및 반영 상태를 관리합니다.</span>
          )}
        </div>
        <div className="p-6">
          {tab === "upload" && <UploadTab onRefresh={loadReports} />}
          {tab === "status" && <StatusTab reports={reports} onRefresh={loadReports} />}
        </div>
      </div>
    </div>
  );
}
