"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchMonths } from "@/lib/api";

export default function FilterBar({ activeSub, inline }: { activeSub: string; inline?: boolean }) {
  const { baseYm, periodType, compareTarget, bsBase,
          setBaseYm, setPeriodType, setCompareTarget, setBsBase } = useFilter();
  const [months, setMonths] = useState<string[]>([]);

  const SC_PAGES = ["sc-dup","sc-cash","sc-wknd","sc-big","sc-sc5","sc-sc6"];
  const noFilters = SC_PAGES.includes(activeSub) || activeSub === "vch-search" || activeSub === "inquiry";
  const showPeriod = !noFilters && !["bs-sum","bs-trend","bs-acct"].includes(activeSub);
  const showCompare = ["summary","pl-sum"].includes(activeSub);
  const showBsBase = ["summary","bs-acct"].includes(activeSub);

  useEffect(() => {
    fetchMonths().then(setMonths).catch(console.error);
  }, []);

  const fmtYm = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}년 ${m}월`;
  };

  if (noFilters) return null;

  const controls = (
    <div className="fbar-controls">
      {/* 월별/누적 토글 */}
      {showPeriod && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">기간</span>
          <div className="ftoggle">
            <button
              className={`ftbtn${periodType === "monthly" ? " on" : ""}`}
              onClick={() => setPeriodType("monthly")}
            >월별</button>
            <button
              className={`ftbtn${periodType === "cumulative" ? " on" : ""}`}
              onClick={() => setPeriodType("cumulative")}
            >누적</button>
          </div>
        </div>
      )}

      {/* 기준연월 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="flabel">기준연월</span>
        <select className="fsel" value={baseYm} onChange={(e) => setBaseYm(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>{fmtYm(m)}</option>
          ))}
        </select>
      </div>

      {/* 분석대상 */}
      {showCompare && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">분석대상</span>
          <select className="fsel" value={compareTarget} onChange={(e) => setCompareTarget(e.target.value as never)}>
            <option value="prev_year_cum">전년누적</option>
            <option value="prev_month">전월비교</option>
          </select>
        </div>
      )}

      {/* 비교대상(재무) */}
      {showBsBase && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">비교대상(재무)</span>
          <select className="fsel" value={bsBase} onChange={(e) => setBsBase(e.target.value as never)}>
            <option value="year_start">연초</option>
            <option value="month_start">월초</option>
          </select>
        </div>
      )}
    </div>
  );

  // inline 모드: ptb 안에 삽입 (별도 바 없음)
  if (inline) return controls;

  return <div className="fbar">{controls}</div>;
}
