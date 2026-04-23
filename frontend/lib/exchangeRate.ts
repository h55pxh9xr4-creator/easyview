export type ExchangeRates = Record<string, number>;

let _cache: { rates: ExchangeRates; ts: number } | null = null;
const TTL = 1000 * 60 * 60 * 6; // 6시간 캐시

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.rates;
  const res = await fetch("/api/exchange-rates");
  if (!res.ok) throw new Error("환율 조회 실패");
  const rates: ExchangeRates = await res.json();
  _cache = { rates, ts: Date.now() };
  return rates;
}
