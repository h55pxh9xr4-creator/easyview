"use client";

import { useEffect, useState } from "react";
import { useFilter } from "@/hooks/useFilter";
import { fetchScenario } from "@/lib/api";
import ScenarioTable, { ScRow } from "./ScenarioTable";

export default function SC1() {
  const { baseYm } = useFilter();
  const [rows, setRows] = useState<ScRow[] | null>(null);
  useEffect(() => {
    fetchScenario(1, baseYm).then((d) => setRows(d as ScRow[])).catch(console.error);
  }, [baseYm]);
  return <ScenarioTable
    title="시나리오1: 동일금액 중복 전표"
    desc="동일 연월·계정·차대·금액이 2건 이상 반복 등록된 전표"
    rows={rows}
    extraCols={[{ key: "dup_count", label: "중복수" }]}
  />;
}
