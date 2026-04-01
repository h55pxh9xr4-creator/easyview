"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchScenario } from "@/lib/api";
import ScenarioTable, { ScRow } from "./ScenarioTable";

export default function SC3() {
  const { baseYm } = useFilter();
  const [rows, setRows] = useState<ScRow[] | null>(null);
  useEffect(() => {
    fetchScenario(3, baseYm).then((d) => setRows(d as ScRow[])).catch(console.error);
  }, [baseYm]);
  return <ScenarioTable
    title="시나리오3: 주말 현금지급"
    desc="토·일요일에 발생한 현금 대변 전표"
    rows={rows}
  />;
}
