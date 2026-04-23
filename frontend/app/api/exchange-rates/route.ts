import { NextResponse } from "next/server";

// 서버 fetch 실패 시 사용할 근사 fallback 환율 (KRW 기준, 2025년 기준)
const FALLBACK_RATES: Record<string, number> = {
  KRW: 1,
  USD: 0.000724,
  EUR: 0.000661,
  JPY: 0.1087,
  CNY: 0.00524,
  GBP: 0.000558,
  HKD: 0.00565,
  SGD: 0.000964,
  AUD: 0.001113,
  CAD: 0.001000,
  CHF: 0.000638,
  SEK: 0.00739,
  NOK: 0.00772,
  DKK: 0.00493,
  NZD: 0.001220,
  MXN: 0.01469,
  BRL: 0.004178,
  INR: 0.06086,
  RUB: 0.06602,
  ZAR: 0.01347,
  THB: 0.02600,
  MYR: 0.003253,
  IDR: 11.77,
  PHP: 0.04176,
  VND: 18.51,
  TWD: 0.02366,
};

export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=KRW", {
      next: { revalidate: 21600 }, // 6시간 캐시
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data: { rates: Record<string, number> } = await res.json();
    return NextResponse.json({ KRW: 1, ...data.rates });
  } catch {
    // 외부 API 차단 시 fallback 환율 반환
    return NextResponse.json(FALLBACK_RATES, {
      headers: { "X-Rates-Source": "fallback" },
    });
  }
}
