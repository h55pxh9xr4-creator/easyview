"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  fetchRequests, createRequests, updateRequest, deleteRequest,
  fetchRequestFiles, uploadRequestFile, deleteRequestFile, getFileUrl,
  type DataRequest as ApiRequest, type ReqFile,
} from "@/lib/api";
import ChatBot from "@/components/ui/ChatBot";


/* ── types ── */
type SidebarPage = "requests";
type UserTab = "pwc" | "client" | "thirdparty" | "all";
type ReqStatus = "Draft" | "Requested" | "Submitted" | "Accepted" | "Recall";
type ReqPriority = "높음" | "보통" | "낮음";

type Request = ApiRequest & { status: ReqStatus; priority: ReqPriority };

/* ── 기본 데이터 (API 미연결 시 fallback) ── */
const FALLBACK_REQUESTS: Request[] = [
  { id: 1,  reqCode: "REQ-001", title: "재무제표 원본 제출",            entity: "SeAH Global Vina (SGV)",      assignee: "Chanwoo Lee",     requester: "Yerim Jeong",    status: "Accepted",  priority: "높음", dueDate: "2026-02-28", createdDate: "2026-01-10", description: "2025 회계연도 감사를 위한 베트남 법인 재무제표 원본 및 관련 주석 제출 요청" },
  { id: 2,  reqCode: "REQ-002", title: "고정자산 목록 및 감가상각 일정표", entity: "SeAH Besteel Holdings",       assignee: "Hongkyu Ahn",     requester: "Minjoo Kang",   status: "Submitted", priority: "높음", dueDate: "2026-03-15", createdDate: "2026-01-15", description: "2025년 말 기준 고정자산 목록, 취득/처분 내역, 감가상각 일정표 제출" },
  { id: 3,  reqCode: "REQ-003", title: "매출채권 연령분석표",            entity: "SeAH Global Inc (SGI)",       assignee: "Soojin Moon",     requester: "Seojin Na",     status: "Requested", priority: "보통", dueDate: "2026-03-20", createdDate: "2026-01-20", description: "2025.12.31 기준 매출채권 연령분석표(30/60/90/90일 초과 구분) 제출" },
  { id: 4,  reqCode: "REQ-004", title: "재고자산 실사 결과 보고서",      entity: "SeAH CTC",                    assignee: "Kwangseok Chae",  requester: "Yubin Choi",    status: "Requested", priority: "높음", dueDate: "2026-03-10", createdDate: "2026-01-25", description: "2025년 말 재고실사 결과 보고서 및 감사인 입회 확인서 제출" },
  { id: 5,  reqCode: "REQ-005", title: "은행잔액확인서",                 entity: "SeAH Global Japan (SGJ)",     assignee: "Naoko Ishikawa",  requester: "Sou-Jung Park", status: "Requested", priority: "보통", dueDate: "2026-03-05", createdDate: "2026-02-01", description: "2025.12.31 기준 전 금융기관 잔액확인서 (원본) 제출" },
  { id: 6,  reqCode: "REQ-006", title: "임직원 명부 및 급여대장",        entity: "SeAH Global Thailand (SGT)",  assignee: "Juseung Jeong",   requester: "Sanghee Sim",   status: "Requested", priority: "보통", dueDate: "2026-03-25", createdDate: "2026-02-05", description: "2025년 임직원 명부, 월별 급여대장, 퇴직금 충당부채 산출 근거 제출" },
  { id: 7,  reqCode: "REQ-007", title: "법인세 신고 자료",               entity: "PT SeAH (인니)",               assignee: "Erli na",         requester: "Yeowon Han",    status: "Draft",     priority: "낮음", dueDate: "2026-04-10", createdDate: "2026-02-10", description: "2025 회계연도 법인세 신고서 및 관련 세무조정 계산서 제출" },
  { id: 8,  reqCode: "REQ-008", title: "차입금 및 사채 명세서",          entity: "SeAH Global India (SGIN)",    assignee: "Sathis Gopinath", requester: "HyungGeun Jung",status: "Draft",     priority: "보통", dueDate: "2026-04-05", createdDate: "2026-02-12", description: "2025.12.31 기준 단기/장기 차입금, 사채 명세 및 이자비용 내역 제출" },
  { id: 9,  reqCode: "REQ-009", title: "특수관계자 거래 명세",           entity: "SeAH Besteel Holdings",       assignee: "SeungCheol Kim",  requester: "Chaehyeon Song",status: "Recall",    priority: "높음", dueDate: "2026-03-01", createdDate: "2026-01-28", description: "2025년 특수관계자 거래 명세(매출/매입/대여/차입 등) — 양식 불일치로 반려, 재제출 요망" },
  { id: 10, reqCode: "REQ-010", title: "계약서 사본 (주요 거래처)",      entity: "SeAH Global Vina (SGV)",      assignee: "Chanwoo Lee",     requester: "Sumin Jung",    status: "Submitted", priority: "낮음", dueDate: "2026-03-30", createdDate: "2026-02-15", description: "매출액 상위 5개 거래처 계약서 사본 및 거래조건 요약표 제출" },
];

/* ── theme ── */
const C = {
  primary:   "#E87722",
  primaryDk: "#D06010",
  primaryBg: "#FFF5EE",
  rowHover:  "#FFF8F3",
  border:    "#EDEDED",
  text:      "#2C2C2C",
  sub:       "#555",
  muted:     "#aaa",
  bg:        "#F5F5F5",
};

const PWC_USERS = [
  { name: "Yuna Cho",        email: "yuna.cho@pwc.com",             country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "13 Mar 2026" },
  { name: "Yubin Choi",      email: "yubin.y.choi@pwc.com",         country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "15 Apr 2026" },
  { name: "Seungyeon Han",   email: "seungyeon.s.han@pwc.com",      country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "10 Mar 2026" },
  { name: "Yeowon Han",      email: "yeowon.han@pwc.com",           country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "14 Apr 2026" },
  { name: "Yerim Jeong",     email: "yerim.jeong@pwc.com",          country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "16 Apr 2026" },
  { name: "Yewon Jeong",     email: "yewon.jeong@pwc.com",          country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "14 Apr 2026" },
  { name: "Yong-Wook Jun",   email: "yong-wook.jun@pwc.com",        country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "19 Dec 2023" },
  { name: "HyungGeun Jung",  email: "hyung-geun.jung@pwc.com",      country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "08 Aug 2025" },
  { name: "Sumin Jung",      email: "sumin.jung@pwc.com",           country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "14 Apr 2026" },
  { name: "Minjoo Kang",     email: "minjoo.j.kang@pwc.com",        country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "26 Jan 2026" },
  { name: "Hyeyeon Kim",     email: "hyeyeon.kim@pwc.com",          country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "10 Dec 2024" },
  { name: "JaeDong Kim",     email: "jae-dong.kim@pwc.com",         country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "28 Nov 2025" },
  { name: "Seojin Na",       email: "seojin.na@pwc.com",            country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "26 Nov 2025" },
  { name: "Sou-Jung Park",   email: "sou-jung.park@pwc.com",        country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "16 Apr 2026" },
  { name: "Sujung Ryu",      email: "sujung.ryu@pwc.com",           country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "13 Nov 2024" },
  { name: "Sanghee Sim",     email: "sanghee.sim@pwc.com",          country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "14 Apr 2026" },
  { name: "Chaehyeon Song",  email: "chaehyeon.song@pwc.com",       country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "22 Jan 2025" },
  { name: "Dong-Yeon Yoo",   email: "dongyeon.yoo@pwc.com",         country: "Korea, Republic of", status: "Active", role: "PwC Administrator", last: "14 Jun 2024" },
];

