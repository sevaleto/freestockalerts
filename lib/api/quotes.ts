import { mockQuotes, mockQuoteMap } from "@/lib/mock/quotes";
import { mockTickers } from "@/lib/mock/tickers";
import { fetchAlphaVantageQuote } from "@/lib/api/alphaVantage";
import { fetchFmpBatchQuotes, fetchFmpQuote } from "@/lib/api/fmp";

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

const cacheGet = (key: string) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
};

const cacheSet = (key: string, data: any) => {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const getQuote = async (ticker: string) => {
  const cached = cacheGet(`quote:${ticker}`);
  if (cached) return cached;

  // TODO: Replace with live API calls (FMP primary, Alpha Vantage fallback)
  const quote = (await fetchFmpQuote(ticker)) ?? (await fetchAlphaVantageQuote(ticker));
  if (!quote) {
    const fallback = mockQuoteMap.get(ticker) ?? mockQuotes[0];
    cacheSet(`quote:${ticker}`, fallback);
    return fallback;
  }

  cacheSet(`quote:${ticker}`, quote);
  return quote;
};

export const getBatchQuotes = async (tickers: string[]) => {
  const cacheKey = `batch:${tickers.sort().join(",")}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // TODO: Replace with live API calls and batching rules
  const quotes = await fetchFmpBatchQuotes(tickers);
  cacheSet(cacheKey, quotes);
  return quotes;
};

export const searchTickers = async (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  // TODO: Replace with live FMP search API call
  return mockTickers.filter(
    (ticker) =>
      ticker.ticker.toLowerCase().includes(normalized) ||
      ticker.companyName.toLowerCase().includes(normalized)
  );
};
