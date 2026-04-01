"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchPLSummary } from "@/lib/api";

const fmt  = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtB = (n: number) => Math.round(n / 1_000_000).toLocaleString("ko-KR");
const arrowTxt = (p: number) => p >= 0 ? `▲ ${Math.abs(p * 100).toFixed(1)}%` : `▼ ${Math.abs(p * 100).toFixed(1)}%`;

interface PLData {
  current: Record<string, number>;
  prior: Record<string, number>;
  prev_month_rev_diff: number;
  change: Record<string, number>;
}

export default function PLSummary() {
  const filter = useFilter();
  const [data, setData] = useState<PLData | null>(null);

  useEffect(() => {
    fetchPLSummary(filter).then((d) => setData(d as PLData)).catch(console.error);
  }, [filter.baseYm, filter.periodType, filter.compareTarget]);

  if (!data) return <div className="wrap" style={{ padding: 40, color: "#aaa" }}>데이터 로딩 중...</div>;

  const items = [
    { key: "revenue",          label: "매출액",       bold: false },
    { key: "cogs",             label: "매출원가",      bold: false },
    { key: "gross_profit",     label: "매출총이익",    bold: true  },
    { key: "sga",              label: "판매비와관리비", bold: false },
    { key: "operating_income", label: "영업이익",      bold: true  },
    { key: "fin_income",       label: "금융수익",      bold: false },
    { key: "fin_expense",      label: "금융비용",      bold: false },
    { key: "other_income",     label: "기타수익",      bold: false },
    { key: "other_expense",    label: "기타비용",      bold: false },
    { key: "tax",              label: "법인세비용",    bold: false },
    { key: "net_income",       label: "당기순이익",    bold: true  },
  ];

  const rev = data.current.revenue || 1;

  return (
    <div className="wrap">
      {/* KPI 4개 */}
      <div className="kpi-strip">
        {[
          { label: "매출액",    key: "revenue" },
          { label: "매출총이익", key: "gross_profit" },
          { label: "영업이익",  key: "operating_income" },
          { label: "당기순이익", key: "net_income" },
        ].map(({ label, key }) => {
          const chg = data.change[key];
          return (
            <div key={key} className="kpi">
              <div className="kpi-lbl">{label}</div>
              <div className="kpi-val">{fmtB(data.current[key])}<span className="u">백만</span></div>
              <div className={`kpi-chg ${chg >= 0 ? "up" : "dn"}`}>{arrowTxt(chg)}</div>
            </div>
          );
        })}
      </div>

      {/* 전월대비 매출 */}
      <div style={{ marginBottom: 16, color: data.prev_month_rev_diff >= 0 ? "#4fc3f7" : "#ef9a9a", fontSize: 13 }}>
        전월 대비 매출 {data.prev_month_rev_diff >= 0 ? "▲" : "▼"} {fmtB(Math.abs(data.prev_month_rev_diff))} 백만
      </div>

      {/* PL 테이블 */}
      <div className="card">
        <div className="card-title">손익계산서</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>항목</th><th>당기</th><th>전기</th><th>증감률</th><th>매출비중</th></tr>
            </thead>
            <tbody>
              {items.map(({ key, label, bold }) => {
                const cur = data.current[key] ?? 0;
                const pri = data.prior[key] ?? 0;
                const chg = data.change[key] ?? 0;
                return (
                  <tr key={key} className={bold ? "tr-sum" : ""}>
                    <td className={!bold ? "td-s1" : ""}>{label}</td>
                    <td>{fmt(cur)}</td>
                    <td>{fmt(pri)}</td>
                    <td className={chg >= 0 ? "up-t" : "dn-t"}>
                      {chg >= 0 ? "▲" : "▼"}{Math.abs(chg * 100).toFixed(1)}%
                    </td>
                    <td style={{ color: "#aaa" }}>{(cur / rev * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
