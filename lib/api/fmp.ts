const FMP_BASE_URL = "https://financialmodelingprep.com/stable";
const CACHE_TTL_MS = 60_000; // 1 minute — FMP Premium has generous limits
const MAX_CONCURRENCY = 5; // max parallel single-ticker fetches

export class FmpError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "FmpError";
    this.status = status;
    this.code = code;
  }
}

type FmpQuoteResponse = {
  symbol: string;
  name?: string;
  price?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  change?: number;
  changePercentage?: number;
  volume?: number;
  avgVolume?: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  priceAvg50?: number;
  priceAvg200?: number;
  exchange?: string;
  previousClose?: number;
  timestamp?: number;
  earningsAnnouncement?: string;
};

type CachedQuote = {
  data: any;
  expiresAt: number;
};

const quoteCache = new Map<string, CachedQuote>();

const cacheGet = (key: string) => {
  const entry = quoteCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    quoteCache.delete(key);
    return null;
  }
  return entry.data;
};

const cacheSet = (key: string, data: any) => {
  quoteCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const mapFmpQuote = (quote: FmpQuoteResponse) => {
  const dayChange = toNumber(quote.change) ?? 0;
  const dayChangePercent = toNumber(quote.changePercentage) ?? 0;
  return {
    ticker: quote.symbol,
    companyName: quote.name ?? quote.symbol,
    price: toNumber(quote.price) ?? 0,
    dayOpen: toNumber(quote.open) ?? 0,
    dayHigh: toNumber(quote.dayHigh) ?? 0,
    dayLow: toNumber(quote.dayLow) ?? 0,
    dayChange,
    dayChangePercent,
    change: dayChange,
    changePercent: dayChangePercent,
    volume: toNumber(quote.volume) ?? 0,
    avgVolume: toNumber(quote.avgVolume) ?? 0,
    fiftyTwoWeekHigh: toNumber(quote.yearHigh) ?? 0,
    fiftyTwoWeekLow: toNumber(quote.yearLow) ?? 0,
    previousClose: toNumber(quote.previousClose) ?? 0,
    marketCap: toNumber(quote.marketCap) ?? 0,
    sma50: toNumber(quote.priceAvg50),
    sma200: toNumber(quote.priceAvg200),
    nextEarningsDate: quote.earningsAnnouncement
      ? quote.earningsAnnouncement.split("T")[0]
      : undefined,
  };
};

const getApiKey = () => {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new FmpError("Missing FMP_API_KEY", 500, "MISSING_KEY");
  }
  return key;
};

/**
 * Fetch from the FMP /stable/ API.
 * The new stable API uses query params: /endpoint?symbol=X&apikey=KEY
 * For endpoints that don't use `symbol` (like search), pass the full query string.
 */
const fmpFetch = async (path: string) => {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${FMP_BASE_URL}${path}${separator}apikey=${getApiKey()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const isRateLimit = response.status === 429 || text.toLowerCase().includes("rate");
    throw new FmpError(
      `FMP request failed (${response.status})`,
      response.status,
      isRateLimit ? "RATE_LIMIT" : "REQUEST_FAILED"
    );
  }
  return response.json();
};

