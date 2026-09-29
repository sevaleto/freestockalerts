import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTdQuote, parseTdQuoteResponse, parseTdSymbolSearch, parseTdTimeSeries, fetchTdBatchQuotes, TwelveDataError } from "../lib/api/twelveData";

// Shapes follow https://twelvedata.com/docs and were checked against live /quote, /time_series and /symbol_search responses on 2026-09-28.
const AAPL = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  datetime: "2026-09-28",
  timestamp: 1790530200,
  open: "250.10",
  high: "253.40",
  low: "249.80",
  close: "252.90",
  volume: "41234567",
  previous_close: "249.50",
  change: "3.40",
  percent_change: "1.36273",
  average_volume: "52345678",
  is_market_open: true,
  fifty_two_week: { low: "180.20", high: "260.10" },
};

test("mapTdQuote converts strings and maps every field the app reads", () => {
  const q = mapTdQuote(AAPL)!;
  assert.equal(q.ticker, "AAPL");
  assert.equal(q.companyName, "Apple Inc.");
  assert.equal(q.price, 252.9);
  assert.equal(q.previousClose, 249.5);
  assert.equal(q.change, 3.4);
  assert.equal(q.dayChange, 3.4);
  assert.ok(Math.abs(q.changePercent - 1.36273) < 1e-9);
  assert.equal(q.volume, 41234567);
  assert.equal(q.avgVolume, 52345678);
  assert.equal(q.fiftyTwoWeekHigh, 260.1);
  assert.equal(q.fiftyTwoWeekLow, 180.2);
  assert.equal(q.marketCap, undefined, "market cap is not in the quote; never report it as 0");
  assert.equal(q.source, "twelvedata");
});

test("mapTdQuote rejects payloads without a usable price", () => {
  assert.equal(mapTdQuote({ ...AAPL, close: "" }), null);
  assert.equal(mapTdQuote({ ...AAPL, close: "0" }), null);
  assert.equal(mapTdQuote({ ...AAPL, symbol: undefined }), null);
});

test("parseTdQuoteResponse handles a single-symbol body", () => {
  const { quotes, failed } = parseTdQuoteResponse(AAPL, ["AAPL"]);
  assert.equal(quotes.length, 1);
  assert.deepEqual(failed, []);
});

test("parseTdQuoteResponse handles a keyed multi-symbol body with a per-symbol error", () => {
  const body = { AAPL, MSFT: { ...AAPL, symbol: "MSFT", name: "Microsoft", close: "430.00" }, ZZZZ: { code: 400, message: "symbol not found", status: "error" } };
  const { quotes, failed } = parseTdQuoteResponse(body, ["AAPL", "MSFT", "ZZZZ"]);
  assert.deepEqual(quotes.map((q) => q.ticker), ["AAPL", "MSFT"]);
  assert.deepEqual(failed, ["ZZZZ"]);
});

test("parseTdTimeSeries returns bars oldest first and drops empty rows", () => {
  const body = {
    meta: { symbol: "AAPL", interval: "1day" },
    values: [
      { datetime: "2026-09-26", open: "1", high: "2", low: "0.5", close: "1.5", volume: "100" },
      { datetime: "2026-09-25", open: "1", high: "2", low: "0.5", close: "1.2", volume: "90" },
      { datetime: "2026-09-24", open: "1", high: "2", low: "0.5", close: "", volume: "80" },
    ],
    status: "ok",
  };
  const bars = parseTdTimeSeries(body);
  assert.deepEqual(bars.map((b) => b.date), ["2026-09-25", "2026-09-26"]);
  assert.equal(bars[1].close, 1.5);
  assert.equal(bars[1].volume, 100);
  assert.deepEqual(parseTdTimeSeries({ status: "ok" }), []);
});

test("parseTdSymbolSearch keeps US listings once each", () => {
  const body = {
    data: [
      { symbol: "AAPL", instrument_name: "Apple Inc", exchange: "NASDAQ", country: "United States" },
      { symbol: "AAPL", instrument_name: "Apple Inc", exchange: "BATS", country: "United States" },
      { symbol: "APC", instrument_name: "Apple Inc", exchange: "XETR", country: "Germany" },
      { symbol: "APLE", instrument_name: "Apple Hospitality REIT", exchange: "NYSE", country: "United States" },
    ],
    status: "ok",
  };
  assert.deepEqual(parseTdSymbolSearch(body), [
    { ticker: "AAPL", companyName: "Apple Inc" },
    { ticker: "APLE", companyName: "Apple Hospitality REIT" },
  ]);
});

test("without a key every call fails fast with MISSING_KEY and makes no request", async () => {
  const saved = process.env.TWELVE_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error("network must not be touched");
  }) as typeof fetch;
  try {
    await assert.rejects(fetchTdBatchQuotes(["NOKEY1"]), (e: unknown) => e instanceof TwelveDataError && e.code === "MISSING_KEY");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
    if (saved !== undefined) process.env.TWELVE_DATA_API_KEY = saved;
  }
});

test("an error body with HTTP 200 becomes a RATE_LIMIT error the caller can fall back from", async () => {
  const saved = process.env.TWELVE_DATA_API_KEY;
  process.env.TWELVE_DATA_API_KEY = "test-key";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: 429, message: "You have run out of API credits for the current minute.", status: "error" }), { status: 200 })) as typeof fetch;
  try {
    await assert.rejects(fetchTdBatchQuotes(["RLTEST"]), (e: unknown) => e instanceof TwelveDataError && e.code === "RATE_LIMIT");
  } finally {
    globalThis.fetch = realFetch;
    if (saved === undefined) delete process.env.TWELVE_DATA_API_KEY;
    else process.env.TWELVE_DATA_API_KEY = saved;
  }
});