const CLIENT_USERS = [
  { name: "Hongkyu Ahn",      email: "ahnhk@seah.co.kr",            org: "SeAH Global Vina (SGV)",         country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "23 Apr 2025" },
  { name: "Kwangseok Chae",   email: "kwangseok.chae@seah.co.kr",   org: "世亚特材（浙江）有限公司",         country: "China",              status: "Active",   role: "Client - View Assignments Only",                          last: "16 Oct 2025" },
  { name: "Inseon Choi",      email: "ssuni3333@seah.co.kr",         org: "SeAH Besteel Holdings",           country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "12 Jul 2024" },
  { name: "Sathis Gopinath",  email: "gopinath@seah.co.kr",          org: "SeAH Besteel Holdings",           country: "India",              status: "Active",   role: "Client - View Assignments Only",                          last: "12 Mar 2026" },
  { name: "Jaesin Ha",        email: "stella.ha@seah.global",        org: "seah.global",                     country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "23 Sep 2024" },
  { name: "lian hong",        email: "lian.hong@seah.co.kr",         org: "pwc",                             country: "Korea, Republic of", status: "Active",   role: "Client - View All Unrestricted Requests",                 last: "31 Mar 2026" },
  { name: "Naoko Ishikawa",   email: "n_ishikawa@seahglobal.co.jp",  org: "세아베스틸지주",                  country: "Japan",              status: "Active",   role: "Client - View Assignments Only",                          last: "20 Feb 2026" },
  { name: "Juseung Jeong",    email: "jjs@seahctc.com",              org: "世亚特材（浙江）有限公司",         country: "China",              status: "Active",   role: "Client Request Manager - View Assignments Only",          last: "13 Apr 2026" },
  { name: "SeungCheol Kim",   email: "kimsc@seah.co.kr",             org: "SeAH Besteel Holdings",           country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "30 Sep 2024" },
  { name: "Chanwoo Lee",      email: "chanwoo.lee@seahgv.com",       org: "SeAH Global Vina (SGV)",          country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "18 Dec 2024" },
  { name: "Ki-hyeon Lee",     email: "wetnose@seah.co.kr",           org: "SeAH Besteel Holdings",           country: "Korea, Republic of", status: "Disabled", role: "Client - View Assignments Only",                          last: "—" },
  { name: "Soojin Moon",      email: "soojin.moon@seah.global",      org: "SeAH Global Inc",                 country: "Korea, Republic of", status: "Active",   role: "Client Request Manager - View Assignments Only",          last: "23 Mar 2026" },
  { name: "Erli na",          email: "erlina@irongrey.co",           org: "irongrey.co",                     country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "14 Apr 2026" },
  { name: "younha nam",       email: "younha.nam@seah.co.kr",        org: "세아베스틸지주",                  country: "Korea, Republic of", status: "Active",   role: "Client - View Assignments Only",                          last: "12 Apr 2026" },
  { name: "Hoang Dung Pham",  email: "hoangdung@seahgv.com",         org: "SeAH Besteel Holdings",           country: "Vietnam",            status: "Active",   role: "Client - View Assignments Only",                          last: "13 Apr 2026" },
  { name: "obuchi Yositaka",  email: "y_obuchi@seah.co.kr",          org: "SeAH Global Japan",               country: "Japan",              status: "Active",   role: "Client - View Assignments Only",                          last: "09 Apr 2026" },
];

const ENTITIES = ["SeAH Global Vina (SGV)", "SeAH Global Inc (SGI)", "SeAH CTC", "SeAH Global Japan (SGJ)", "SeAH Global Thailand (SGT)", "PT SeAH (인니)", "SeAH Global India (SGIN)", "SeAH Besteel Holdings"];

const PARENT_COMPANIES = ["세아베스틸지주", "세아홀딩스"];

const ASSIGNEES = ["Hongkyu Ahn", "Kwangseok Chae", "Inseon Choi", "Sathis Gopinath", "Jaesin Ha", "Naoko Ishikawa", "Juseung Jeong", "SeungCheol Kim", "Chanwoo Lee", "Soojin Moon", "Erli na", "younha nam", "Hoang Dung Pham", "obuchi Yositaka"];
const ASSIGNEE_EMAIL: Record<string, string> = Object.fromEntries(
  CLIENT_USERS.map(u => [u.name, u.email])
);
/* 법인별 담당 가능 Client 목록 */
const ENTITY_CLIENTS: Record<string, string[]> = {
  "SeAH Global Vina (SGV)":     ["Chanwoo Lee", "Hongkyu Ahn", "Hoang Dung Pham"],
  "SeAH Global Inc (SGI)":      ["Soojin Moon"],
  "SeAH CTC":                   ["Kwangseok Chae", "Juseung Jeong"],
  "SeAH Global Japan (SGJ)":    ["Naoko Ishikawa", "obuchi Yositaka"],
  "SeAH Global Thailand (SGT)": ["Juseung Jeong"],
  "PT SeAH (인니)":              ["Erli na"],
  "SeAH Global India (SGIN)":   ["Sathis Gopinath"],
  "SeAH Besteel Holdings":      ["Inseon Choi", "SeungCheol Kim", "younha nam", "Jaesin Ha", "Ki-hyeon Lee"],
};

const STATUS_TRANSITIONS: Record<ReqStatus, ReqStatus[]> = {
  "Draft":     ["Requested"],
  "Requested": ["Submitted"],
  "Submitted": ["Recall", "Accepted"],
  "Recall":    ["Submitted"],
  "Accepted":  [],
};

const STATUS_CFG: Record<ReqStatus, { bg: string; color: string }> = {
  "Draft":     { bg: "#F0F0F0", color: "#666" },
  "Requested": { bg: "#EBF0FD", color: "#1A56DB" },
  "Submitted": { bg: "#F3EEFF", color: "#7C3AED" },
  "Accepted":  { bg: "#E8F5E9", color: "#1B5E20" },
  "Recall":    { bg: "#FEECEC", color: "#B91C1C" },
};
const PRIORITY_CFG: Record<ReqPriority, { color: string }> = {
  "높음": { color: "#DC2626" },
  "보통": { color: "#E87722" },
  "낮음": { color: "#6B7280" },
};

const SIDEBAR_ITEMS: { key: SidebarPage; icon: string; label: string }[] = [
  { key: "requests", icon: "/icons/icon-journal.svg", label: "자료 요청" },
];

/* ── shared small components ── */
function StatusDot({ status }: { status: string }) {
  const ok = status === "Active";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: ok ? C.text : C.muted }}>
      <span style={{ width: 13, height: 13, borderRadius: "50%", background: ok ? "#4caf50" : "#ff9800", flexShrink: 0, display: "inline-block" }} />
      {status}
    </span>
  );
}

function IconBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32,
        border: `1px solid ${hov ? C.primary : "#ddd"}`,
        background: "#fff", borderRadius: 6,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, color: hov ? C.primary : "#666",
        transition: "all 0.15s", flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function OrangeBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "7px 18px", borderRadius: 6, border: "none",
        background: hov ? C.primaryDk : C.primary, color: "#fff",
        fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function GrayBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "7px 18px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", color: "#666", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      {label}
    </button>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: "8px 12px", fontSize: 11, fontWeight: 700,
      color: C.primary, background: "#FFF8F3",
      borderBottom: `2px solid ${C.primary}`,
      textAlign: "center", whiteSpace: "nowrap",
      textTransform: "uppercase", letterSpacing: "0.3px",
      position: "sticky", top: 0,
    }}>
      {children}
    </th>
  );
}

function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "11px 12px", fontSize: 13, borderBottom: "1px solid #f5f5f5", color: C.sub, verticalAlign: "middle", ...style }}>
      {children}
    </td>
  );
}

function CheckTH({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <th style={{ padding: "8px 12px", width: 40, textAlign: "center", background: "#FFF8F3", borderBottom: `2px solid ${C.primary}`, position: "sticky", top: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: C.primary, width: 14, height: 14, cursor: "pointer" }} />
    </th>
  );
}

function CheckTD({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <td style={{ padding: "11px 12px", textAlign: "center", borderBottom: "1px solid #f5f5f5" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: C.primary, width: 14, height: 14, cursor: "pointer" }} />
    </td>
  );
}

