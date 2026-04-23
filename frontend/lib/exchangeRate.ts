export type ExchangeRates = Record<string, number>;

const FALLBACK_RATES: ExchangeRates = {
  KRW: 1,
  USD: 0.000724, EUR: 0.000661, JPY: 0.1087,  CNY: 0.00524,
  GBP: 0.000558, HKD: 0.00565,  SGD: 0.000964, AUD: 0.001113,
  CAD: 0.001000, CHF: 0.000638, SEK: 0.00739,  NOK: 0.00772,
  DKK: 0.00493,  NZD: 0.001220, MXN: 0.01469,  BRL: 0.004178,
  INR: 0.06086,  RUB: 0.06602,  ZAR: 0.01347,  THB: 0.02600,
  MYR: 0.003253, IDR: 11.77,    PHP: 0.04176,  VND: 18.51,
  TWD: 0.02366,
};

let _cache: { rates: ExchangeRates; ts: number } | null = null;
const TTL = 1000 * 60 * 60 * 6; // 6시간 캐시

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.rates;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=KRW");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data: { rates: Record<string, number> } = await res.json();
    const rates = { KRW: 1, ...data.rates };
    _cache = { rates, ts: Date.now() };
    return rates;
  } catch {
    // 사내망 등 외부 API 차단 환경에서는 fallback 환율 사용
    return FALLBACK_RATES;
  }
}
