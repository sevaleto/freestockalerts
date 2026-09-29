import { mockQuoteMap } from "@/lib/mock/quotes";
import { mockTickers } from "@/lib/mock/tickers";
import { fetchAlphaVantageQuote } from "@/lib/api/alphaVantage";
import { fetchTdBatchQuotes, fetchTdQuote, searchTdSymbols } from "@/lib/api/twelveData";

/**
 * Quote access for the app. Twelve Data is the primary source (FMP was retired
 * 2026-09-18); Alpha Vantage's free GLOBAL_QUOTE is the fallback when Twelve
 * Data is unconfigured or returns nothing. Without TWELVE_DATA_API_KEY the
 * Twelve Data calls throw immediately and the fallback runs.
 */

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

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

  let quote = null;
  try {
    quote = await fetchTdQuote(ticker);
  } catch (error) {
    console.warn(`[getQuote] Twelve Data failed for ${ticker}:`, error instanceof Error ? error.message : error);
  }
  if (!quote) quote = await fetchAlphaVantageQuote(ticker);

  if (!quote) {
    console.warn(`[getQuote] No real quote available for ${ticker} — returning null (no mock fallback)`);
    return null;
  }

  cacheSet(`quote:${ticker}`, quote);
  return quote;
};

export const getBatchQuotes = async (tickers: string[], options?: { skipMock?: boolean }) => {
  const cacheKey = `batch:${[...tickers].sort().join(",")}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let quotes = [] as any[];
  try {
    quotes = await fetchTdBatchQuotes(tickers);
  } catch (error) {
    console.warn(`[getBatchQuotes] Twelve Data failed:`, error instanceof Error ? error.message : error);
    quotes = [];
  }

  // Fallback: if Twelve Data returned nothing, try Alpha Vantage individually
  if (quotes.length === 0) {
    console.warn(`[getBatchQuotes] Twelve Data empty — falling back to Alpha Vantage for ${tickers.length} tickers`);
    const AV_CONCURRENCY = 5;
    const avResults: any[] = [];
    for (let i = 0; i < tickers.length; i += AV_CONCURRENCY) {
      const batch = tickers.slice(i, i + AV_CONCURRENCY);
      const settled = await Promise.allSettled(batch.map((t) => fetchAlphaVantageQuote(t)));
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) avResults.push(r.value);
      }
    }
    quotes = avResults;
  }

  if (quotes.length === 0 && !options?.skipMock) {
    quotes = tickers.map((ticker) => mockQuoteMap.get(ticker)).filter(Boolean) as any[];
  }
  cacheSet(cacheKey, quotes);
  return quotes;
};

export const searchTickers = async (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  try {
    const results = await searchTdSymbols(query);
    if (results.length > 0) return results;
  } catch (error) {
    // fall through to the built-in list
  }

  return mockTickers
    .filter(
      (ticker) =>
        ticker.ticker.toLowerCase().includes(normalized) ||
        ticker.companyName.toLowerCase().includes(normalized)
    )
    .slice(0, 10);
};
