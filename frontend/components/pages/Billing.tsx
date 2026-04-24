"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchBillingEntries, fetchBillingStats, fetchBillingMaster, fetchBillingExceptions,
  completeBillingEntry, markBillingDeposit, reimportBilling, updateBillingEntry,
  syncBillingFromReports,
  type BillingEntry, type BillingMaster, type BillingException, type BillingStats,
} from "@/lib/api";
import { useDarkMode } from "@/hooks/useDarkMode";

type Tab = "pending" | "completed" | "master" | "exceptions";

export default function Billing() {
  const isDark = useDarkMode();
  const [tab, setTab] = useState<Tab>("pending");
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [master, setMaster] = useState<BillingMaster[]>([]);
  const [exceptions, setExceptions] = useState<BillingException[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [parentFilter, setParentFilter] = useState<string>("");
  const [selected, setSelected] = useState<BillingEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── 다크모드 색상 ─────────────────────────────────────────
  const bgCard = isDark ? "#1C1F26" : "#fff";
  const bgSub  = isDark ? "#252830" : "#FAFAFA";
  const bdr    = isDark ? "#2E3039" : "#E0E0E0";
  const bdr2   = isDark ? "#2E3039" : "#F0F0F0";
  const txtP   = isDark ? "#E2E5EC" : "#2C2C2C";
  const txtS   = isDark ? "#9198A8" : "#666";
  const txtDim = isDark ? "#5A6070" : "#999";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadStats = () => fetchBillingStats().then(setStats).catch(() => setStats(null));
  const loadEntries = (status: "pending" | "completed") => {
    setLoading(true);
    fetchBillingEntries({ status, q: q || undefined, parent: parentFilter || undefined })
      .then(r => setEntries(r.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };
  const loadMaster = () => {
    setLoading(true);
    fetchBillingMaster().then(r => setMaster(r.master))
      .catch(() => setMaster([])).finally(() => setLoading(false));
  };
  const loadExceptions = () => {
    setLoading(true);
    fetchBillingExceptions().then(r => setExceptions(r.exceptions))
      .catch(() => setExceptions([])).finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    if (tab === "pending" || tab === "completed") loadEntries(tab);
    else if (tab === "master") loadMaster();
    else if (tab === "exceptions") loadExceptions();
  }, [tab, q, parentFilter]);

  const parents = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { if (e.parent) set.add(e.parent); });
    return Array.from(set).sort();
  }, [entries]);

  const fmtAmt = (v: number | null | undefined) =>
    v == null ? "-" : Math.round(v).toLocaleString("ko-KR");

  const handleComplete = async (id: number) => {
    if (!confirm("이 건을 완료 처리할까요?")) return;
    try {
      await completeBillingEntry(id);
      showToast("완료 처리되었습니다.");
      loadStats(); loadEntries("pending");
      setSelected(null);
    } catch { showToast("처리 중 오류가 발생했습니다."); }
  };

  const handleDeposit = async (id: number) => {
    const input = prompt("입금 일자 (YYYY-MM-DD, 비우면 오늘)");
    if (input === null) return;
    try {
      await markBillingDeposit(id, input || undefined);
      showToast("입금 일자가 기록되었습니다.");
      loadStats(); loadEntries("completed");
    } catch { showToast("처리 중 오류가 발생했습니다."); }
  };

  const handleReimport = async () => {
    if (!confirm("Asset/Easy View 빌링현황.xlsm 을 다시 읽어 DB를 업데이트할까요?")) return;
    try {
      const r = await reimportBilling();
      showToast(`재import 완료: 신규 ${r.entry_inserted} / 갱신 ${r.entry_updated}`);
      loadStats();
      if (tab === "pending" || tab === "completed") loadEntries(tab);
    } catch { showToast("엑셀 파일을 찾지 못했거나 import 실패"); }
  };

  const handleSyncFromReports = async () => {
    if (!confirm("리포트 관리의 reviewing/active 상태 리포트를 스캔해서 청구 건을 자동 생성할까요?")) return;
    try {
      const r = await syncBillingFromReports();
      const skipMsg = r.skipped_no_master > 0 ? ` (매칭 실패 ${r.skipped_no_master})` : "";
      showToast(`동기화 완료: 신규 ${r.created}건${skipMsg}`);
      loadStats();
      if (tab === "pending") loadEntries("pending");
    } catch { showToast("동기화 실패"); }
  };

  const handleMemoSave = async (id: number, memo: string) => {
    try {
      await updateBillingEntry(id, { memo });
      showToast("비고가 저장되었습니다.");
      loadEntries(tab === "pending" ? "pending" : "completed");
    } catch { showToast("저장 실패"); }
  };

  // ── 스타일 ────────────────────────────────────────────────
  const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, color: isDark ? "#9198A8" : "#555", textAlign: "center" as const, whiteSpace: "nowrap", background: bgSub, borderBottom: `1px solid ${bdr}` };
  const td: React.CSSProperties = { padding: "11px 12px", whiteSpace: "nowrap", fontSize: 12.5, borderBottom: `1px solid ${bdr2}`, color: txtP };
  const cardSt: React.CSSProperties = { background: bgCard, borderRadius: 10, padding: "16px 20px", boxShadow: isDark ? "0 1px 4px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.2)" : "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)" };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px", background: "none", border: "none",
    borderBottom: active ? "2px solid #E87722" : "2px solid transparent",
    color: active ? "#E87722" : txtS,
    fontWeight: active ? 700 : 500,
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
    marginBottom: -1, transition: "all .15s",
  });

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 80, right: 24, zIndex: 1000,
          background: isDark ? "#2E3039" : "#333", color: "#fff",
          padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
        }}>{toast}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: txtP, margin: 0, marginBottom: 4 }}>청구 관리</h1>
          <p style={{ fontSize: 12, color: txtS, margin: 0 }}>Easy View 빌링현황 — 대기중 / 완료 / 계약 마스터 / 특이사항</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSyncFromReports}
            title="리포트 관리의 reviewing/active 상태 리포트 → 청구 건 자동 생성"
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              background: "#fff", color: "#E87722", border: "1px solid #E87722",
              borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
            }}
          >리포트 → 청구 동기화</button>
          <button
            onClick={handleReimport}
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              background: "#E87722", color: "#fff", border: "none",
              borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
            }}
          >엑셀 재import</button>
        </div>
      </div>

      {/* ── KPI ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
          <StatCard label="빌링 대기중" value={`${stats.pending.toLocaleString("ko-KR")}건`} color="#E87722" isDark={isDark} />
          <StatCard label="이번 달 세금계산서 예정" value={`${stats.month_invoice.toLocaleString("ko-KR")}건`} color="#2563EB" isDark={isDark} />
          <StatCard label="대기 계약 총액" value={`${stats.pending_amount.toLocaleString("ko-KR")} 원`} color="#16A34A" isDark={isDark} />
          <StatCard label="미입금" value={`${stats.unpaid.toLocaleString("ko-KR")}건`} color="#EF4444" isDark={isDark} />
          <StatCard label="완료" value={`${stats.completed.toLocaleString("ko-KR")}건`} color="#7C3AED" isDark={isDark} />
        </div>
      )}

      {/* ── 탭 ── */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${bdr}`, marginBottom: 16 }}>
        <button onClick={() => setTab("pending")} style={tabBtn(tab === "pending")}>
          대기중 {stats ? `(${stats.pending.toLocaleString("ko-KR")})` : ""}
        </button>
        <button onClick={() => setTab("completed")} style={tabBtn(tab === "completed")}>
          완료 {stats ? `(${stats.completed.toLocaleString("ko-KR")})` : ""}
        </button>
        <button onClick={() => setTab("master")} style={tabBtn(tab === "master")}>계약 마스터</button>
        <button onClick={() => setTab("exceptions")} style={tabBtn(tab === "exceptions")}>특이사항</button>
      </div>

      {/* ── 툴바 ── */}
      {(tab === "pending" || tab === "completed") && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="모회사 / 자회사 / 관리번호 / 담당자 검색"
            style={{
              flex: 1, maxWidth: 360, padding: "8px 12px", fontSize: 12,
              border: `1px solid ${bdr}`, borderRadius: 6, fontFamily: "inherit",
              background: bgCard, color: txtP, outline: "none",
            }}
          />
          <select
            value={parentFilter}
            onChange={e => setParentFilter(e.target.value)}
            style={{
              padding: "8px 12px", fontSize: 12, border: `1px solid ${bdr}`,
              borderRadius: 6, fontFamily: "inherit", background: bgCard, color: txtP,
              cursor: "pointer",
            }}
          >
            <option value="">모든 모회사</option>
            {parents.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={{ fontSize: 11, color: txtDim }}>{entries.length}건</span>
        </div>
      )}

      {/* ── 콘텐츠 영역 ── */}
      <div style={{ ...cardSt, padding: 0, overflow: "hidden" }}>
        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: txtDim, fontSize: 12 }}>로딩 중...</div>
        )}

        {!loading && (tab === "pending" || tab === "completed") && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>모회사</th>
                  <th style={th}>자회사</th>
                  <th style={th}>관리번호</th>
                  <th style={th}>기준월</th>
                  <th style={th}>세금계산서일</th>
                  <th style={th}>담당자</th>
                  <th style={th}>금액 (원)</th>
                  <th style={th}>상태</th>
                  {tab === "completed" && <th style={th}>입금일</th>}
                  <th style={th}>액션</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr><td colSpan={tab === "completed" ? 10 : 9} style={{ ...td, textAlign: "center", color: txtDim, padding: 40 }}>
                    데이터가 없습니다.
                  </td></tr>
                )}
                {entries.map(e => (
                  <tr key={e.id} style={{ cursor: "pointer", background: selected?.id === e.id ? (isDark ? "rgba(232,119,34,0.10)" : "rgba(232,119,34,0.06)") : undefined }}
                    onClick={() => setSelected(e)}>
                    <td style={td}>{e.parent ?? "-"}</td>
                    <td style={td}>{e.subsidiary ?? "-"}</td>
                    <td style={{ ...td, color: txtS, fontSize: 11.5 }}>{e.mgmt_no ?? "-"}</td>
                    <td style={td}>{e.report_ym ?? "-"}</td>
                    <td style={td}>{e.invoice_date ?? "-"}</td>
                    <td style={td}>{e.assignee ?? "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtAmt(e.amount)}</td>
                    <td style={td}>
                      <StatusBadge text={e.status ?? "-"} />
                    </td>
                    {tab === "completed" && (
                      <td style={td}>{e.deposit_date ?? <span style={{ color: "#EF4444", fontSize: 11 }}>미입금</span>}</td>
                    )}
                    <td style={td}>
                      {tab === "pending" ? (
                        <button onClick={(ev) => { ev.stopPropagation(); handleComplete(e.id); }} style={actBtn}>완료</button>
                      ) : !e.deposit_date ? (
                        <button onClick={(ev) => { ev.stopPropagation(); handleDeposit(e.id); }} style={actBtn}>입금 기록</button>
                      ) : <span style={{ color: txtDim, fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === "master" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>관리번호</th>
                  <th style={th}>모회사</th>
                  <th style={th}>계약대상</th>
                  <th style={th}>금액 (원)</th>
                  <th style={th}>세금계산서 담당자</th>
                  <th style={th}>이메일</th>
                  <th style={th}>연락처</th>
                  <th style={th}>발행요청일</th>
                </tr>
              </thead>
              <tbody>
                {master.length === 0 && (
                  <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: txtDim, padding: 40 }}>데이터가 없습니다.</td></tr>
                )}
                {master.map(m => (
                  <tr key={m.id}>
                    <td style={{ ...td, color: txtS, fontSize: 11.5 }}>{m.mgmt_no ?? "-"}</td>
                    <td style={td}>{m.parent ?? "-"}</td>
                    <td style={td}>{m.company ?? "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtAmt(m.amount)}</td>
                    <td style={td}>{m.invoice_manager ?? "-"}</td>
                    <td style={{ ...td, fontSize: 11.5, color: txtS }}>{m.manager_email ?? "-"}</td>
                    <td style={{ ...td, fontSize: 11.5, color: txtS }}>{m.manager_phone ?? "-"}</td>
                    <td style={td}>{m.invoice_request_day ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && tab === "exceptions" && (
          <div style={{ padding: 16 }}>
            {exceptions.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: txtDim, fontSize: 12 }}>특이사항이 없습니다.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {exceptions.map(ex => (
                  <div key={ex.id} style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${bdr2}`, background: bgSub }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, background: "rgba(232,119,34,0.12)", color: "#E87722", fontWeight: 600 }}>{ex.category ?? "-"}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: txtP }}>{ex.parent ?? "-"}</span>
                    </div>
                    <p style={{ fontSize: 12, color: txtS, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ex.note ?? ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 상세 패널 ── */}
      {selected && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 420, zIndex: 900,
          background: bgCard, borderLeft: `1px solid ${bdr}`, padding: 24,
          overflowY: "auto", boxShadow: "-4px 0 16px rgba(0,0,0,0.12)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: txtP }}>청구 상세</h3>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: txtS, fontSize: 18 }}>×</button>
          </div>
          <DetailRow label="모회사" value={selected.parent} txtP={txtP} txtS={txtS} />
          <DetailRow label="자회사" value={selected.subsidiary} txtP={txtP} txtS={txtS} />
          <DetailRow label="관리번호" value={selected.mgmt_no} txtP={txtP} txtS={txtS} />
          <DetailRow label="담당자 (EY)" value={selected.assignee} txtP={txtP} txtS={txtS} />
          <DetailRow label="리포트 기준월" value={selected.report_ym} txtP={txtP} txtS={txtS} />
          <DetailRow label="리포트 전달월" value={selected.delivery_ym} txtP={txtP} txtS={txtS} />
          <DetailRow label="빌링 작업일" value={selected.billing_date} txtP={txtP} txtS={txtS} />
          <DetailRow label="세금계산서일" value={selected.invoice_date} txtP={txtP} txtS={txtS} />
          <DetailRow label="금액" value={fmtAmt(selected.amount) + " 원"} txtP={txtP} txtS={txtS} />
          <DetailRow label="빌링 상태" value={selected.status} txtP={txtP} txtS={txtS} />
          <DetailRow label="입금 일자" value={selected.deposit_date} txtP={txtP} txtS={txtS} />
          <DetailRow label="세금계산서 담당자" value={selected.invoice_manager} txtP={txtP} txtS={txtS} />
          <DetailRow label="이메일" value={selected.manager_email} txtP={txtP} txtS={txtS} />
          <DetailRow label="연락처" value={selected.manager_phone} txtP={txtP} txtS={txtS} />
          <DetailRow label="발행요청일" value={selected.invoice_request_day} txtP={txtP} txtS={txtS} />
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: txtDim, marginBottom: 6, fontWeight: 600 }}>비고</div>
            <MemoEditor
              initial={selected.memo ?? ""} bdr={bdr} bgCard={bgCard} txtP={txtP}
              onSave={async (m) => { await handleMemoSave(selected.id, m); setSelected({ ...selected, memo: m }); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────
function StatCard({ label, value, color, isDark }: { label: string; value: string; color: string; isDark: boolean }) {
  return (
    <div style={{
      background: isDark ? "#1C1F26" : "#fff",
      borderRadius: 10, padding: "14px 16px",
      boxShadow: isDark ? "0 1px 4px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.2)" : "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: isDark ? "#9198A8" : "#666", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: isDark ? "#E2E5EC" : "#2C2C2C" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ text }: { text: string }) {
  const color = text.includes("완료") ? "#16A34A" : text.includes("대기") ? "#E87722" : "#999";
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 4,
      background: `${color}22`, color, fontWeight: 600, whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

function DetailRow({ label, value, txtP, txtS }: { label: string; value: string | null | undefined; txtP: string; txtS: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 12 }}>
      <div style={{ minWidth: 110, color: txtS, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, color: txtP, wordBreak: "break-word" }}>{value ?? "-"}</div>
    </div>
  );
}

function MemoEditor({ initial, bdr, bgCard, txtP, onSave }: { initial: string; bdr: string; bgCard: string; txtP: string; onSave: (m: string) => void }) {
  const [text, setText] = useState(initial);
  const [dirty, setDirty] = useState(false);
  return (
    <div>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setDirty(e.target.value !== initial); }}
        rows={4}
        style={{
          width: "100%", padding: 10, fontSize: 12, fontFamily: "inherit",
          border: `1px solid ${bdr}`, borderRadius: 6, background: bgCard, color: txtP,
          resize: "vertical", outline: "none", boxSizing: "border-box",
        }}
      />
      {dirty && (
        <button
          onClick={() => { onSave(text); setDirty(false); }}
          style={{
            marginTop: 6, padding: "6px 14px", fontSize: 11, fontWeight: 600,
            background: "#E87722", color: "#fff", border: "none", borderRadius: 5,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >저장</button>
      )}
    </div>
  );
}

const actBtn: React.CSSProperties = {
  padding: "4px 10px", fontSize: 11, fontWeight: 600,
  background: "#E87722", color: "#fff", border: "none",
  borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
};
