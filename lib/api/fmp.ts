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

// ---------------------------------------------------------------------------
// Average volume
// The /stable/quote endpoint returns no avgVolume, which left every
// VOLUME_SPIKE alert unevaluable. Compute a 30-session average from the
// lightweight historical endpoint instead. Changes once a day, so cache long.
// ---------------------------------------------------------------------------

const AVG_VOLUME_TTL_MS = 6 * 60 * 60_000; // 6 hours
const AVG_VOLUME_SESSIONS = 30;

/**
 * Recent daily closes, newest first (about 60 sessions), from the same
 * lightweight endpoint. Used for relative-performance context on sector alerts.
 */
export const fetchFmpHistoricalCloses = async (ticker: string, sessions = 60): Promise<number[]> => {
  const normalized = ticker.trim().toUpperCase();
  const cacheKey = `closes:${normalized}:${sessions}`;
  const entry = quoteCache.get(cacheKey);
  if (entry && Date.now() <= entry.expiresAt) return entry.data;

  const data = (await fmpFetch(
    `/historical-price-eod/light?symbol=${encodeURIComponent(normalized)}`
  )) as Array<{ date: string; price?: number }>;
  const closes = (Array.isArray(data) ? data : [])
    .slice(0, sessions)
    .map((r) => toNumber(r.price))
    .filter((v): v is number => v !== undefined && v > 0);
  quoteCache.set(cacheKey, { data: closes, expiresAt: Date.now() + AVG_VOLUME_TTL_MS });
  return closes;
};

export const fetchFmpAvgVolume = async (ticker: string): Promise<number | null> => {
  const normalized = ticker.trim().toUpperCase();
  const cacheKey = `avgvol:${normalized}`;
  const entry = quoteCache.get(cacheKey);
  if (entry && Date.now() <= entry.expiresAt) return entry.data;

  const data = (await fmpFetch(
    `/historical-price-eod/light?symbol=${encodeURIComponent(normalized)}`
  )) as Array<{ date: string; volume?: number }>;
  const rows = (Array.isArray(data) ? data : []).slice(0, AVG_VOLUME_SESSIONS);
  const volumes = rows.map((r) => toNumber(r.volume)).filter((v): v is number => v !== undefined && v > 0);
  if (volumes.length === 0) return null;

  const avg = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);
  quoteCache.set(cacheKey, { data: avg, expiresAt: Date.now() + AVG_VOLUME_TTL_MS });
  return avg;
};

// ---------------------------------------------------------------------------
// Event-strategy sources: insider transactions, analyst grades, daily bars.
// Same key, same base URL, same in-process cache. These feeds change once a
// day, so they are cached for hours, and the pulls that page through the
// whole market retry on 429/5xx instead of failing the scan.
// ---------------------------------------------------------------------------

