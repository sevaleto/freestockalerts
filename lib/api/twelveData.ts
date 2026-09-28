/**
 * Twelve Data client (https://twelvedata.com/docs). Primary source for quotes,
 * daily bars and symbol search since FMP was retired (2026-09-18).
 *
 * Licensing: only a Venture (business) key may feed anything a subscriber sees.
 * Venture requires "Source: Twelve Data" with a dofollow link near the data.
 * A Basic key is for local development only; production stays off simply
 * because no key is set in Vercel until Venture is bought.
 *
 * Twelve Data reports most failures as HTTP 200 with { status: "error", code }
 * in the body, so both layers are checked. Numbers arrive as strings.
 */
const TD_BASE = "https://api.twelvedata.com";
const QUOTE_TTL_MS = 60_000;
const BARS_TTL_MS = 5 * 60_000;
const SEARCH_TTL_MS = 60 * 60_000;
/** Symbols per /quote call. Each symbol costs one credit, so Basic (8/min) only fits tiny batches. */
const QUOTE_BATCH = Number(process.env.TWELVE_DATA_BATCH_SIZE || 120);

export class TwelveDataError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "TwelveDataError";
    this.status = status;
    this.code = code;
  }
}

export const twelveDataAvailable = () => !!process.env.TWELVE_DATA_API_KEY;

const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

type ErrorBody = { status?: string; code?: number; message?: string };
const isErrorBody = (b: unknown): b is ErrorBody => !!b && typeof b === "object" && (b as ErrorBody).status === "error";
const errorFromBody = (b: ErrorBody) =>
  new TwelveDataError(b.message || "Twelve Data request failed", b.code, b.code === 429 ? "RATE_LIMIT" : b.code === 404 ? "NOT_FOUND" : "REQUEST_FAILED");