/* ── Card wrapper ── */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04)", padding: "20px 24px" }}>
        {children}
      </div>
    </div>
  );
}

/* ── Section title ── */
function SectionTitle({ title, count, selected }: { title: string; count?: number; selected?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, fontStyle: "italic", color: C.text, letterSpacing: "-0.3px" }}>
        {count !== undefined ? `${count} ` : ""}{title}
      </h2>
      {selected !== undefined && (
        <span style={{ fontSize: 13, color: C.muted }}>{selected} selected</span>
      )}
    </div>
  );
}

/* ── Modal ── */
function Modal({ title, onClose, onConfirm, confirmLabel, onSecondary, secondaryLabel, children, width = 580 }: {
  title: string; onClose: () => void; onConfirm: () => void; confirmLabel: string;
  onSecondary?: () => void; secondaryLabel?: string;
  children: React.ReactNode; width?: number;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", width, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", borderRadius: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "22px 28px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.primary }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "20px 28px" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 28px", background: "#fafafa", borderTop: `1px solid ${C.border}` }}>
          <OrangeBtn label={confirmLabel} onClick={onConfirm} />
          {onSecondary && secondaryLabel && <GrayBtn label={secondaryLabel} onClick={onSecondary} />}
          <GrayBtn label="Cancel" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function FRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 16 }}>{children}</div>;
}
function FGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#E53E3E", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
function FInput({ placeholder }: { placeholder: string }) {
  return (
    <input type="text" placeholder={placeholder}
      style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }}
      onFocus={e => (e.target.style.borderColor = C.primary)}
      onBlur={e => (e.target.style.borderColor = "#ddd")}
    />
  );
}
function FSelect({ options, defaultIdx }: { options: string[]; defaultIdx?: number }) {
  return (
    <select defaultValue={options[defaultIdx ?? 0]} style={{
      width: "100%", padding: "9px 32px 9px 12px", border: `1px solid ${C.primary}`, borderRadius: 6,
      fontSize: 13, appearance: "none", background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E") no-repeat right 12px center`,
      cursor: "pointer", boxSizing: "border-box",
    }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}
function FTextarea({ placeholder }: { placeholder: string }) {
  const [rem, setRem] = useState(650);
  return (
    <>
      <textarea placeholder={placeholder} maxLength={650} onChange={e => setRem(650 - e.target.value.length)}
        style={{ width: "100%", minHeight: 90, resize: "vertical", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
        onFocus={e => (e.target.style.borderColor = C.primary)}
        onBlur={e => (e.target.style.borderColor = "#ddd")}
      />
      <p style={{ textAlign: "right", fontSize: 11, color: C.muted, marginTop: 3 }}>{rem} characters remaining</p>
    </>
  );
}
function FCheck({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
      <input type="checkbox" defaultChecked={defaultChecked} style={{ accentColor: C.primary, width: 15, height: 15 }} />
      {label}
    </label>
  );
}

/* ── Toast ── */
function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", top: 60, right: 24,
      background: C.primary, color: "#fff",
      padding: "12px 22px", borderRadius: 8,
      fontSize: 13, fontWeight: 600, zIndex: 400,
      boxShadow: "0 4px 20px rgba(232,119,34,.35)",
    }}>
      {msg}
    </div>
  );
}

