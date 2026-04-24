"use client";

import { useState, useEffect, useCallback } from "react";
import { adminAuditApi } from "@/lib/admin-api";
import { downloadCSV } from "@/lib/admin-export";

interface LogEntry {
  id: number; timestamp: string | null; actor: string; action_type: string; detail: string; target: string; ip_address: string;
}

const typeBadge = (type: string) => {
  const map: Record<string, string> = {
    "로그인": "bg-green-100 text-green-700", "리포트 열람": "bg-blue-100 text-blue-700",
    "리포트 다운로드": "bg-indigo-100 text-indigo-700", "권한 변경": "bg-orange-100 text-orange-700",
    "사용자 비활성화": "bg-red-100 text-red-700", "사용자 추가 요청": "bg-purple-100 text-purple-700",
    "요청 승인": "bg-emerald-100 text-emerald-700", "요청 반려": "bg-rose-100 text-rose-700",
    "그룹 생성": "bg-cyan-100 text-cyan-700", "비밀번호 초기화": "bg-yellow-100 text-yellow-700",
  };
  const cls = map[type] || "bg-gray-100 text-gray-700";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{type}</span>;
};

export default function LogsPage() {
  const [typeFilter, setTypeFilter] = useState("전체");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dailyStats, setDailyStats] = useState<{ date: string; count: number }[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), page_size: "10" };
      if (typeFilter !== "전체") params.action_type = typeFilter;
      const data = await adminAuditApi.list(params);
      setLogs(data.logs || []); setTotalLogs(data.total || 0); setTotalPages(data.total_pages || 1);
    } catch { setLogs([]); } finally { setLoading(false); }
  }, [page, typeFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { adminAuditApi.stats().then((d) => setDailyStats(d.daily_stats || [])).catch(() => {}); }, []);

  const maxVisitors = dailyStats.length > 0 ? Math.max(...dailyStats.map((v) => v.count)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pwc-black">로그/방문이력</h1>
          <p className="text-sm text-pwc-gray-500 mt-1">시스템 접근 기록과 주요 변경 이력을 확인합니다.</p>
        </div>
        <button onClick={() => downloadCSV(logs as unknown as Record<string, unknown>[], [
          { key: "timestamp", label: "일시" }, { key: "actor", label: "수행자" },
          { key: "action_type", label: "유형" }, { key: "detail", label: "상세" },
          { key: "target", label: "대상" }, { key: "ip_address", label: "IP" },
        ], "활동로그")} className="btn-secondary text-sm">엑셀 추출</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-pwc-gray-500 mb-1">유형</label>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="input-field">
              <option value="전체">전체</option>
              {["로그인", "리포트 열람", "리포트 다운로드", "권한 변경", "사용자 추가 요청", "요청 승인", "요청 반려"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 p-6">
        <h3 className="font-semibold text-pwc-black mb-6">일별 활동 수</h3>
        {dailyStats.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-pwc-gray-400">데이터가 없습니다.</div>
        ) : (
          <div className="flex items-end gap-6 h-48">
            {dailyStats.map((item) => (
              <div key={item.date} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-pwc-gray-500 font-medium">{item.count}</span>
                <div className="w-full bg-pwc-orange rounded-t-md bar-animate" style={{ height: `${(item.count / maxVisitors) * 160}px` }} />
                <span className="text-xs text-pwc-gray-500">{item.date.slice(5).replace("-", "/")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-pwc-gray-200 overflow-hidden" style={{ padding: 0 }}>
        <div className="px-6 py-4 border-b border-pwc-gray-200 bg-pwc-gray-50">
          <h3 className="font-semibold text-pwc-black">변경 이력 {!loading && <span className="text-sm font-normal text-pwc-gray-500">({totalLogs}건)</span>}</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-pwc-gray-400">로딩 중...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b border-pwc-gray-200 bg-pwc-gray-50">
                    {["일시", "수행자", "유형", "상세", "대상", "IP"].map((h) => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-pwc-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-pwc-gray-100 hover:bg-pwc-gray-50 transition-colors">
                      <td className="py-3 px-4 text-pwc-gray-600 whitespace-nowrap">{log.timestamp?.slice(0, 16)}</td>
                      <td className="py-3 px-4 font-medium text-pwc-black">{log.actor}</td>
                      <td className="py-3 px-4">{typeBadge(log.action_type)}</td>
                      <td className="py-3 px-4 text-pwc-gray-700">{log.detail}</td>
                      <td className="py-3 px-4 text-pwc-gray-600">{log.target}</td>
                      <td className="py-3 px-4 text-pwc-gray-500 font-mono text-xs">{log.ip_address}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-pwc-gray-400">해당 조건의 로그가 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-pwc-gray-200">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded border border-pwc-gray-200 disabled:opacity-40 hover:bg-pwc-gray-50">이전</button>
                <span className="text-sm text-pwc-gray-600">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm rounded border border-pwc-gray-200 disabled:opacity-40 hover:bg-pwc-gray-50">다음</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
