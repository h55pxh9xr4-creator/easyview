"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchMonths } from "@/lib/api";
import { fetchExchangeRates } from "@/lib/exchangeRate";

export default function FilterBar({ activeSub, inline }: { activeSub: string; inline?: boolean }) {
  const { baseYm, periodType, compareTarget, bsBase, amountUnit, currency, exchangeRates,
          setBaseYm, setPeriodType, setCompareTarget, setBsBase, setAmountUnit,
          setCurrency, setExchangeRates } = useFilter();
  const [months, setMonths] = useState<string[]>([]);

  const SC_PAGES = ["sc-dup","sc-cash","sc-wknd","sc-big","sc-sc5","sc-sc6"];
  const noFilters = SC_PAGES.includes(activeSub) || activeSub === "vch-search" || activeSub === "inquiry" || activeSub === "settings";
  const showPeriod = !noFilters && !["bs-sum","bs-trend","bs-acct"].includes(activeSub);
  const showCompare = ["summary","pl-sum"].includes(activeSub);
  const showBsBase = ["summary","bs-acct"].includes(activeSub);

  useEffect(() => {
    fetchMonths().then(setMonths).catch(console.error);
  }, []);

  useEffect(() => {
    fetchExchangeRates().then(setExchangeRates).catch(console.error);
  }, [setExchangeRates]);

  // 기간 전환 시 compareTarget을 해당 기간의 기본값으로 리셋
  useEffect(() => {
    if (periodType === "monthly" && !["prev_year_month", "prev_month"].includes(compareTarget)) {
      setCompareTarget("prev_year_month");
    } else if (periodType === "cumulative" && !["prev_year_cum", "prev_month_cum"].includes(compareTarget)) {
      setCompareTarget("prev_year_cum");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType]);

  const fmtYm = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}년 ${m}월`;
  };

  if (noFilters) return null;

  const availableCurrencies = Object.keys(exchangeRates).sort((a, b) =>
    a === "KRW" ? -1 : b === "KRW" ? 1 : a.localeCompare(b)
  );

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
          <select
            className="fsel"
            value={compareTarget}
            onChange={(e) => setCompareTarget(e.target.value as never)}
          >
            {periodType === "monthly" ? (
              <>
                <option value="prev_year_month">전년동월</option>
                <option value="prev_month">전월</option>
              </>
            ) : (
              <>
                <option value="prev_year_cum">전년누적</option>
                <option value="prev_month_cum">전월누적</option>
              </>
            )}
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

      {/* 통화 + 단위 — 항상 맨 오른쪽 고정 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">통화</span>
          <select
            className="fsel"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={availableCurrencies.length <= 1}
          >
            {availableCurrencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">단위</span>
          <select className="fsel" value={amountUnit} onChange={(e) => setAmountUnit(e.target.value as never)}>
            <option value="원">원</option>
            <option value="천">천</option>
            <option value="백만">백만</option>
            <option value="억">억</option>
          </select>
        </div>
      </div>
    </div>
  );

  // inline 모드: ptb 안에 삽입 (별도 바 없음)
  if (inline) return controls;

  return <div className="fbar">{controls}</div>;
}
