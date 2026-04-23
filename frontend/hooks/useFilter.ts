"use client";

import { create } from "zustand";
import type { FilterState, PeriodType, CompareTarget, BsBase } from "@/lib/api";
import type { ExchangeRates } from "@/lib/exchangeRate";

export type AmountUnit = "원" | "천" | "백만" | "억";

interface FilterStore extends FilterState {
  setBaseYm: (v: string) => void;
  setPeriodType: (v: PeriodType) => void;
  setCompareTarget: (v: CompareTarget) => void;
  setBsBase: (v: BsBase) => void;
  amountUnit: AmountUnit;
  setAmountUnit: (v: AmountUnit) => void;
  currency: string;
  setCurrency: (v: string) => void;
  exchangeRates: ExchangeRates;
  setExchangeRates: (v: ExchangeRates) => void;
}

export const useFilter = create<FilterStore>((set) => ({
  baseYm: "2025-09",
  periodType: "cumulative",
  compareTarget: "prev_year_cum",
  bsBase: "year_start",
  amountUnit: "원",
  currency: "KRW",
  exchangeRates: { KRW: 1 },

  setBaseYm: (v) => set({ baseYm: v }),
  setPeriodType: (v) => set({ periodType: v }),
  setCompareTarget: (v) => set({ compareTarget: v }),
  setBsBase: (v) => set({ bsBase: v }),
  setAmountUnit: (v) => set({ amountUnit: v }),
  setCurrency: (v) => set({ currency: v }),
  setExchangeRates: (v) => set({ exchangeRates: v }),
}));
