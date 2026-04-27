"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFilter } from "@/hooks/useFilter";
import { fetchMonths, fetchActiveCompanies, putViewCompany, fetchViewCompany } from "@/lib/api";
import { fetchExchangeRates } from "@/lib/exchangeRate";

export default function FilterBar({ activeSub, inline, isAdmin, userCompany, refreshTick }: {
  activeSub: string;
  inline?: boolean;
  isAdmin?: boolean;
  userCompany?: string;
  refreshTick?: number;
}) {
  const { t, i18n } = useTranslation();
  const { baseYm, periodType, compareTarget, bsBase, amountUnit, currency, exchangeRates,
          viewCompany,
          setBaseYm, setPeriodType, setCompareTarget, setBsBase, setAmountUnit,
          setCurrency, setExchangeRates, setViewCompany } = useFilter();
  const [months, setMonths] = useState<string[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<string[]>([]);
  const [companyChanging, setCompanyChanging] = useState(false);

  const SC_PAGES = ["sc-dup","sc-cash","sc-wknd","sc-big","sc-sc5","sc-sc6"];
  const noFilters = SC_PAGES.includes(activeSub) || activeSub === "vch-search" || activeSub === "inquiry" || activeSub === "settings";
  const showPeriod = !noFilters && !["bs-sum","bs-trend","bs-acct"].includes(activeSub);
  const showCompare = ["summary","pl-sum"].includes(activeSub);
  const showBsBase = ["summary","bs-acct"].includes(activeSub);

  const refreshMonths = (m: string[]) => {
    setMonths(m);
    if (m.length > 0 && !m.includes(baseYm)) setBaseYm(m[0]);
  };

  useEffect(() => {
    const refetch = () => {
      fetchMonths().then(refreshMonths).catch(console.error);
      fetchActiveCompanies().then(setActiveCompanies).catch(console.error);
    };
    refetch();
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // 비어드민: 자기 회사로 자동 고정
  useEffect(() => {
    if (!isAdmin && userCompany) {
      putViewCompany(userCompany).catch(console.error);
      setViewCompany(userCompany);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userCompany]);

  // 어드민: 첫 진입 시 backend 의 view_settings 와 동기화. 비어있으면 ABC 를 default 로.
  useEffect(() => {
    if (!isAdmin) return;
    fetchViewCompany()
      .then(({ company }) => {
        if (company) {
          setViewCompany(company);
        } else {
          // 첫 진입: 시연용 default 회사로 ABC 고정
          putViewCompany("ABC").catch(console.error);
          setViewCompany("ABC");
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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
    const lang = (i18n.language ?? "ko").split("-")[0];
    if (lang === "en") {
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${monthNames[parseInt(m, 10) - 1]} ${y}`;
    }
    return `${y}년 ${m}월`;
  };

  if (noFilters) return null;

  const availableCurrencies = Object.keys(exchangeRates).sort((a, b) =>
    a === "KRW" ? -1 : b === "KRW" ? 1 : a.localeCompare(b)
  );

  const controls = (
    <div className="fbar-controls">
      {/* 회사 선택 (어드민 전용) */}
      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">회사</span>
          <select
            className="fsel"
            value={viewCompany}
            disabled={companyChanging}
            onChange={async (e) => {
              const c = e.target.value;
              setCompanyChanging(true);
              setViewCompany(c);
              try {
                await putViewCompany(c);
              } catch (err) {
                console.error(err);
              }
              // 임시 fix — 모든 페이지의 useEffect 의존성에 viewCompany 가 빠져있어
              // 회사 변경이 데이터 refetch 를 트리거하지 못함. 페이지 강제 reload 로
              // 모든 페이지가 새 회사 데이터를 처음부터 받도록 보장.
              // (정석 fix: 14개 useEffect 의존성에 viewCompany 추가 — 시연 후 작업)
              setTimeout(() => window.location.reload(), 50);
            }}
          >
            <option value="">전체</option>
            {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* 월별/누적 토글 */}
      {showPeriod && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">{t("filter.period")}</span>
          <div className="ftoggle">
            <button
              className={`ftbtn${periodType === "monthly" ? " on" : ""}`}
              onClick={() => setPeriodType("monthly")}
            >{t("filter.monthly")}</button>
            <button
              className={`ftbtn${periodType === "cumulative" ? " on" : ""}`}
              onClick={() => setPeriodType("cumulative")}
            >{t("filter.cumulative")}</button>
          </div>
        </div>
      )}

      {/* 기준연월 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="flabel">{t("filter.baseYm")}</span>
        <select className="fsel" value={baseYm} onChange={(e) => setBaseYm(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>{fmtYm(m)}</option>
          ))}
        </select>
      </div>

      {/* 분석대상 */}
      {showCompare && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">{t("filter.compareTarget")}</span>
          <select
            className="fsel"
            value={compareTarget}
            onChange={(e) => setCompareTarget(e.target.value as never)}
          >
            {periodType === "monthly" ? (
              <>
                <option value="prev_year_month">{t("filter.prevYearMonth")}</option>
                <option value="prev_month">{t("filter.prevMonth")}</option>
              </>
            ) : (
              <>
                <option value="prev_year_cum">{t("filter.prevYearCum")}</option>
                <option value="prev_month_cum">{t("filter.prevMonthCum")}</option>
              </>
            )}
          </select>
        </div>
      )}

      {/* 비교대상(재무) */}
      {showBsBase && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">{t("filter.bsBase")}</span>
          <select className="fsel" value={bsBase} onChange={(e) => setBsBase(e.target.value as never)}>
            <option value="year_start">{t("filter.yearStart")}</option>
            <option value="month_start">{t("filter.monthStart")}</option>
          </select>
        </div>
      )}

      {/* 통화 + 단위 — 항상 맨 오른쪽 고정 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">{t("filter.currency")}</span>
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
          {currency !== "KRW" && exchangeRates[currency] ? (
            <span
              title={`1 ${currency} = ${(1 / exchangeRates[currency]).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} KRW`}
              style={{
                fontSize: 10.5, color: "#888", fontWeight: 500,
                padding: "2px 6px", background: "rgba(232,119,34,0.08)",
                borderRadius: 4, whiteSpace: "nowrap",
              }}
            >
              1 {currency} ≈ {(1 / exchangeRates[currency]).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} KRW
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="flabel">{t("filter.unit")}</span>
          <select className="fsel" value={amountUnit} onChange={(e) => setAmountUnit(e.target.value as never)}>
            <option value="원">{t("filter.unitWon")}</option>
            <option value="천">{t("filter.unitThousand")}</option>
            <option value="백만">{t("filter.unitMillion")}</option>
            <option value="억">{t("filter.unitBillion")}</option>
          </select>
        </div>
      </div>
    </div>
  );

  // 회사 전환 중 풀스크린 로딩 오버레이
  const overlay = companyChanging ? (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(20,20,30,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
      }}
    >
      <div
        style={{
          width: 48, height: 48, border: "4px solid rgba(255,255,255,0.25)",
          borderTopColor: "#E87722", borderRadius: "50%",
          animation: "fbarSpin 0.8s linear infinite",
        }}
      />
      <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
        {viewCompany ? `${viewCompany} 데이터 불러오는 중...` : "전체 데이터 불러오는 중..."}
      </div>
      <style>{`@keyframes fbarSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ) : null;

  // inline 모드: ptb 안에 삽입 (별도 바 없음)
  if (inline) return <>{controls}{overlay}</>;

  return <><div className="fbar">{controls}</div>{overlay}</>;
}
