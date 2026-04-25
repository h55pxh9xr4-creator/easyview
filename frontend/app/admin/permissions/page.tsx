"use client";

import { useState, useEffect, useCallback } from "react";
import { adminPermissionsApi, adminUsersApi } from "@/lib/admin-api";
import ToastContainer, { showToast } from "../_components/Toast";

interface ReportPerm { id: number; report_name: string; role: string; can_view: boolean; can_download: boolean; can_print: boolean; can_share: boolean; can_comment: boolean; }
interface UserPerm { id: number; user_id: number; user_name: string; user_email: string; can_view_report: boolean; can_upload: boolean; can_pdf: boolean; can_excel: boolean; can_print: boolean; can_share: boolean; can_comment: boolean; can_request_user: boolean; }

type Tab = "matrix" | "detail";

export default function PermissionsPage() {
  const [tab, setTab] = useState<Tab>("matrix");
  const [reportPerms, setReportPerms] = useState<ReportPerm[]>([]);
  const [userPerms, setUserPerms] = useState<UserPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "matrix") {
        const data = await adminPermissionsApi.matrix();
        setReportPerms(data.permissions || []);
      } else {
        const data = await adminPermissionsApi.detail();
        setUserPerms(data.permissions || []);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleReportPerm = (id: number, field: keyof ReportPerm) => {
    setReportPerms((prev) => prev.map((p) => p.id === id ? { ...p, [field]: !p[field as keyof ReportPerm] } : p));
  };

  const toggleUserPerm = (userId: number, field: keyof UserPerm) => {
    setUserPerms((prev) => prev.map((p) => p.user_id === userId ? { ...p, [field]: !p[field as keyof UserPerm] } : p));
  };

  const saveMatrix = async () => {
    setSaving(true);
    try {
      await adminPermissionsApi.updateMatrix(reportPerms);
      showToast("리포트 권한이 저장되었습니다.", "success");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "저장 실패", "error"); }
    finally { setSaving(false); }
  };

  const saveDetail = async () => {
    setSaving(true);
    try {
      await adminPermissionsApi.updateDetail(userPerms);
      showToast("사용자 권한이 저장되었습니다.", "success");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "저장 실패", "error"); }
    finally { setSaving(false); }
  };

  const MATRIX_FIELDS: (keyof ReportPerm)[] = ["can_view", "can_download", "can_print", "can_share", "can_comment"];
  const MATRIX_LABELS = ["열람", "다운로드", "인쇄", "공유", "코멘트"];
  const USER_FIELDS: (keyof UserPerm)[] = ["can_view_report", "can_upload", "can_pdf", "can_excel", "can_print", "can_share", "can_comment", "can_request_user"];
  const USER_LABELS = ["리포트열람", "업로드", "PDF", "Excel", "인쇄", "공유", "코멘트", "사용자신청"];

  const reportNames = [...new Set(reportPerms.map((p) => p.report_name))];

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">리포트 접근 권한</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">역할별 리포트 권한과 사용자별 개별 권한을 관리합니다.</p>
        </div>
        <button onClick={tab === "matrix" ? saveMatrix : saveDetail} disabled={saving} className="btn-primary">{saving ? "저장 중..." : "저장"}</button>
      </div>

      <div className="flex gap-2">
        {([{ key: "matrix", label: "역할별 권한" }, { key: "detail", label: "사용자별 권한" }] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? "bg-pwc-orange text-white" : "bg-white text-pwc-gray-600 border border-pwc-gray-200 hover:bg-pwc-gray-50"}`}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="flex items-center justify-center py-20 text-pwc-gray-400">로딩 중...</div> : tab === "matrix" ? (
        <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                  <th className="text-left py-3 px-6 font-medium text-pwc-gray-500">리포트</th>
                  <th className="text-left py-3 px-4 font-medium text-pwc-gray-500">역할</th>
                  {MATRIX_LABELS.map((l) => <th key={l} className="text-center py-3 px-3 font-medium text-pwc-gray-500">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {reportNames.map((rn) => {
                  const perms = reportPerms.filter((p) => p.report_name === rn);
                  return perms.map((p, idx) => (
                    <tr key={p.id} className="border-b border-pwc-gray-100 hover:bg-pwc-gray-50">
                      {idx === 0 && <td className="py-3 px-6 font-medium text-pwc-black" rowSpan={perms.length}>{rn}</td>}
                      <td className="py-3 px-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.role === "admin" ? "bg-red-100 text-red-700" : p.role === "manager" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{p.role}</span></td>
                      {MATRIX_FIELDS.map((f) => (
                        <td key={f} className="py-3 px-3 text-center">
                          <input type="checkbox" checked={p[f] as boolean} onChange={() => toggleReportPerm(p.id, f)} className="w-4 h-4 rounded" style={{ accentColor: "#d04a02" }} />
                        </td>
                      ))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                  <th className="text-left py-3 px-6 font-medium text-pwc-gray-500">사용자</th>
                  {USER_LABELS.map((l) => <th key={l} className="text-center py-3 px-2 font-medium text-pwc-gray-500 text-xs">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {userPerms.map((p) => (
                  <tr key={p.user_id} className="border-b border-pwc-gray-100 hover:bg-pwc-gray-50">
                    <td className="py-3 px-6">
                      <p className="font-medium text-pwc-black">{p.user_name}</p>
                      <p className="text-xs text-pwc-gray-500">{p.user_email}</p>
                    </td>
                    {USER_FIELDS.map((f) => (
                      <td key={f} className="py-3 px-2 text-center">
                        <input type="checkbox" checked={p[f] as boolean} onChange={() => toggleUserPerm(p.user_id, f)} className="w-4 h-4 rounded" style={{ accentColor: "#d04a02" }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {userPerms.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-pwc-gray-400">데이터가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
