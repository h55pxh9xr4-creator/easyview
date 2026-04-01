"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchScenario } from "@/lib/api";
import ScenarioTable, { ScRow } from "./ScenarioTable";

export default function SC5() {
  const { baseYm } = useFilter();
  const [rows, setRows] = useState<ScRow[] | null>(null);
  useEffect(() => {
    fetchScenario(5, baseYm).then((d) => setRows(d as ScRow[])).catch(console.error);
  }, [baseYm]);
  return <ScenarioTable
    title="시나리오5: 현금지급 및 비용인식 동시 발생"
    desc="동일 전표에 비용 차변과 현금 대변이 함께 존재"
    rows={rows}
    extraCols={[{ key: "type", label: "유형" }]}
  />;
}
