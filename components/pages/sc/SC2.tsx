"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchScenario } from "@/lib/api";
import ScenarioTable, { ScRow } from "./ScenarioTable";

export default function SC2() {
  const { baseYm } = useFilter();
  const [rows, setRows] = useState<ScRow[] | null>(null);
  useEffect(() => {
    fetchScenario(2, baseYm).then((d) => setRows(d as ScRow[])).catch(console.error);
  }, [baseYm]);
  return <ScenarioTable
    title="시나리오2: 현금지급 後 부채인식"
    desc="동일 연월·금액에 현금 대변과 부채 대변이 동시에 존재하는 전표"
    rows={rows}
    extraCols={[{ key: "type", label: "유형" }]}
  />;
}
