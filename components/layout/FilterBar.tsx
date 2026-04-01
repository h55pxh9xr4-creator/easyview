"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchMonths } from "@/lib/api";

export default function FilterBar() {
  const { baseYm, periodType, compareTarget, bsBase,
          setBaseYm, setPeriodType, setCompareTarget, setBsBase } = useFilter();
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => {
    fetchMonths().then(setMonths).catch(console.error);
  }, []);

  const fmtYm = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}년 ${m}월`;
  };

  return (
    <div className="fbar">
      {/* 월별/누적 토글 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="flabel">기간</span>
        <div className="ftoggle">
          <button
            className={`ftbtn${periodType === "monthly" ? " on" : ""}`}
            onClick={() => setPeriodType("monthly")}
          >
            월별
          </button>
          <button
            className={`ftbtn${periodType === "cumulative" ? " on" : ""}`}
            onClick={() => setPeriodType("cumulative")}
          >
            누적
          </button>
        </div>
      </div>

      {/* 기준연월 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="flabel">기준연월</span>
        <select
          className="fsel"
          value={baseYm}
          onChange={(e) => setBaseYm(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>{fmtYm(m)}</option>
          ))}
        </select>
      </div>

      {/* 분석대상 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="flabel">분석대상</span>
        <select
          className="fsel"
          value={compareTarget}
          onChange={(e) => setCompareTarget(e.target.value as never)}
        >
          <option value="prev_year_cum">전년누적</option>
          <option value="prev_year_month">전년동월</option>
          <option value="prev_month">전월비교</option>
        </select>
      </div>

      {/* 비교대상(재무) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="flabel">비교대상(재무)</span>
        <select
          className="fsel"
          value={bsBase}
          onChange={(e) => setBsBase(e.target.value as never)}
        >
          <option value="year_start">연초</option>
          <option value="month_start">월초</option>
        </select>
      </div>
    </div>
  );
}