const EVENT_FEED_TTL_MS = 30 * 60_000; // 30 minutes: a scan re-run within the window is free
const RETRY_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fmpFetch with backoff on rate limits and server errors. */
export const fmpFetchRetry = async <T>(path: string): Promise<T> => {
  let last: unknown;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return (await fmpFetch(path)) as T;
    } catch (err) {
      last = err;
      const retryable = err instanceof FmpError && (err.code === "RATE_LIMIT" || (err.status ?? 0) >= 500);
      if (!retryable || attempt === RETRY_ATTEMPTS - 1) throw err;
      const wait = (err instanceof FmpError && err.code === "RATE_LIMIT" ? 8000 : 1500) * (attempt + 1);
      console.warn(`[fmp] ${path.split("?")[0]} ${err instanceof FmpError ? err.status : ""} — retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw last;
};

const cachedFeed = async <T>(key: string, path: string, ttl = EVENT_FEED_TTL_MS): Promise<T> => {
  const entry = quoteCache.get(key);
  if (entry && Date.now() <= entry.expiresAt) return entry.data as T;
  const data = await fmpFetchRetry<T>(path);
  quoteCache.set(key, { data, expiresAt: Date.now() + ttl });
  return data;
};

/** One page of open-market purchases (code P) across the whole market, newest filing first. */
export const fetchFmpInsiderPurchases = (page: number, limit = 1000) =>
  cachedFeed<unknown[]>(`insider-purchases:${page}:${limit}`, `/insider-trading/search?transactionType=P-Purchase&page=${page}&limit=${limit}`);

/** All recent insider transactions for one symbol (every code). */
export const fetchFmpInsiderTransactions = (ticker: string, limit = 100) => {
  const t = ticker.trim().toUpperCase();
  return cachedFeed<unknown[]>(`insider-symbol:${t}:${limit}`, `/insider-trading/search?symbol=${encodeURIComponent(t)}&page=0&limit=${limit}`);
};

/** One page of the cross-market analyst-grade feed, newest first. */
export const fetchFmpGradesLatest = (page: number, limit = 1000) =>
  cachedFeed<unknown[]>(`grades-latest:${page}:${limit}`, `/grades-latest-news?page=${page}&limit=${limit}`);

/** Every recorded analyst action for one symbol, newest first (the provider ignores limit). */
export const fetchFmpGrades = (ticker: string) => {
  const t = ticker.trim().toUpperCase();
  return cachedFeed<unknown[]>(`grades:${t}`, `/grades?symbol=${encodeURIComponent(t)}`);
};

export interface FmpDailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Daily OHLCV from `from` (YYYY-MM-DD) to today, oldest first. */
export const fetchFmpDailyBars = async (ticker: string, from: string): Promise<FmpDailyBar[]> => {
  const t = ticker.trim().toUpperCase();
  const rows = await cachedFeed<Array<Record<string, unknown>>>(
    `bars:${t}:${from}`,
    `/historical-price-eod/full?symbol=${encodeURIComponent(t)}&from=${from}`,
    AVG_VOLUME_TTL_MS
  );
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      date: String(r.date ?? "").slice(0, 10),
      open: toNumber(r.open) ?? 0,
      high: toNumber(r.high) ?? 0,
      low: toNumber(r.low) ?? 0,
      close: toNumber(r.close) ?? 0,
      volume: toNumber(r.volume) ?? 0,
    }))
    .filter((b) => b.date && b.close > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
};

// ---------------------------------------------------------------------------
// Alert-context enrichment: news, analyst consensus, price targets, earnings.
// Fetched once per triggered alert (rare) and cached, so the AI paragraph can
// say why a stock moved and what is next without inventing anything.
// ---------------------------------------------------------------------------

export interface FmpNewsItem {
  title: string;
  publisher: string;
  site: string;
  /** YYYY-MM-DD HH:mm:ss as the provider gives it. */
  publishedDate: string;
  snippet: string;
  url: string;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Latest headlines for one symbol, newest first. Snippets are plain text, capped at 220 chars. */
export const fetchFmpStockNews = async (ticker: string, limit = 5): Promise<FmpNewsItem[]> => {
  const t = ticker.trim().toUpperCase();
  const rows = await cachedFeed<Array<Record<string, unknown>>>(`news:${t}:${limit}`, `/news/stock?symbols=${encodeURIComponent(t)}&limit=${limit}`);
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      title: stripHtml(String(r.title ?? "")).slice(0, 200),
      publisher: String(r.publisher ?? r.site ?? "").slice(0, 80),
      site: String(r.site ?? "").slice(0, 80),
      publishedDate: String(r.publishedDate ?? "").slice(0, 19),
      snippet: stripHtml(String(r.text ?? "")).slice(0, 220),
      url: typeof r.url === "string" ? r.url : "",
    }))
    .filter((n) => n.title);
};

export interface FmpGradesConsensus {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  consensus: string;
}

export const fetchFmpGradesConsensus = async (ticker: string): Promise<FmpGradesConsensus | null> => {
  const t = ticker.trim().toUpperCase();
  const rows = await cachedFeed<Array<Record<string, unknown>>>(`grades-consensus:${t}`, `/grades-consensus?symbol=${encodeURIComponent(t)}`, AVG_VOLUME_TTL_MS);
  const r = Array.isArray(rows) ? rows[0] : undefined;
  if (!r) return null;
  return {
    strongBuy: toNumber(r.strongBuy) ?? 0,
    buy: toNumber(r.buy) ?? 0,
    hold: toNumber(r.hold) ?? 0,
    sell: toNumber(r.sell) ?? 0,
    strongSell: toNumber(r.strongSell) ?? 0,
    consensus: String(r.consensus ?? ""),
  };
};

export interface FmpPriceTargetConsensus {
  high: number;
  low: number;
  consensus: number;
  median: number;
}

export const fetchFmpPriceTargetConsensus = async (ticker: string): Promise<FmpPriceTargetConsensus | null> => {
  const t = ticker.trim().toUpperCase();
  const rows = await cachedFeed<Array<Record<string, unknown>>>(`price-target:${t}`, `/price-target-consensus?symbol=${encodeURIComponent(t)}`, AVG_VOLUME_TTL_MS);
  const r = Array.isArray(rows) ? rows[0] : undefined;
  const consensus = toNumber(r?.targetConsensus);
  if (!r || consensus === undefined || consensus <= 0) return null;
  return {
    high: toNumber(r.targetHigh) ?? 0,
    low: toNumber(r.targetLow) ?? 0,
    consensus,
    median: toNumber(r.targetMedian) ?? consensus,
  };
};

export interface FmpEarningsSnapshot {
  next: { date: string; epsEstimated: number | null; revenueEstimated: number | null } | null;
  last: { date: string; epsActual: number; epsEstimated: number | null; revenueActual: number | null; revenueEstimated: number | null } | null;
}

/** The next scheduled report and the most recent reported one. */
export const fetchFmpEarningsSnapshot = async (ticker: string, today = new Date()): Promise<FmpEarningsSnapshot> => {
  const t = ticker.trim().toUpperCase();
  const rows = await cachedFeed<Array<Record<string, unknown>>>(`earnings-snapshot:${t}`, `/earnings?symbol=${encodeURIComponent(t)}&limit=8`, INDICATOR_CACHE_TTL_MS);
  const list = (Array.isArray(rows) ? rows : []).filter((r) => typeof r.date === "string");
  const todayKey = today.toISOString().slice(0, 10);
  const upcoming = list.filter((r) => String(r.date) >= todayKey && toNumber(r.epsActual) === undefined).sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1))[0];
  const reported = list.filter((r) => toNumber(r.epsActual) !== undefined).sort((a, b) => (String(a.date) > String(b.date) ? -1 : 1))[0];
  return {
    next: upcoming ? { date: String(upcoming.date), epsEstimated: toNumber(upcoming.epsEstimated) ?? null, revenueEstimated: toNumber(upcoming.revenueEstimated) ?? null } : null,
    last: reported
      ? {
          date: String(reported.date),
          epsActual: toNumber(reported.epsActual)!,
          epsEstimated: toNumber(reported.epsEstimated) ?? null,
          revenueActual: toNumber(reported.revenueActual) ?? null,
          revenueEstimated: toNumber(reported.revenueEstimated) ?? null,
        }
      : null,
  };
};

// ---------------------------------------------------------------------------
// Market-wide news feed (newest first), for picking the day's newsletter topics.
// ---------------------------------------------------------------------------

export interface FmpMarketNewsItem extends FmpNewsItem {
  /** Ticker the story is filed under; null on general-market items. */
  symbol: string | null;
}

/** One page of the latest stock-tagged headlines across the market. */
export const fetchFmpLatestStockNews = async (limit = 250, page = 0): Promise<FmpMarketNewsItem[]> => {
  const rows = await cachedFeed<Array<Record<string, unknown>>>(`news:latest:${page}:${limit}`, `/news/stock-latest?page=${page}&limit=${limit}`, 5 * 60_000);
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      symbol: typeof r.symbol === "string" && r.symbol.trim() ? r.symbol.trim().toUpperCase() : null,
      title: stripHtml(String(r.title ?? "")).slice(0, 200),
      publisher: String(r.publisher ?? r.site ?? "").slice(0, 80),
      site: String(r.site ?? "").slice(0, 80),
      publishedDate: String(r.publishedDate ?? "").slice(0, 19),
      snippet: stripHtml(String(r.text ?? "")).slice(0, 300),
      url: typeof r.url === "string" ? r.url : "",
    }))
    .filter((n) => n.title);
};

// ---------------------------------------------------------------------------
// Company profile: enough to tell a stock from an ETF or fund.
// ---------------------------------------------------------------------------

export interface FmpProfileLite {
  symbol: string;
  companyName: string | null;
  isEtf: boolean;
  isFund: boolean;
  isActivelyTrading: boolean;
  marketCap: number | null;
}

/** Null when FMP has no profile for the symbol. Cached for an hour. */
export const fetchFmpProfileLite = async (ticker: string): Promise<FmpProfileLite | null> => {
  const t = ticker.trim().toUpperCase();
  const rows = await cachedFeed<Array<Record<string, unknown>>>(`profile:${t}`, `/profile?symbol=${encodeURIComponent(t)}`, 60 * 60_000);
  const r = Array.isArray(rows) ? rows[0] : null;
  if (!r || typeof r.symbol !== "string") return null;
  return {
    symbol: r.symbol,
    companyName: typeof r.companyName === "string" ? r.companyName : null,
    isEtf: r.isEtf === true,
    isFund: r.isFund === true,
    isActivelyTrading: r.isActivelyTrading !== false,
    marketCap: toNumber(r.marketCap) ?? null,
  };
};
