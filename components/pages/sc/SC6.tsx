"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchScenario } from "@/lib/api";
import ScenarioTable, { ScRow } from "./ScenarioTable";

export default function SC6() {
  const { baseYm } = useFilter();
  const [threshold, setThreshold] = useState(10);
  const [rows, setRows] = useState<ScRow[] | null>(null);

  useEffect(() => {
    fetchScenario(6, baseYm, { threshold }).then((d) => setRows(d as ScRow[])).catch(console.error);
  }, [baseYm, threshold]);

  return (
    <>
      <div className="wrap" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span className="flabel">전체 전표수 기준</span>
          <select className="fsel" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            <option value={5}>5건 이하</option>
            <option value={10}>10건 이하</option>
            <option value={20}>20건 이하</option>
            <option value={50}>50건 이하</option>
          </select>
        </div>
      </div>
      <ScenarioTable
        title="시나리오6: 희소 거래처"
        desc={`전체 기간 전표수가 ${threshold}건 이하인 거래처의 전표`}
        rows={rows}
        extraCols={[{ key: "total_voucher_cnt", label: "거래처 전표수" }]}
      />
    </>
  );
}
