"use client";

import { create } from "zustand";
import type { FilterState, PeriodType, CompareTarget, BsBase } from "@/lib/api";

interface FilterStore extends FilterState {
  setBaseYm: (v: string) => void;
  setPeriodType: (v: PeriodType) => void;
  setCompareTarget: (v: CompareTarget) => void;
  setBsBase: (v: BsBase) => void;
}

export const useFilter = create<FilterStore>((set) => ({
  baseYm: "2025-09",
  periodType: "cumulative",
  compareTarget: "prev_year_cum",
  bsBase: "year_start",

  setBaseYm: (v) => set({ baseYm: v }),
  setPeriodType: (v) => set({ periodType: v }),
  setCompareTarget: (v) => set({ compareTarget: v }),
  setBsBase: (v) => set({ bsBase: v }),
}));
