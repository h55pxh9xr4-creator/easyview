"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchScenario } from "@/lib/api";
import ScenarioTable, { ScRow } from "./ScenarioTable";

export default function SC4() {
  const { baseYm } = useFilter();
  const [threshold, setThreshold] = useState(1000000);
  const [rows, setRows] = useState<ScRow[] | null>(null);

  useEffect(() => {
    fetchScenario(4, baseYm, { threshold }).then((d) => setRows(d as ScRow[])).catch(console.error);
  }, [baseYm, threshold]);

  return (
    <>
      <div className="wrap" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span className="flabel">기준금액</span>
          <select className="fsel" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            <option value={500000}>50만원 이상</option>
            <option value={1000000}>100만원 이상</option>
            <option value={3000000}>300만원 이상</option>
            <option value={5000000}>500만원 이상</option>
            <option value={10000000}>1,000만원 이상</option>
          </select>
        </div>
      </div>
      <ScenarioTable
        title="시나리오4: 고액 현금지급"
        desc={`기준금액(${(threshold / 10000).toLocaleString()}만원) 이상의 현금 대변 전표`}
        rows={rows}
      />
    </>
  );
}
