const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";
const CACHE_TTL_MS = 60 * 1000;

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
  changesPercentage?: number;
  volume?: number;
  avgVolume?: number;
  yearHigh?: number;
  yearLow?: number;
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
  const dayChangePercent = toNumber(quote.changesPercentage) ?? 0;
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

const fmpFetch = async (path: string) => {
  const url = `${FMP_BASE_URL}${path}${path.includes("?") ? "&" : "?"}apikey=${getApiKey()}`;
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

  const data = (await fmpFetch(`/quote/${encodeURIComponent(normalized)}`)) as FmpQuoteResponse[];
  const quote = data?.[0];
  if (!quote) return null;
  const mapped = mapFmpQuote(quote);
  cacheSet(cacheKey, mapped);
  return mapped;
};

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

  if (missing.length > 0) {
    const data = (await fmpFetch(`/quote/${missing.join(",")}`)) as FmpQuoteResponse[];
    const mapped = Array.isArray(data) ? data.map(mapFmpQuote) : [];
    for (const quote of mapped) {
      cacheSet(`quote:${quote.ticker}`, quote);
    }
    results.push(...mapped);
  }

  const resultMap = new Map(results.map((quote) => [quote.ticker, quote]));
  return normalized.map((ticker) => resultMap.get(ticker)).filter(Boolean);
};

export const searchFmpTickers = async (query: string) => {
  const normalized = query.trim();
  if (!normalized) return [];
  const data = (await fmpFetch(
    `/search?query=${encodeURIComponent(normalized)}&limit=10`
  )) as Array<{ symbol: string; name?: string }>;
  return (Array.isArray(data) ? data : []).map((item) => ({
    ticker: item.symbol,
    companyName: item.name ?? item.symbol,
  }));
};
