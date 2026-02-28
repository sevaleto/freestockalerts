import { mockQuotes, mockQuoteMap } from "@/lib/mock/quotes";
import { mockTickers } from "@/lib/mock/tickers";
import { fetchAlphaVantageQuote } from "@/lib/api/alphaVantage";
import { fetchFmpBatchQuotes, fetchFmpQuote, FmpError, searchFmpTickers } from "@/lib/api/fmp";
import { Resend } from "resend";

// Rate limit alert — only send once per hour to avoid spam
let lastRateLimitAlert = 0;
const RATE_LIMIT_ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour

async function sendRateLimitAlert() {
  const now = Date.now();
  if (now - lastRateLimitAlert < RATE_LIMIT_ALERT_COOLDOWN) return;
  lastRateLimitAlert = now;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM || "FreeStockAlerts <alerts@freestockalerts.ai>",
      to: "manuel@tradingtips.com",
      subject: "⚠️ FreeStockAlerts — FMP API Rate Limit Hit",
      html: `
        <h2>FMP API Rate Limit Reached</h2>
        <p>The FMP Basic plan (250 calls/day) rate limit was hit at <strong>${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</strong>.</p>
        <p>Falling back to Alpha Vantage, but quote data may be delayed or incomplete.</p>
        <p><strong>Action needed:</strong> Consider upgrading to FMP Starter ($29/mo) at <a href="https://site.financialmodelingprep.com/datasets/market-data-real-time">FMP Pricing</a>.</p>
      `,
    });
  } catch {
    console.error("Failed to send FMP rate limit alert email");
  }
}

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

  let quote = null;
  try {
    quote = await fetchFmpQuote(ticker);
  } catch (error) {
    if (error instanceof FmpError && error.code === "RATE_LIMIT") {
      sendRateLimitAlert(); // fire-and-forget, don't await
    }
    quote = await fetchAlphaVantageQuote(ticker);
  }

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

  let quotes = [] as any[];
  try {
    quotes = await fetchFmpBatchQuotes(tickers);
  } catch (error) {
    if (error instanceof FmpError && error.code === "RATE_LIMIT") {
      sendRateLimitAlert(); // fire-and-forget
    }
    quotes = [];
  }

  if (quotes.length === 0) {
    quotes = tickers
      .map((ticker) => mockQuoteMap.get(ticker))
      .filter(Boolean) as any[];
  }
  cacheSet(cacheKey, quotes);
  return quotes;
};

export const searchTickers = async (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  try {
    const results = await searchFmpTickers(query);
    if (results.length > 0) return results;
  } catch (error) {
    // fall through to mock fallback
  }

  return mockTickers
    .filter(
      (ticker) =>
        ticker.ticker.toLowerCase().includes(normalized) ||
        ticker.companyName.toLowerCase().includes(normalized)
    )
    .slice(0, 10);
};