async function tdFetch(path: string): Promise<unknown> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new TwelveDataError("Missing TWELVE_DATA_API_KEY", undefined, "MISSING_KEY");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TD_BASE}${path}${sep}apikey=${encodeURIComponent(key)}`);
  if (!res.ok) throw new TwelveDataError(`Twelve Data request failed (${res.status})`, res.status, res.status === 429 ? "RATE_LIMIT" : "REQUEST_FAILED");
  const body = await res.json();
  if (isErrorBody(body)) throw errorFromBody(body);
  return body;
}

/** In-process cache that also shares in-flight requests, so RSI, SMA and volume for one ticker cost one call. */
const cache = new Map<string, { value: Promise<unknown>; expiresAt: number }>();
function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() <= hit.expiresAt) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  value.catch(() => cache.delete(key));
  return value;
}

/* --------------------------------- quotes --------------------------------- */

export interface TdQuoteRaw {
  symbol?: string;
  name?: string;
  exchange?: string;
  datetime?: string;
  timestamp?: number;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  average_volume?: string;
  is_market_open?: boolean;
  fifty_two_week?: { low?: string; high?: string };
}

/** The quote shape the rest of the app already consumes (same keys the FMP mapper produced). */
export interface AppQuote {
  ticker: string;
  companyName: string;
  price: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayChange: number;
  dayChangePercent: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  previousClose: number;
  marketCap?: number;
  sma50?: number;
  sma200?: number;
  nextEarningsDate?: string;
  exchange?: string;
  isMarketOpen?: boolean;
  /**
   * False for Twelve Data quotes: intraday volume is a minority-venue sample,
   * not full-market volume. Never compare it with an average or show it.
   */
  volumeIsConsolidated: boolean;
  source: "twelvedata";
}

/** Null when the payload carries no usable price. During the session `close` is the latest price. */
export function mapTdQuote(q: TdQuoteRaw): AppQuote | null {
  const price = num(q.close);
  if (!q.symbol || price === undefined || price <= 0) return null;
  const change = num(q.change) ?? 0;
  const changePercent = num(q.percent_change) ?? 0;
  return {
    ticker: q.symbol.toUpperCase(),
    companyName: q.name || q.symbol.toUpperCase(),
    price,
    dayOpen: num(q.open) ?? 0,
    dayHigh: num(q.high) ?? 0,
    dayLow: num(q.low) ?? 0,
    dayChange: change,
    dayChangePercent: changePercent,
    change,
    changePercent,
    volume: num(q.volume) ?? 0,
    avgVolume: num(q.average_volume) ?? 0,
    fiftyTwoWeekHigh: num(q.fifty_two_week?.high) ?? 0,
    fiftyTwoWeekLow: num(q.fifty_two_week?.low) ?? 0,
    previousClose: num(q.previous_close) ?? 0,
    exchange: q.exchange,
    isMarketOpen: q.is_market_open,
    volumeIsConsolidated: false,
    source: "twelvedata",
  };
}

/**
 * /quote answers a single symbol with the quote itself and several symbols
 * with an object keyed by symbol, where a failed symbol holds an error body.
 * Returns the usable quotes and the symbols that failed.
 */
export function parseTdQuoteResponse(body: unknown, requested: string[]): { quotes: AppQuote[]; failed: string[] } {
  const quotes: AppQuote[] = [];
  const failed: string[] = [];
  if (!body || typeof body !== "object") return { quotes, failed: [...requested] };
  const obj = body as Record<string, unknown>;
  const entries: Array<[string, unknown]> =
    requested.length === 1 && typeof obj.symbol === "string" ? [[requested[0], obj]] : requested.map((s) => [s, obj[s]]);
  for (const [symbol, raw] of entries) {
    const q = raw && typeof raw === "object" && !isErrorBody(raw) ? mapTdQuote(raw as TdQuoteRaw) : null;
    if (q) quotes.push(q);
    else failed.push(symbol);
  }
  return { quotes, failed };
}

const normalize = (t: string) => t.trim().toUpperCase();

export async function fetchTdQuote(ticker: string): Promise<AppQuote | null> {
  const t = normalize(ticker);
  if (!t) return null;
  const [q] = await fetchTdBatchQuotes([t]);
  return q ?? null;
}

/** Quotes for many tickers in batches, input order preserved, missing symbols dropped. */
export async function fetchTdBatchQuotes(tickers: string[]): Promise<AppQuote[]> {
  const symbols = Array.from(new Set(tickers.map(normalize).filter(Boolean)));
  if (!symbols.length) return [];
  const byTicker = new Map<string, AppQuote>();
  const misses: string[] = [];
  for (const s of symbols) {
    const hit = cache.get(`quote:${s}`);
    if (hit && Date.now() <= hit.expiresAt) {
      const q = (await hit.value.catch(() => null)) as AppQuote | null;
      if (q) byTicker.set(s, q);
      else misses.push(s);
    } else misses.push(s);
  }
  let lastError: unknown = null;
  for (let i = 0; i < misses.length; i += QUOTE_BATCH) {
    const chunk = misses.slice(i, i + QUOTE_BATCH);
    try {
      const body = await tdFetch(`/quote?symbol=${chunk.map(encodeURIComponent).join(",")}`);
      const { quotes, failed } = parseTdQuoteResponse(body, chunk);
      for (const q of quotes) {
        byTicker.set(q.ticker, q);
        cache.set(`quote:${q.ticker}`, { value: Promise.resolve(q), expiresAt: Date.now() + QUOTE_TTL_MS });
      }
      if (failed.length) console.warn(`[twelvedata] no quote for ${failed.join(", ")}`);
    } catch (err) {
      lastError = err;
      console.warn(`[twelvedata] quote batch of ${chunk.length} failed:`, err instanceof Error ? err.message : err);
    }
  }
  // Nothing at all came back and a call failed: surface it so the caller can fall back.
  if (!byTicker.size && lastError) throw lastError;
  return symbols.map((s) => byTicker.get(s)).filter((q): q is AppQuote => !!q);
}

/* ------------------------------- daily bars ------------------------------- */

export interface DailyBarTD {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** /time_series values arrive newest first; returned oldest first, rows without a close dropped. */
export function parseTdTimeSeries(body: unknown): DailyBarTD[] {
  const values = (body as { values?: Array<Record<string, unknown>> } | null)?.values;
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => ({
      date: String(v.datetime ?? "").slice(0, 10),
      open: num(v.open) ?? 0,
      high: num(v.high) ?? 0,
      low: num(v.low) ?? 0,
      close: num(v.close) ?? 0,
      volume: num(v.volume) ?? 0,
    }))
    .filter((b) => b.date && b.close > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Up to `sessions` daily bars, oldest first. One credit whatever the size, so
 * callers ask for a generous window and share the cached result. During the
 * session the newest bar is today's, still forming.
 */
export function fetchTdDailyBars(ticker: string, sessions = 260): Promise<DailyBarTD[]> {
  const t = normalize(ticker);
  return cached(`bars:${t}:${sessions}`, BARS_TTL_MS, async () =>
    parseTdTimeSeries(await tdFetch(`/time_series?symbol=${encodeURIComponent(t)}&interval=1day&outputsize=${sessions}`))
  );
}

/* --------------------------------- search --------------------------------- */

/** US listings only, one row per symbol. */
export function parseTdSymbolSearch(body: unknown): Array<{ ticker: string; companyName: string }> {
  const data = (body as { data?: Array<Record<string, unknown>> } | null)?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: Array<{ ticker: string; companyName: string }> = [];
  for (const row of data) {
    const symbol = typeof row.symbol === "string" ? row.symbol.toUpperCase() : "";
    if (!symbol || row.country !== "United States" || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ ticker: symbol, companyName: typeof row.instrument_name === "string" && row.instrument_name ? row.instrument_name : symbol });
  }
  return out;
}

export function searchTdSymbols(query: string): Promise<Array<{ ticker: string; companyName: string }>> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return cached(`search:${q.toLowerCase()}`, SEARCH_TTL_MS, async () =>
    parseTdSymbolSearch(await tdFetch(`/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=30`)).slice(0, 10)
  );
}