/* ═══════════════════ Main Component ═══════════════════ */
export default function ResourceRoom() {
  const [page, setPage]           = useState<SidebarPage>("requests");
  const [userTab, setUserTab]     = useState<UserTab>("pwc");
  const [modal, setModal]         = useState<"add-pwc" | "add-client" | "import" | "add-request" | null>(null);
  const [toast, setToast]         = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pwcSel, setPwcSel]       = useState<Record<number, boolean>>({});
  const [clientSel, setClientSel] = useState<Record<number, boolean>>({});
  const [requests, setRequests]             = useState<Request[]>([]);
  const [reqLoading, setReqLoading]         = useState(true);
  const [reqFilter, setReqFilter]           = useState<ReqStatus | "전체">("전체");
  const [detailReq, setDetailReq]           = useState<Request | null>(null);
  const [showCreate, setShowCreate]         = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isEditing, setIsEditing]           = useState(false);
  const [editDraft, setEditDraft]           = useState<{
    title: string; entity: string; assignees: string[];
    requester: string; dueDate: string; status: ReqStatus; description: string;
  } | null>(null);
  const [detailFiles, setDetailFiles]       = useState<ReqFile[]>([]);
  const [filesLoading, setFilesLoading]     = useState(false);
  const [uploading, setUploading]           = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const [groupByEntity, setGroupByEntity]   = useState(false);
  const [collapsed, setCollapsed]           = useState<Record<string, boolean>>({});
  const [entityFilter, setEntityFilter]     = useState<string>("전체");
  const [parentFilter, setParentFilter]     = useState<string>("전체");
  const [myOnly, setMyOnly]                 = useState(true);

  /* new-request form state */
  const [nTitle, setNTitle]         = useState("");
  const [nEntity, setNEntity]       = useState(ENTITIES[0]);
  const [nAssignees, setNAssignees] = useState<string[]>([]);
  const [nDue, setNDue]             = useState("");
  const [nDesc, setNDesc]           = useState("");
  const [nStatus, setNStatus]       = useState<ReqStatus>("Requested");
  const [nRequester, setNRequester] = useState(() =>
    typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? "") : ""
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };

  /* 요청 목록 로드 — API 실패 또는 빈 응답 시 fallback 데이터 사용 */
  const LS_KEY = "ev_requests_cache";
  const saveCache = (reqs: Request[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(reqs)); } catch { /* ignore */ }
  };
  const loadCache = (): Request[] | null => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as Request[]) : null;
    } catch { return null; }
  };

  const loadRequests = useCallback(async () => {
    try {
      setReqLoading(true);
      const data = await fetchRequests();
      if (data.length > 0) {
        const reqs = data as Request[];
        setRequests(reqs);
        saveCache(reqs);
      } else {
        const cached = loadCache();
        const reqs = cached ?? FALLBACK_REQUESTS;
        setRequests(reqs);
        if (!cached) saveCache(reqs);
      }
    } catch {
      const cached = loadCache();
      setRequests(cached ?? FALLBACK_REQUESTS);
    } finally { setReqLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  /* detailReq 변경 시 편집 모드 초기화 */
  useEffect(() => {
    setIsEditing(false);
    setEditDraft(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailReq?.id]);

  const startEditing = () => {
    if (!detailReq) return;
    setEditDraft({
      title:       detailReq.title,
      entity:      detailReq.entity,
      assignees:   detailReq.assignee ? detailReq.assignee.split(", ").map(s => s.trim()).filter(Boolean) : [],
      requester:   detailReq.requester,
      dueDate:     detailReq.dueDate === "—" ? "" : detailReq.dueDate,
      status:      detailReq.status,
      description: detailReq.description,
    });
    setIsEditing(true);
  };

  /* 상세 뷰 열릴 때 파일 목록 로드 */
  useEffect(() => {
    if (!detailReq) { setDetailFiles([]); return; }
    setFilesLoading(true);
    fetchRequestFiles(detailReq.id)
      .then(f => setDetailFiles(f))
      .catch(() => setDetailFiles([]))
      .finally(() => setFilesLoading(false));
  }, [detailReq?.id]);

  /* 파일 업로드 핸들러 */
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !detailReq) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const rf = await uploadRequestFile(detailReq.id, file, sessionStorage.getItem("ev_user") ?? "");
        setDetailFiles(prev => [rf, ...prev]);
      }
      showToast(`${files.length}개 파일이 업로드되었습니다.`);
    } catch { showToast("업로드 중 오류가 발생했습니다."); }
    finally { setUploading(false); }
  };

  const handleSaveEdit = async () => {
    if (!detailReq || !editDraft) return;
    const body = {
      title:       editDraft.title.trim(),
      entity:      editDraft.entity,
      assignee:    editDraft.assignees.join(", "),
      requester:   editDraft.requester.trim(),
      status:      editDraft.status,
      due_date:    editDraft.dueDate || "",
      description: editDraft.description,
    };
    const updatedReq: Request = {
      ...detailReq,
      title:       body.title,
      entity:      body.entity,
      assignee:    body.assignee,
      requester:   body.requester,
      status:      body.status as ReqStatus,
      dueDate:     body.due_date || "—",
      description: body.description,
    };
    try { await updateRequest(detailReq.id, body); } catch { /* backend down – update locally */ }
    setDetailReq(updatedReq);
    setRequests(prev => {
      const next = prev.map(r => r.id === detailReq.id ? updatedReq : r);
      saveCache(next);
      return next;
    });
    setIsEditing(false);
    setEditDraft(null);
    showToast("수정 사항이 저장되었습니다.");
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!detailReq) return;
    await deleteRequestFile(detailReq.id, fileId);
    setDetailFiles(prev => prev.filter(f => f.id !== fileId));
    showToast("파일이 삭제되었습니다.");
  };

  const resetNewForm = () => {
    setNTitle(""); setNDesc(""); setNDue(""); setNAssignees([]);
    setNEntity(ENTITIES[0]); setNStatus("Requested");
    setNRequester(typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? "") : "");
  };

  const closeModal   = () => setModal(null);
  const submitRequest = async (status: ReqStatus) => {
    if (!nTitle.trim())          { showToast("제목을 입력해주세요."); return; }
    if (!nDue)                   { showToast("마감일을 선택해주세요."); return; }
    if (nAssignees.length === 0) { showToast("담당자를 1명 이상 선택해주세요."); return; }

    const items = [{
      title:       nTitle.trim(),
      entity:      nEntity,
      assignee:    nAssignees.join(", "),
      requester:   nRequester.trim(),
      status,
      priority:    "보통",
      due_date:    nDue || "",
      description: nDesc,
    }];

    /* API 성공 시 DB 저장, 실패 시 로컬 state에 즉시 반영 */
    try {
      await createRequests(items);
      await loadRequests();
    } catch {
      const today = new Date().toISOString().slice(0, 10);
      const newReqs: Request[] = items.map((item, i) => ({
        id:          Date.now() + i,
        reqCode:     `REQ-${String(requests.length + i + 1).padStart(3, "0")}`,
        title:       item.title,
        entity:      item.entity,
        assignee:    item.assignee,
        requester:   item.requester,
        status:      item.status as ReqStatus,
        priority:    item.priority as ReqPriority,
        dueDate:     item.due_date || "—",
        createdDate: today,
        description: item.description,
      }));
      setRequests(prev => {
        const next = [...newReqs, ...prev];
        saveCache(next);
        return next;
      });
    }
    resetNewForm();
    closeModal();
    setShowCreate(false);
    showToast(status === "Draft"
      ? `Draft ${items.length}건이 저장되었습니다.`
      : `자료 요청 ${items.length}건이 등록되었습니다.`
    );
  };

  const confirmModal = () => {
    if (modal === "add-request") {
      submitRequest(nStatus);
      return;
    } else {
      const msgs: Record<string, string> = {
        "add-pwc":   "PwC 사용자가 추가되었습니다.",
        "add-client":"Client 사용자가 추가되었습니다.",
        import:      "사용자 Import가 완료되었습니다.",
      };
      if (modal) showToast(msgs[modal] ?? "");
    }
    closeModal();
  };

  const pwcSelected    = Object.values(pwcSel).filter(Boolean).length;
  const clientSelected = Object.values(clientSel).filter(Boolean).length;

  /* ── Sidebar ── */
  const SidebarEl = () => (
    <aside style={{ width: 250, flexShrink: 0, background: "#fff", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
      {SIDEBAR_ITEMS.map(item => {
        const active = page === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setPage(item.key)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 20px", width: "100%", textAlign: "left",
              cursor: "pointer", fontSize: 14, fontFamily: "inherit",
              background: active ? C.primaryBg : "transparent",
              color:      active ? C.primary   : "#444",
              fontWeight: active ? 600 : 400,
              border: "none", transition: "all 0.12s",
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "#F7F7F7"; (e.currentTarget as HTMLElement).style.color = "#333"; } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#444"; } }}
          >
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${item.icon}`}
              width={22} height={22} alt=""
              style={{ flexShrink: 0, opacity: 1 }}
            />
            {item.label}
          </button>
        );
      })}
    </aside>
  );

  /* ── Requests ── */
  const currentUser = typeof window !== "undefined" ? (sessionStorage.getItem("ev_user") ?? "") : "";
  const filteredReqs = requests.filter(r => {
    if (myOnly && currentUser && r.requester !== currentUser) return false;
    if (reqFilter !== "전체" && r.status !== reqFilter) return false;
    if (entityFilter !== "전체" && r.entity !== entityFilter) return false;
    return true;
  });

  /* 법인별 그룹핑 */
  const grouped: Record<string, Request[]> = {};
  filteredReqs.forEach(r => { (grouped[r.entity] ??= []).push(r); });
  const groupedEntities = ENTITIES.filter(e => grouped[e]);

  const toggleCollapse = (entity: string) =>
    setCollapsed(p => ({ ...p, [entity]: !p[entity] }));

  /* 공통 행 렌더러 */
  const StatusIcon = ({ status, color }: { status: ReqStatus; color: string }) => {
    const s = 14;
    const cx = 7, cy = 7, r = 6;
    if (status === "Draft") return (
      <svg width={s} height={s} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.8"/>
      </svg>
    );
    if (status === "Requested") return (
      <svg width={s} height={s} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.8"/>
        <path d={`M ${cx},${cy-r} A ${r},${r} 0 0,1 ${cx},${cy+r} L ${cx},${cy} Z`} fill={color}/>
      </svg>
    );
    if (status === "Recall") return (
      <svg width={s} height={s} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.8"/>
        <path d={`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-r},${cy} L ${cx},${cy} Z`} fill={color}/>
      </svg>
    );
    if (status === "Submitted") return (
      <svg width={s} height={s} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill={color}/>
      </svg>
    );
    if (status === "Accepted") return (
      <svg width={s} height={s} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill={color}/>
        <path d="M 4,7 L 6,9.5 L 10,4.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    return null;
  };

  const ReqRow = ({ req, hideEntity }: { req: Request; hideEntity?: boolean }) => {
    const sc = STATUS_CFG[req.status];
    return (
      <tr
        style={{ cursor: "pointer" }}
        onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
        onClick={() => setDetailReq(req)}
      >
        <TD style={{ color: C.muted, fontSize: 11, textAlign: "center" }}>{req.reqCode}</TD>
        <TD style={{ textAlign: "left" }}>
          <span style={{ fontWeight: 600, color: C.text }}>{req.title}</span>
        </TD>
        {!hideEntity && (
          <TD style={{ fontSize: 12, textAlign: "left", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.entity}</TD>
        )}
        <TD style={{ fontSize: 12, textAlign: "center" }}>{req.requester}</TD>
        <TD style={{ fontSize: 12, textAlign: "center" }}>{req.assignee}</TD>
        <TD style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
            <StatusIcon status={req.status} color={sc.color}/>
            {req.status}
          </span>
        </TD>
        <TD style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>{req.createdDate}</TD>
        <TD style={{ fontSize: 12, color: req.dueDate === "—" ? C.muted : C.sub, textAlign: "center" }}>{req.dueDate}</TD>
        <td style={{ padding: "11px 8px", borderBottom: "1px solid #f5f5f5", textAlign: "center" }}>
          <button
            onClick={e => { e.stopPropagation(); setDeleteConfirmId(req.id); }}
            style={{ color: C.primary, opacity: 0.55, background: "none", border: "none", cursor: "pointer", padding: 4, display: "inline-flex", alignItems: "center" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "0.55")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </td>
      </tr>
    );
  };

  const COLS_FLAT    = ["번호", "제목", "법인", "자료요청자", "법인담당자", "상태", "요청일", "마감일", ""];
  const COLS_GROUPED = ["번호", "제목", "자료요청자", "법인담당자", "상태", "요청일", "마감일", ""];

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  const fileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") return "📄";
    if (["xlsx", "xls"].includes(ext)) return "📊";
    if (["docx", "doc"].includes(ext)) return "📝";
    if (["zip", "7z", "rar"].includes(ext)) return "🗜";
    if (["jpg", "jpeg", "png", "gif"].includes(ext)) return "🖼";
    return "📎";
  };

  const PageRequests = () => {
    /* ══════════ CREATE VIEW ══════════ */
    if (showCreate) {
      const fLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 };
      const fInput: React.CSSProperties = { width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" };
      const fSelect: React.CSSProperties = { ...fInput, appearance: "none", background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E") no-repeat right 10px center`, paddingRight: 28, cursor: "pointer" };
      const divider: React.CSSProperties = { flex: "1 1 0", minWidth: 0, paddingRight: 16, borderRight: `1px solid ${C.border}`, marginRight: 16 };
      const cancelCreate = () => { setShowCreate(false); resetNewForm(); };
      return (
        <>
          <style>{`@keyframes _rdi{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}`}</style>
          <Card>
            <div style={{ animation: "_rdi 0.22s ease" }}>
              {/* Back nav */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <button
                  onClick={cancelCreate}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, fontFamily: "inherit", border: `1px solid ${C.border}`, background: "#fff", color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.primary; (e.currentTarget as HTMLElement).style.color = C.primary; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.sub; }}
                >← 목록으로</button>
                <span style={{ fontSize: 12, color: C.muted }}>자료 요청 / 신규</span>
              </div>

              {/* 제목 */}
              <div style={{ marginBottom: 24 }}>
                <input
                  type="text"
                  placeholder="자료 요청 제목을 입력하세요"
                  value={nTitle}
                  onChange={e => setNTitle(e.target.value)}
                  style={{ width: "100%", fontSize: 20, fontWeight: 700, color: C.text, border: "none", borderBottom: `2px solid ${C.primary}`, padding: "4px 2px 6px", outline: "none", background: "transparent", boxSizing: "border-box", letterSpacing: "-0.3px" }}
                />
              </div>

              {/* 1행 메타 */}
              <div style={{ display: "flex", background: "#F9F9F9", borderRadius: 8, border: `1px solid ${C.border}`, padding: "14px 20px", marginBottom: 24 }}>
                <div style={divider}>
                  <div style={fLabel}>법인</div>
                  <select value={nEntity} onChange={e => { setNEntity(e.target.value); setNAssignees([]); }} style={fSelect}>
                    {ENTITIES.map(en => <option key={en}>{en}</option>)}
                  </select>
                </div>
                <div style={divider}>
                  <div style={fLabel}>자료요청자</div>
                  <input value={nRequester} onChange={e => setNRequester(e.target.value)} placeholder="이름" style={fInput} />
                </div>
                <div style={divider}>
                  <div style={fLabel}>법인담당자</div>
                  <select value="" onChange={e => { const v = e.target.value; if (v && !nAssignees.includes(v)) setNAssignees(p => [...p, v]); e.target.value = ""; }} style={fSelect}>
                    <option value="">{(ENTITY_CLIENTS[nEntity] ?? []).length === 0 ? "등록 없음" : "추가..."}</option>
                    {(ENTITY_CLIENTS[nEntity] ?? ASSIGNEES).filter(a => !nAssignees.includes(a)).map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {nAssignees.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {nAssignees.map(a => (
                        <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", background: C.primaryBg, color: C.primary, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {a}
                          <button onClick={() => setNAssignees(p => p.filter(x => x !== a))} style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: 14, padding: "0 0 0 2px", lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={divider}>
                  <div style={fLabel}>마감일</div>
                  <input type="date" value={nDue} onChange={e => setNDue(e.target.value)} style={fInput} />
                </div>
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <div style={fLabel}>상태</div>
                  <select value={nStatus} onChange={e => setNStatus(e.target.value as ReqStatus)} style={fSelect}>
                    {(["Draft", "Requested"] as ReqStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* 설명 */}
              <div style={{ marginBottom: 24 }}>
                <div style={fLabel}>설명</div>
                <textarea
                  placeholder="자료 요청에 대한 상세 설명을 입력하세요."
                  value={nDesc}
                  onChange={e => setNDesc(e.target.value)}
                  rows={4}
                  style={{ width: "100%", resize: "vertical", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                  onFocus={e => (e.target.style.borderColor = C.primary)}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </div>

              {/* 저장/취소 */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                <OrangeBtn label="저장" onClick={() => submitRequest(nStatus)} />
                <GrayBtn label="취소" onClick={cancelCreate} />
              </div>
            </div>
          </Card>
        </>
      );
    }

    if (detailReq) {
      const sc       = STATUS_CFG[detailReq.status];
      const canEdit  = detailReq.status !== "Accepted";

      const fieldLabel: React.CSSProperties = {
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5,
      };
      const fieldInput: React.CSSProperties = {
        width: "100%", padding: "7px 10px", border: `1px solid ${C.border}`,
        borderRadius: 6, fontSize: 13, fontFamily: "inherit",
        outline: "none", boxSizing: "border-box", background: "#fff",
      };
      const fieldSelect: React.CSSProperties = {
        ...fieldInput,
        appearance: "none",
        background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E") no-repeat right 10px center`,
        paddingRight: 28, cursor: "pointer",
      };

      /* ── 첨부파일 섹션 (공통) ── */
      const FilesSection = () => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.3px" }}>첨부파일</span>
            {!filesLoading && (
              <span style={{ fontSize: 11, background: detailFiles.length ? C.primaryBg : "#F0F0F0", color: detailFiles.length ? C.primary : C.muted, padding: "1px 8px", borderRadius: 20, fontWeight: 600 }}>
                {detailFiles.length}
              </span>
            )}
            <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 6, cursor: uploading ? "not-allowed" : "pointer", background: uploading ? "#eee" : C.primary, color: "#fff", fontSize: 12, fontWeight: 600 }}>
              <input ref={fileInputRef} type="file" multiple hidden disabled={uploading} onChange={e => handleFileUpload(e.target.files)} />
              {uploading ? "업로드 중..." : "+ 파일 첨부"}
            </label>
          </div>
          {filesLoading ? (
            <p style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "16px 0" }}>불러오는 중...</p>
          ) : detailFiles.length === 0 ? (
            <div style={{ border: `2px dashed ${C.border}`, borderRadius: 8, padding: "36px 0", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
              <p style={{ fontSize: 12, color: C.muted }}>첨부된 파일이 없습니다</p>
              <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>위 버튼을 눌러 파일을 첨부해주세요</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {detailFiles.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#FAFAFA" }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(f.originalName)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={getFileUrl(f.url)} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: C.primary, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onMouseEnter={e => ((e.target as HTMLElement).style.textDecoration = "underline")}
                      onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = "none")}
                    >{f.originalName}</a>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmtSize(f.size)} · {f.uploader} · {f.uploadedAt}</div>
                  </div>
                  <button onClick={() => handleDeleteFile(f.id)} title="삭제"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.muted, padding: 4, flexShrink: 0 }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#DC2626")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.muted)}
                  >🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      return (
        <>
          <style>{`@keyframes _rdi{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}`}</style>
          <Card>
            <div style={{ animation: "_rdi 0.22s ease" }}>

              {/* ── Back nav ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
                <button
                  onClick={() => setDetailReq(null)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, fontFamily: "inherit", border: `1px solid ${C.border}`, background: "#fff", color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.primary; (e.currentTarget as HTMLElement).style.color = C.primary; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.sub; }}
                >← 목록으로</button>
                <span style={{ fontSize: 12, color: C.muted }}>자료 요청 / {detailReq.reqCode}</span>
                {isEditing && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 4, background: "#FFF5EE", color: C.primary, border: `1px solid ${C.primary}` }}>편집 중</span>
                )}
                {canEdit && !isEditing && (
                  <button
                    onClick={startEditing}
                    style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", padding: "5px 14px", borderRadius: 6, fontFamily: "inherit", border: `1px solid ${C.primary}`, background: "#fff", color: C.primary, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.primaryBg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                  >
                    편집
                  </button>
                )}
              </div>

              {/* ══════════ EDITABLE VIEW ══════════ */}
              {isEditing && editDraft ? (
                <>
                  {/* 제목 */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{detailReq.reqCode}</div>
                    <input
                      value={editDraft.title}
                      onChange={e => setEditDraft(p => p ? { ...p, title: e.target.value } : p)}
                      style={{ width: "100%", fontSize: 20, fontWeight: 700, color: C.text, border: "none", borderBottom: `2px solid ${C.primary}`, padding: "4px 2px 6px", outline: "none", background: "transparent", boxSizing: "border-box", letterSpacing: "-0.3px" }}
                    />
                  </div>

                  {/* 메타 폼 – 1행 */}
                  <div style={{ background: "#F9F9F9", borderRadius: 8, border: `1px solid ${C.border}`, padding: "14px 20px", marginBottom: 24, display: "flex", gap: 0 }}>
                    {/* 법인 */}
                    <div style={{ flex: "1 1 0", minWidth: 0, paddingRight: 16, borderRight: `1px solid ${C.border}`, marginRight: 16 }}>
                      <div style={fieldLabel}>법인</div>
                      <select value={editDraft.entity} onChange={e => setEditDraft(p => p ? { ...p, entity: e.target.value, assignees: [] } : p)} style={fieldSelect}>
                        {ENTITIES.map(en => <option key={en}>{en}</option>)}
                      </select>
                    </div>
                    {/* 자료요청자 */}
                    <div style={{ flex: "1 1 0", minWidth: 0, paddingRight: 16, borderRight: `1px solid ${C.border}`, marginRight: 16 }}>
                      <div style={fieldLabel}>자료요청자</div>
                      <input value={editDraft.requester} onChange={e => setEditDraft(p => p ? { ...p, requester: e.target.value } : p)} style={fieldInput} />
                    </div>
                    {/* 법인담당자 */}
                    <div style={{ flex: "1 1 0", minWidth: 0, paddingRight: 16, borderRight: `1px solid ${C.border}`, marginRight: 16 }}>
                      <div style={fieldLabel}>법인담당자</div>
                      <select value="" onChange={e => { const v = e.target.value; if (v && !editDraft.assignees.includes(v)) setEditDraft(p => p ? { ...p, assignees: [...p.assignees, v] } : p); e.target.value = ""; }} style={fieldSelect}>
                        <option value="">{(ENTITY_CLIENTS[editDraft.entity] ?? []).length === 0 ? "등록 없음" : "추가..."}</option>
                        {(ENTITY_CLIENTS[editDraft.entity] ?? ASSIGNEES).filter(a => !editDraft.assignees.includes(a)).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      {editDraft.assignees.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {editDraft.assignees.map(a => (
                            <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", background: C.primaryBg, color: C.primary, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                              {a}
                              <button onClick={() => setEditDraft(p => p ? { ...p, assignees: p.assignees.filter(x => x !== a) } : p)} style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: 14, padding: "0 0 0 2px", lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 요청일 */}
                    <div style={{ flex: "1 1 0", minWidth: 0, paddingRight: 16, borderRight: `1px solid ${C.border}`, marginRight: 16 }}>
                      <div style={fieldLabel}>요청일</div>
                      <div style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{detailReq.createdDate}</div>
                    </div>
                    {/* 마감일 */}
                    <div style={{ flex: "1 1 0", minWidth: 0, paddingRight: 16, borderRight: `1px solid ${C.border}`, marginRight: 16 }}>
                      <div style={fieldLabel}>마감일</div>
                      <input type="date" value={editDraft.dueDate} onChange={e => setEditDraft(p => p ? { ...p, dueDate: e.target.value } : p)} style={fieldInput} />
                    </div>
                    {/* 상태 */}
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      <div style={fieldLabel}>상태</div>
                      <select value={editDraft.status} onChange={e => setEditDraft(p => p ? { ...p, status: e.target.value as ReqStatus } : p)} style={fieldSelect}>
                        {[detailReq.status as ReqStatus, ...STATUS_TRANSITIONS[detailReq.status]].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 설명 */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 8 }}>설명</div>
                    <textarea
                      value={editDraft.description}
                      onChange={e => setEditDraft(p => p ? { ...p, description: e.target.value } : p)}
                      rows={4}
                      style={{ width: "100%", resize: "vertical", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                      onFocus={e => (e.target.style.borderColor = C.primary)}
                      onBlur={e => (e.target.style.borderColor = C.border)}
                    />
                  </div>

                  {/* 첨부파일 */}
                  {FilesSection()}

                  {/* 저장/취소 버튼 */}
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 20, marginTop: 20, borderTop: `1px solid ${C.border}` }}>
                    <OrangeBtn label="저장" onClick={handleSaveEdit} />
                    <GrayBtn label="취소" onClick={() => { setIsEditing(false); setEditDraft(null); }} />
                  </div>
                </>
              ) : (
                /* ══════════ READ-ONLY VIEW (Accepted) ══════════ */
                <>
                  {/* 제목 */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>{detailReq.reqCode}</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>{detailReq.title}</h2>
                  </div>

                  {/* 메타 – 1행 */}
                  <div style={{ display: "flex", gap: 0, marginBottom: 24, padding: "14px 20px", background: "#F9F9F9", borderRadius: 8, border: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                    {([
                      ["법인",      detailReq.entity],
                      ["자료요청자", detailReq.requester],
                      ["법인담당자", detailReq.assignee],
                      ["요청일",    detailReq.createdDate],
                      ["마감일",    detailReq.dueDate],
                    ] as [string, string][]).map(([k, v], i, arr) => (
                      <div key={k} style={{ flex: "1 1 0", minWidth: 100, paddingRight: 16, borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none", marginRight: i < arr.length - 1 ? 16 : 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v || "—"}</div>
                      </div>
                    ))}
                    <div style={{ flex: "1 1 0", minWidth: 100, paddingLeft: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>상태</div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        <StatusIcon status={detailReq.status} color={sc.color} />
                        {detailReq.status}
                      </span>
                    </div>
                  </div>

                  {/* 설명 */}
                  {detailReq.description && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 8 }}>설명</div>
                      <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.75, background: "#F9F9F9", padding: "14px 16px", borderRadius: 8, border: `1px solid ${C.border}`, margin: 0 }}>{detailReq.description}</p>
                    </div>
                  )}

                  {/* 첨부파일 */}
                  {FilesSection()}

                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 20, marginTop: 20, borderTop: `1px solid ${C.border}` }}>
                    <GrayBtn label="닫기" onClick={() => setDetailReq(null)} />
                  </div>
                </>
              )}

            </div>
          </Card>
        </>
      );
    }

    return (
      <Card>
      {/* Header – row 1 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>자료 요청</h2>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>총 {requests.length}건 · 표시 {filteredReqs.length}건</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* Status filter tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["전체", "Draft", "Requested", "Submitted", "Recall", "Accepted"] as (ReqStatus | "전체")[]).map(s => {
              const cfg = s === "전체" ? null : STATUS_CFG[s];
              const isActive = reqFilter === s;
              return (
                <button key={s} onClick={() => setReqFilter(s)}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    background: s === "전체"
                      ? (isActive ? C.primary : "#F0F0F0")
                      : (isActive ? (cfg?.color ?? "#666") : (cfg?.bg ?? "#F0F0F0")),
                    color: s === "전체"
                      ? (isActive ? "#fff" : "#666")
                      : (isActive ? "#fff" : (cfg?.color ?? "#666")),
                    border: "2px solid transparent",
                    opacity: !isActive && s !== "전체" ? 0.65 : 1,
                  }}>
                  {s}
                </button>
              );
            })}
          </div>
          {/* 그룹핑 토글 */}
          <button
            onClick={() => setGroupByEntity(p => !p)}
            title={groupByEntity ? "목록 보기" : "법인별 보기"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 6, fontFamily: "inherit",
              border: `1px solid ${groupByEntity ? C.primary : "#ddd"}`,
              background: groupByEntity ? C.primaryBg : "#fff",
              color: groupByEntity ? C.primary : "#666",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            법인별
          </button>
          <button onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 14px", borderRadius: 6, border: "none",
              background: C.primary, color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 자료 요청
          </button>
        </div>
      </div>

      {/* Header – row 2: 모회사 + 법인 + 토글 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {/* 모회사 드롭다운 (관리자용) */}
        <select
          value={parentFilter}
          onChange={e => setParentFilter(e.target.value)}
          style={{
            padding: "6px 28px 6px 10px", borderRadius: 6, fontSize: 12,
            border: `1px solid ${parentFilter !== "전체" ? C.primary : "#ddd"}`,
            background: `${parentFilter !== "전체" ? C.primaryBg : "#fff"} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E") no-repeat right 10px center`,
            color: parentFilter !== "전체" ? C.primary : "#666",
            appearance: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: parentFilter !== "전체" ? 600 : 400,
          }}
        >
          <option value="전체">전체 모회사</option>
          {PARENT_COMPANIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            style={{
              padding: "6px 28px 6px 10px", borderRadius: 6, fontSize: 12,
              border: `1px solid ${entityFilter !== "전체" ? C.primary : "#ddd"}`,
              background: `${entityFilter !== "전체" ? C.primaryBg : "#fff"} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E") no-repeat right 10px center`,
              color: entityFilter !== "전체" ? C.primary : "#666",
              appearance: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: entityFilter !== "전체" ? 600 : 400,
            }}
          >
            <option value="전체">전체 법인</option>
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
            <div
              onClick={() => setMyOnly(p => !p)}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: myOnly ? C.primary : "#ccc",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
                cursor: "pointer",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 2,
                left: myOnly ? 20 : 2,
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: myOnly ? C.primary : "#888" }}>
              {myOnly ? "내 요청만" : "전체 요청"}
            </span>
          </label>
        </div>
      </div>

      {/* ── 목록 보기 ── */}
      {!groupByEntity && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead><tr>{COLS_FLAT.map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {filteredReqs.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>해당 상태의 자료 요청이 없습니다.</td></tr>
              ) : filteredReqs.map(req => <ReqRow key={req.id} req={req} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 법인별 그룹 보기 ── */}
      {groupByEntity && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groupedEntities.length === 0 ? (
            <p style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: 13 }}>해당 상태의 자료 요청이 없습니다.</p>
          ) : groupedEntities.map(entity => {
            const items   = grouped[entity];
            const isOpen  = !collapsed[entity];
            const statMap = items.reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a; }, {});
            return (
              <div key={entity} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                {/* Entity header */}
                <button
                  onClick={() => toggleCollapse(entity)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", background: isOpen ? "#FFFAF6" : "#F9F9F9",
                    borderBottom: isOpen ? `1px solid ${C.border}` : "none",
                    border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 13, color: isOpen ? C.primary : "#555", transform: `rotate(${isOpen ? 90 : 0}deg)`, display: "inline-block", transition: "transform 0.2s", lineHeight: 1 }}>▶</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{entity}</span>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>{items.length}건</span>
                  {/* 상태 미니 배지들 */}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {Object.entries(statMap).map(([st, cnt]) => {
                      const sc = STATUS_CFG[st as ReqStatus];
                      return (
                        <span key={st} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: sc?.bg ?? "#eee", color: sc?.color ?? "#666" }}>
                          {st} {cnt}
                        </span>
                      );
                    })}
                  </div>
                </button>
                {/* 요청 테이블 */}
                {isOpen && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                      <thead><tr>{COLS_GROUPED.map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                      <tbody>
                        {items.map(req => <ReqRow key={req.id} req={req} hideEntity />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

  /* ── Users ── */
  const allPwcSel    = pwcSelected    === PWC_USERS.length    && PWC_USERS.length > 0;
  const allClientSel = clientSelected === CLIENT_USERS.length && CLIENT_USERS.length > 0;

  const PageUsers = () => (
    <Card>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `2px solid ${C.border}`, marginBottom: 18 }}>
        {(["pwc", "client", "thirdparty", "all"] as UserTab[]).map(tab => {
          const labels: Record<UserTab, string> = { pwc: "PwC", client: "Client", thirdparty: "Third Party", all: "All" };
          const active = userTab === tab;
          return (
            <button key={tab} onClick={() => setUserTab(tab)}
              style={{
                padding: "9px 22px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? C.primary : "#777",
                borderBottom: `3px solid ${active ? C.primary : "transparent"}`,
                marginBottom: -2, background: "none", border: "none",
                borderBottomStyle: "solid", borderBottomWidth: 3,
                borderBottomColor: active ? C.primary : "transparent",
                transition: "color 0.15s",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* PwC tab */}
      {userTab === "pwc" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <SectionTitle title="PwC Users" count={PWC_USERS.length} selected={pwcSelected} />
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button onClick={() => showToast("Group & User Management (GUM) Portal로 이동합니다.")}
                style={{ color: C.primary, fontSize: 12, textDecoration: "underline", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Navigate to GUM Portal
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 12 }}>
            <IconBtn title="Delete"      onClick={() => showToast("선택된 사용자를 삭제합니다.")}>🗑</IconBtn>
            <IconBtn title="Add User"    onClick={() => setModal("add-pwc")}>⊕</IconBtn>
            <IconBtn title="Change Role" onClick={() => showToast("역할 변경 모드")}>⇄</IconBtn>
            <IconBtn title="Export"      onClick={() => showToast("사용자 목록이 다운로드됩니다.")}>💾</IconBtn>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr>
                  <CheckTH checked={allPwcSel} onChange={v => setPwcSel(PWC_USERS.reduce((a, _, i) => ({ ...a, [i]: v }), {}))} />
                  {["Name", "Email", "Country", "Status", "Aura Role", "Connect Role", "Custom Access Group(s)", "Last Access Date", ""].map(h => <TH key={h}>{h}</TH>)}
                </tr>
              </thead>
              <tbody>
                {PWC_USERS.map((u, i) => (
                  <tr key={u.email}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <CheckTD checked={!!pwcSel[i]} onChange={v => setPwcSel(p => ({ ...p, [i]: v }))} />
                    <TD>{u.name}</TD>
                    <TD>
                      <span title="이메일 발송" onClick={() => showToast(`${u.email}로 이메일을 발송합니다.`)}
                        style={{ fontSize: 13, color: C.muted, marginRight: 4, cursor: "pointer" }}>✉</span>
                      {u.email}
                    </TD>
                    <TD>{u.country}</TD>
                    <TD><StatusDot status={u.status} /></TD>
                    <TD>—</TD>
                    <TD>{u.role}</TD>
                    <TD>—</TD>
                    <TD>{u.last}</TD>
                    <TD></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Client tab */}
      {userTab === "client" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <SectionTitle title="Client Users" count={CLIENT_USERS.length} selected={clientSelected} />
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setModal("add-client")}
                style={{ background: C.primary, color: "#fff", border: "none", padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Add
              </button>
              <IconBtn title="Add User" onClick={() => setModal("add-client")}>⊕</IconBtn>
              <IconBtn title="Import"   onClick={() => setModal("import")}>⇄</IconBtn>
              <IconBtn title="Export"   onClick={() => showToast("Client 사용자 목록이 다운로드됩니다.")}>💾</IconBtn>
            </div>
          </div>
          <div style={{ background: "#FFFBF5", border: `1px solid #FFE8D0`, borderLeft: `3px solid ${C.primary}`, padding: "8px 14px", borderRadius: 6, marginBottom: 14, fontSize: 12, color: "#777", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong style={{ color: C.sub }}>Approved Domains:</strong>
            <span>irongrey.co · seah.co.kr · seah.global · seahctc.com · seahglobal.co.jp · seahgv.com</span>
            <button onClick={() => showToast("도메인 관리 화면으로 이동합니다.")}
              style={{ marginLeft: "auto", background: C.primary, color: "#fff", border: "none", padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Manage Domains
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr>
                  <CheckTH checked={allClientSel} onChange={v => setClientSel(CLIENT_USERS.reduce((a, _, i) => ({ ...a, [i]: v }), {}))} />
                  {["Name", "Email", "Organization", "Country", "Status", "Connect Role", "Custom Access Group(s)", "Last Access Date", ""].map(h => <TH key={h}>{h}</TH>)}
                </tr>
              </thead>
              <tbody>
                {CLIENT_USERS.map((u, i) => (
                  <tr key={u.email}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <CheckTD checked={!!clientSel[i]} onChange={v => setClientSel(p => ({ ...p, [i]: v }))} />
                    <TD>{u.name}</TD>
                    <TD>
                      <span title="이메일 발송" onClick={() => showToast(`${u.email}로 이메일을 발송합니다.`)}
                        style={{ fontSize: 13, color: C.muted, marginRight: 4, cursor: "pointer" }}>✉</span>
                      {u.email}
                    </TD>
                    <TD>{u.org}</TD>
                    <TD>{u.country}</TD>
                    <TD><StatusDot status={u.status} /></TD>
                    <TD style={{ maxWidth: 220, whiteSpace: "normal" }}>{u.role}</TD>
                    <TD>—</TD>
                    <TD>{u.last}</TD>
                    <TD></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Third Party tab */}
      {userTab === "thirdparty" && (
        <div>
          <SectionTitle title="Third Party Users" count={0} />
          <div style={{ textAlign: "center", padding: "50px 0", color: C.muted }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>👥</div>
            <p style={{ fontSize: 13 }}>No Third Party users have been added yet.</p>
            <button onClick={() => setModal("add-client")}
              style={{ marginTop: 14, background: "#fff", color: C.primary, border: `1px solid ${C.primary}`, padding: "7px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Add User
            </button>
          </div>
        </div>
      )}

      {/* All tab */}
      {userTab === "all" && (
        <div>
          <SectionTitle title="All Users" count={PWC_USERS.length + CLIENT_USERS.length} />
          <p style={{ color: "#777", fontSize: 13 }}>PwC {PWC_USERS.length}명 + Client {CLIENT_USERS.length}명의 전체 사용자 목록이 표시됩니다.</p>
        </div>
      )}
    </Card>
  );

  /* ── Placeholder pages ── */
  const PlaceholderPage = ({ icon, label, desc }: { icon: string; label: string; desc: string }) => (
    <Card>
      <SectionTitle title={label} />
      <div style={{ textAlign: "center", padding: "50px 0", color: C.muted }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>{icon}</div>
        <p style={{ fontSize: 13 }}>{desc}</p>
      </div>
    </Card>
  );

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "'Noto Sans KR','Malgun Gothic','맑은 고딕',sans-serif", fontSize: 13, color: C.text }}>
      {SidebarEl()}

      <main style={{ flex: 1, overflow: "auto", background: C.bg }}>
        {/* Page title bar */}
        <div style={{
          background: "#fff", borderBottom: `1px solid ${C.border}`,
          padding: "0 24px", height: 48,
          display: "flex", alignItems: "center", gap: 10,
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 3px rgba(0,0,0,.04)",
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>
            {SIDEBAR_ITEMS.find(i => i.key === page)?.label ?? "Site Administration"}
          </span>
        </div>

        {page === "requests" && PageRequests()}
      </main>

      {/* Modals */}
      {modal === "add-pwc" && (
        <Modal title="Add User(s) Manually" onClose={closeModal} onConfirm={confirmModal} confirmLabel="Add">
          <FRow>
            <FGroup label="User(s)">
              <FInput placeholder="Search for a user by name, email, or GUID" />
            </FGroup>
            <FGroup label="Connect Role">
              <FSelect options={["- Select -", "Read-Only", "PwC - View Assignments Only", "PwC SDC User", "PwC - View All Unrestricted Requests", "PwC Administrator"]} defaultIdx={2} />
            </FGroup>
          </FRow>
          <FCheck label="Send a welcome message" defaultChecked />
          <FGroup label="Add a custom message?">
            <FTextarea placeholder="시스템에서 발송되는 Welcome message에 추가하고자 하는 내용을 입력하세요." />
          </FGroup>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <button onClick={() => showToast("Welcome 메시지 미리보기")}
              style={{ background: C.primary, color: "#fff", border: "none", padding: "6px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Preview
            </button>
          </div>
        </Modal>
      )}

      {modal === "add-client" && (
        <Modal title="Add User(s) Manually" onClose={closeModal} onConfirm={confirmModal} confirmLabel="Add">
          <FRow>
            <FGroup label="User(s)">
              <FInput placeholder="Search for a user by name or email" />
            </FGroup>
            <FGroup label="Connect Role">
              <FSelect options={["- Select -", "Read-Only", "Client - View Assignments Only", "Client - View All Unrestricted Requests", "Client Request Manager - View Assignments Only", "Client Request Manager - View All Unrestricted Requests"]} defaultIdx={2} />
            </FGroup>
          </FRow>
          <FCheck label="Send a welcome message" defaultChecked />
          <FGroup label="Add a custom message?">
            <FTextarea placeholder="시스템에서 발송되는 Welcome message에 추가하고자 하는 내용을 입력하세요." />
          </FGroup>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <button onClick={() => showToast("Welcome 메시지 미리보기")}
              style={{ background: C.primary, color: "#fff", border: "none", padding: "6px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Preview
            </button>
          </div>
        </Modal>
      )}


      {modal === "import" && (
        <Modal title="Import User(s)" onClose={closeModal} onConfirm={confirmModal} confirmLabel="Import">
          <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 8 }}>Step 1: Download Template</p>
          <div style={{ marginBottom: 18 }}>
            <button onClick={() => showToast("User Import Template.xls 다운로드 중...")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.primary, textDecoration: "underline", background: "none", border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 18 }}>📄</span> User Import Template.xls
            </button>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 8 }}>Step 2: Upload File</p>
          <button onClick={() => showToast("파일 선택 대화상자가 열립니다.")}
            style={{ background: "#f5f5f5", border: "1px solid #ddd", padding: "6px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", marginBottom: 6 }}>
            Select Files
          </button>
          <p style={{ fontSize: 11, color: C.muted, marginBottom: 18 }}>Select populated Import Users Template for upload.</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.primary, marginBottom: 8 }}>Step 3: Welcome Message</p>
          <FCheck label="Send a welcome message" defaultChecked />
          <FGroup label="Add a custom message?">
            <FTextarea placeholder="Type your message here" />
          </FGroup>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <button onClick={() => showToast("Welcome 메시지 미리보기")}
              style={{ background: C.primary, color: "#fff", border: "none", padding: "6px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Preview
            </button>
          </div>
        </Modal>
      )}

      {deleteConfirmId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDeleteConfirmId(null)}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "28px 32px", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>정말 삭제하시겠습니까?</p>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>삭제 후 복구할 수 없습니다.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={async () => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  try { await deleteRequest(id); } catch { /* backend down */ }
                  setRequests(p => {
                    const next = p.filter(r => r.id !== id);
                    saveCache(next);
                    return next;
                  });
                  showToast("요청이 삭제되었습니다.");
                }}
                style={{ padding: "8px 24px", borderRadius: 6, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >삭제</button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: "8px 24px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >취소</button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast} />
      <ChatBot />
    </div>
  );
}
