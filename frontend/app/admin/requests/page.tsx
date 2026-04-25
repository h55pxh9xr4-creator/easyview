"use client";

import { useState, useEffect, useCallback } from "react";
import { adminRequestsApi } from "@/lib/admin-api";
import ToastContainer, { showToast } from "../_components/Toast";

interface Request {
  id: number; requester_id: number; requester_name: string; target_name: string; target_email: string;
  reason: string | null; status: string; reviewer_id: number | null; reviewer_name: string | null; created_at: string | null;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filter !== "all") params.status = filter;
      const data = await adminRequestsApi.list(params);
      setRequests(data.requests || []); setTotal(data.total || 0);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.", "error");
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const approveRequest = async (id: number) => {
    try { setActionLoading(id); await adminRequestsApi.approve(id); showToast("신청이 승인되었습니다.", "success"); await fetchRequests(); }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : "승인 처리에 실패했습니다.", "error"); }
    finally { setActionLoading(null); }
  };

  const rejectRequest = async (id: number) => {
    try { setActionLoading(id); await adminRequestsApi.reject(id); showToast("신청이 반려되었습니다.", "warning"); await fetchRequests(); }
    catch (err: unknown) { showToast(err instanceof Error ? err.message : "반려 처리에 실패했습니다.", "error"); }
    finally { setActionLoading(null); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: "bg-yellow-100 text-yellow-700", label: "대기" },
      approved: { cls: "bg-green-100 text-green-700", label: "승인" },
      rejected: { cls: "bg-red-100 text-red-700", label: "반려" },
    };
    const s = map[status];
    return s ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span> : null;
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">사용자 추가 신청</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">사용자 추가 신청 목록을 확인하고 승인/반려 처리합니다.</p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-pwc-orange text-white text-sm font-medium px-4 py-2 rounded-lg">{pendingCount}건 대기중</div>
        )}
      </div>

      <div className="flex gap-2">
        {([{ key: "all", label: "전체" }, { key: "pending", label: "대기" }, { key: "approved", label: "승인" }, { key: "rejected", label: "반려" }] as const).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${filter === f.key ? "bg-pwc-orange text-white" : "bg-white text-pwc-gray-600 border border-pwc-gray-200 hover:bg-pwc-gray-50"}`}
          >{f.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
        <div className="px-6 py-3 border-b border-pwc-gray-200 bg-pwc-gray-50">
          <span className="text-sm text-pwc-gray-600">총 {total}건</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pwc-orange"></div>
            </div>
          ) : (
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                  {["신청자", "추가 대상", "대상 이메일", "사유", "신청일", "상태", "처리"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-pwc-gray-100 hover:bg-pwc-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-pwc-orange flex items-center justify-center text-white text-xs font-medium flex-shrink-0">{req.requester_name[0]}</div>
                        <span className="font-medium text-pwc-black">{req.requester_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-pwc-gray-700">{req.target_name}</td>
                    <td className="py-3 px-4 text-pwc-gray-500 text-xs">{req.target_email}</td>
                    <td className="py-3 px-4 text-pwc-gray-600 max-w-[200px] truncate">{req.reason}</td>
                    <td className="py-3 px-4 text-pwc-gray-500">{req.created_at?.slice(0, 10)}</td>
                    <td className="py-3 px-4">{statusBadge(req.status)}</td>
                    <td className="py-3 px-4">
                      {req.status === "pending" ? (
                        <div className="flex gap-1">
                          <button onClick={() => approveRequest(req.id)} disabled={actionLoading === req.id} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors disabled:opacity-50 cursor-pointer">{actionLoading === req.id ? "..." : "승인"}</button>
                          <button onClick={() => rejectRequest(req.id)} disabled={actionLoading === req.id} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors disabled:opacity-50 cursor-pointer">{actionLoading === req.id ? "..." : "반려"}</button>
                        </div>
                      ) : <span className="text-xs text-pwc-gray-400">처리 완료</span>}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-pwc-gray-400">해당 조건의 신청 내역이 없습니다.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
