import { useFilter } from "@/hooks/useFilter";
import type { AmountUnit } from "@/hooks/useFilter";

export const fmtByUnit = (n: number, unit: AmountUnit): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  switch (unit) {
    case "원":  return sign + Math.round(abs).toLocaleString("ko-KR");
    case "천":  return sign + Math.round(abs / 1_000).toLocaleString("ko-KR");
    case "백만": return sign + Math.round(abs / 1_000_000).toLocaleString("ko-KR");
    case "억":  return sign + (abs / 100_000_000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
};

// 외화: 천/백만/억 단위에서 소수점 2자리 허용 (환율 변환 후 정수가 아닐 수 있음)
const fmtForeignByUnit = (n: number, unit: AmountUnit): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fmt = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  switch (unit) {
    case "원":  return sign + Math.round(abs).toLocaleString("ko-KR");
    case "천":  return sign + fmt(abs / 1_000);
    case "백만": return sign + fmt(abs / 1_000_000);
    case "억":  return sign + fmt(abs / 100_000_000);
  }
};

export const unitSuffix = (unit: AmountUnit): string => {
  switch (unit) {
    case "원":  return "원";
    case "천":  return "천원";
    case "백만": return "백만원";
    case "억":  return "억원";
  }
};

export const unitLabel = (unit: AmountUnit): string => {
  switch (unit) {
    case "원":  return "원";
    case "천":  return "천";
    case "백만": return "백만";
    case "억":  return "억";
  }
};

const currencyUnitLabel = (unit: AmountUnit, currency: string): string => {
  if (currency === "KRW") return unitLabel(unit);
  return unit === "원" ? currency : `${unit} ${currency}`;
};

const currencyUnitSuffix = (unit: AmountUnit, currency: string): string => {
  if (currency === "KRW") return unitSuffix(unit);
  return unit === "원" ? currency : `${unit} ${currency}`;
};

export function useAmountFormat() {
  const { amountUnit, currency, exchangeRates } = useFilter();
  const rate = exchangeRates[currency] ?? 1;
  const isKrw = currency === "KRW";

  return {
    fmtAmt: (n: number) => {
      const converted = n * rate;
      return isKrw ? fmtByUnit(converted, amountUnit) : fmtForeignByUnit(converted, amountUnit);
    },
    unitLabel: currencyUnitLabel(amountUnit, currency),
    unitSuffix: currencyUnitSuffix(amountUnit, currency),
    amountUnit,
    currency,
  };
}