export const fetchFmpQuote = async (ticker: string) => {
  const normalized = ticker.trim().toUpperCase();
  const cacheKey = `quote:${normalized}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = (await fmpFetch(
    `/quote?symbol=${encodeURIComponent(normalized)}`
  )) as FmpQuoteResponse[];
  const quote = data?.[0];
  if (!quote) return null;
  const mapped = mapFmpQuote(quote);
  cacheSet(cacheKey, mapped);
  return mapped;
};

/**
 * Fetch quotes for multiple tickers.
 * FMP /stable/ does NOT support batch (comma-separated) — returns [].
 * Fetch one-at-a-time with concurrency cap.
 */
export const fetchFmpBatchQuotes = async (tickers: string[]) => {
  const normalized = Array.from(
    new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))
  );
  if (normalized.length === 0) return [];

  const results: any[] = [];
  const missing: string[] = [];

  for (const ticker of normalized) {
    const cached = cacheGet(`quote:${ticker}`);
    if (cached) results.push(cached);
    else missing.push(ticker);
  }

  // Fetch missing tickers in batches of MAX_CONCURRENCY
  for (let i = 0; i < missing.length; i += MAX_CONCURRENCY) {
    const batch = missing.slice(i, i + MAX_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((ticker) => fetchFmpQuote(ticker))
    );
    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    }
  }

  const resultMap = new Map(results.map((quote) => [quote.ticker, quote]));
  return normalized.map((ticker) => resultMap.get(ticker)).filter(Boolean);
};

export const searchFmpTickers = async (query: string) => {
  const normalized = query.trim();
  if (!normalized) return [];
  const data = (await fmpFetch(
    `/search-symbol?query=${encodeURIComponent(normalized)}&limit=10`
  )) as Array<{ symbol: string; name?: string }>;
  return (Array.isArray(data) ? data : []).map((item) => ({
    ticker: item.symbol,
    companyName: item.name ?? item.symbol,
  }));
};

// ---------------------------------------------------------------------------
// Technical indicators + earnings calendar
// Daily-timeframe data changes at most once per trading day, so cache longer.
// ---------------------------------------------------------------------------

const INDICATOR_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

const indicatorCacheGet = (key: string) => {
  const entry = quoteCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    quoteCache.delete(key);
    return null;
  }
  return entry.data;
};

const indicatorCacheSet = (key: string, data: any) => {
  quoteCache.set(key, { data, expiresAt: Date.now() + INDICATOR_CACHE_TTL_MS });
};

type FmpIndicatorRow = {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  rsi?: number;
  sma?: number;
};

export interface RsiSnapshot {
  ticker: string;
  period: number;
  /** Most recent RSI value (today, computed on the latest close/price FMP has). */
  rsi: number;
  /** Previous trading day's RSI, if available. */
  previousRsi?: number;
  date: string;
}

export interface SmaSnapshot {
  ticker: string;
  period: number;
  /** Most recent SMA value. */
  sma: number;
  /** Close used for the most recent row. */
  close: number;
  /** Previous trading day's SMA and close, used to detect a cross. */
  previousSma?: number;
  previousClose?: number;
  date: string;
}

/**
 * Latest 14-period (default) daily RSI for a ticker.
 * Returns null when FMP has no data for the symbol.
 */
export const fetchFmpRsi = async (
  ticker: string,
  period = 14
): Promise<RsiSnapshot | null> => {
  const normalized = ticker.trim().toUpperCase();
  const cacheKey = `rsi:${normalized}:${period}`;
  const cached = indicatorCacheGet(cacheKey);
  if (cached) return cached;

  const data = (await fmpFetch(
    `/technical-indicators/rsi?symbol=${encodeURIComponent(normalized)}&periodLength=${period}&timeframe=1day`
  )) as FmpIndicatorRow[];
  const rows = Array.isArray(data) ? data : [];
  const latest = rows[0];
  const rsi = toNumber(latest?.rsi);
  if (!latest || rsi === undefined) return null;

  const snapshot: RsiSnapshot = {
    ticker: normalized,
    period,
    rsi,
    previousRsi: toNumber(rows[1]?.rsi),
    date: latest.date,
  };
  indicatorCacheSet(cacheKey, snapshot);
  return snapshot;
};

/**
 * Latest daily SMA for a ticker/period, plus the prior day's values so the
 * caller can detect a price/SMA cross rather than a standing condition.
 */
export const fetchFmpSma = async (
  ticker: string,
  period: number
): Promise<SmaSnapshot | null> => {
  const normalized = ticker.trim().toUpperCase();
  const cacheKey = `sma:${normalized}:${period}`;
  const cached = indicatorCacheGet(cacheKey);
  if (cached) return cached;

  const data = (await fmpFetch(
    `/technical-indicators/sma?symbol=${encodeURIComponent(normalized)}&periodLength=${period}&timeframe=1day`
  )) as FmpIndicatorRow[];
  const rows = Array.isArray(data) ? data : [];
  const latest = rows[0];
  const sma = toNumber(latest?.sma);
  const close = toNumber(latest?.close);
  if (!latest || sma === undefined || close === undefined) return null;

  const snapshot: SmaSnapshot = {
    ticker: normalized,
    period,
    sma,
    close,
    previousSma: toNumber(rows[1]?.sma),
    previousClose: toNumber(rows[1]?.close),
    date: latest.date,
  };
  indicatorCacheSet(cacheKey, snapshot);
  return snapshot;
};

type FmpEarningsRow = {
  symbol: string;
  date: string; // YYYY-MM-DD
  epsActual?: number | null;
  epsEstimated?: number | null;
};

/**
 * Next scheduled earnings date (YYYY-MM-DD) for a ticker, or null if FMP has
 * no upcoming date on the calendar.
 */
export const fetchFmpNextEarningsDate = async (
  ticker: string,
  today = new Date()
): Promise<string | null> => {
  const normalized = ticker.trim().toUpperCase();
  const cacheKey = `earnings:${normalized}`;
  const cached = indicatorCacheGet(cacheKey);
  if (cached !== null && cached !== undefined) return cached || null;

  const data = (await fmpFetch(
    `/earnings?symbol=${encodeURIComponent(normalized)}&limit=8`
  )) as FmpEarningsRow[];
  const rows = Array.isArray(data) ? data : [];
  const todayKey = today.toISOString().slice(0, 10);
  const upcoming = rows
    .map((row) => row.date)
    .filter((date) => typeof date === "string" && date >= todayKey)
    .sort();
  const next = upcoming[0] ?? "";
  indicatorCacheSet(cacheKey, next);
  return next || null;
};
