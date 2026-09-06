import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveFacts, marketCapLabel, renderFallbackContext, renderUserPrompt, splitParagraphs, validateModelOutput, wordCount, costUsd, type GatherInput } from "../lib/ai/alertContext";
import { AI_CONTEXT } from "../lib/ai/config";

const NOW = new Date("2026-09-05T21:00:00Z");

const input = (over: Partial<GatherInput> = {}): GatherInput => ({
  ticker: "nvda",
  companyName: "NVIDIA Corporation",
  triggerText: "hits a new 52-week high",
  quote: { price: 232.15, changePercent: 4.123, volume: 48_300_000, avgVolume: 30_000_000, sma50: 214.8, sma200: 178.3, fiftyTwoWeekHigh: 232.15, fiftyTwoWeekLow: 164.27, marketCap: 5.58e12 },
  contextLines: ["Above its 50-day average ($214.80) and above its 200-day ($178.30)."],
  strategySlug: "quality-breakout-radar",
  now: NOW,
  ...over,
});

const sources = {
  news: [
    { title: "Nvidia <b>beats</b> again", publisher: "The Motley Fool", site: "fool.com", publishedDate: "2026-09-05 14:45:00", snippet: "Revenue more than doubled.", url: "https://example.com/a" },
    { title: "Old story", publisher: "Reuters", site: "reuters.com", publishedDate: "2026-08-01 09:00:00", snippet: "stale", url: "" },
  ],
  consensus: { strongBuy: 2, buy: 58, hold: 16, sell: 3, strongSell: 0, consensus: "Buy" },
  targets: { high: 515, low: 270, consensus: 345.21, median: 322.5 },
  earnings: { next: { date: "2026-11-18", epsEstimated: 2.47, revenueEstimated: 1.08e11 }, last: { date: "2026-08-26", epsActual: 2.22, epsEstimated: 2.09, revenueActual: 9.6e10, revenueEstimated: 9.2e10 } },
};

test("facts are derived with guards, rounding, and stale news dropped", () => {
  const f = deriveFacts(input(), sources);
  assert.equal(f.ticker, "NVDA");
  assert.equal(f.changePercent, 4.1);
  assert.equal(f.volumeRatio, 1.6);
  assert.equal(f.aboveSma50, true);
  assert.equal(f.aboveSma200, true);
  assert.equal(f.pctBelow52wHigh, 0);
  assert.equal(f.pctAbove52wLow, 41.3);
  assert.equal(f.marketCapLabel, "mega-cap ($5580B)");
  assert.equal(f.news.length, 1, "the 35-day-old story is dropped");
  assert.equal(f.news[0].title, "Nvidia <b>beats</b> again", "deriveFacts keeps what the fetcher gave; stripping happens in the fetcher");
  assert.deepEqual(f.analysts, { total: 79, buy: 60, hold: 16, sell: 3, consensus: "Buy", target: 345.21, targetPct: 48.7 });
  assert.deepEqual(f.earnings, { nextDate: "2026-11-18", daysToNext: 74, lastDate: "2026-08-26", lastSurprisePct: 6.2, lastBeat: true });
  assert.equal(f.strategy?.name, "Quality Breakout Radar");
  assert.equal(f.strategy?.whenItFails.length, 2);
});

test("zero-coerced quote fields and missing sources produce nulls, not nonsense", () => {
  const f = deriveFacts(input({ quote: { price: 10, sma50: 0, sma200: 0, fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, marketCap: 0 }, contextLines: [], strategySlug: null }), {});
  assert.equal(f.aboveSma50, null);
  assert.equal(f.pctBelow52wHigh, null);
  assert.equal(f.marketCapLabel, null);
  assert.equal(f.volumeRatio, null);
  assert.equal(f.analysts, null);
  assert.equal(f.earnings, null);
  assert.equal(f.strategy, null);
  assert.deepEqual(f.news, []);
  assert.equal(marketCapLabel(undefined), null);
  assert.equal(marketCapLabel(3.2e9), "mid-cap ($3.2B)");
});

test("the prompt only contains sections with data, and every number comes from the facts", () => {
  const full = renderUserPrompt(deriveFacts(input(), sources));
  for (const s of ["Company: NVIDIA Corporation (NVDA), mega-cap", "Alert: NVDA hits a new 52-week high", "Price: $232.15 (+4.1% today)", "at its 52-week high", "41.3% above its 52-week low", "Volume: 1.6x", "Strategy: Quality Breakout Radar", "Recent headlines", 'The Motley Fool: "Nvidia', "Analysts: 79 ratings, 60 buy, 16 hold, 3 sell (consensus Buy); average price target $345.21 (+48.7%", "next report 2026-11-18 (74 days away)", "beat the EPS estimate by 6.2%"]) {
    assert.ok(full.includes(s), `missing: ${s}`);
  }
  const bare = renderUserPrompt(deriveFacts(input({ quote: { price: 10 }, contextLines: [], strategySlug: null }), {}));
  for (const s of ["Position:", "Volume:", "Strategy:", "Recent headlines", "Analysts:", "Earnings:", "n/a"]) assert.ok(!bare.includes(s), `unexpected: ${s}`);
  assert.ok(bare.includes("Price: $10.00"));
});

test("model output is accepted only in the agreed shape", () => {
  const good = `${"word ".repeat(70)}\n\n${"more ".repeat(60)}`;
  const ok = validateModelOutput(good);
  assert.equal(ok.ok, true);
  assert.equal((ok as { paragraphs: string[] }).paragraphs.length, 2);
  assert.equal((validateModelOutput("one paragraph only ".repeat(20)) as { reason: string }).reason, "no paragraph break");
  assert.match((validateModelOutput("short.\n\nvery.") as { reason: string }).reason, /only \d+ words/);
  assert.equal((validateModelOutput(`${"a ".repeat(70)}guaranteed gains\n\n${"b ".repeat(20)}`) as { reason: string }).reason, "banned phrase");
  assert.equal((validateModelOutput(`${"a ".repeat(70)}\n\n- bullet ${"b ".repeat(20)}`) as { reason: string }).reason, "bullets or headings");
  assert.deepEqual(splitParagraphs("  one\n\n\n two  \r\n\r\nthree"), ["one", "two", "three"]);
  assert.equal(wordCount("a b  c\nd"), 4);
});

test("the fallback is two paragraphs built from the same facts and reads cleanly", () => {
  const text = renderFallbackContext(deriveFacts(input(), sources));
  const paragraphs = splitParagraphs(text);
  assert.equal(paragraphs.length, 2);
  assert.ok(paragraphs[0].startsWith("NVDA hits a new 52-week high, trading at $232.15 (+4.1% today)."));
  assert.ok(paragraphs[0].includes("Volume is running 1.6x"));
  assert.ok(paragraphs[1].includes("Quality Breakout Radar"));
  assert.ok(paragraphs[1].includes("2026-11-18, 74 days away"));
  assert.ok(paragraphs[1].includes("60 buy, 16 hold and 3 sell"));
  assert.ok(!/undefined|NaN|null/.test(text));
  const bare = renderFallbackContext(deriveFacts(input({ quote: { price: 10 }, contextLines: [], strategySlug: null }), {}));
  assert.equal(splitParagraphs(bare).length, 2);
  assert.ok(bare.includes("often reverses"));
});

test("a full-sentence trigger (signal explanation) is not prefixed with the ticker", () => {
  const f = deriveFacts(input({ triggerText: "Bob De Lange, Director, purchased approximately 1,000 shares worth $100,710. The stock is now above its 50-day average.", strategySlug: null, contextLines: [] }), {});
  assert.ok(renderUserPrompt(f).includes("Alert: Bob De Lange, Director, purchased"));
  const fallback = renderFallbackContext(f);
  assert.ok(fallback.startsWith("Bob De Lange, Director, purchased approximately 1,000 shares worth $100,710. The stock is now above its 50-day average. The stock is trading at $232.15"));
  assert.ok(!fallback.startsWith("NVDA Bob"));
});

test("cost is computed from the configured list prices", () => {
  assert.equal(costUsd(1_000_000, 0), AI_CONTEXT.priceInputPerM);
  assert.equal(costUsd(1300, 350), Math.round(((1300 * AI_CONTEXT.priceInputPerM + 350 * AI_CONTEXT.priceOutputPerM) / 1e6) * 1e6) / 1e6);
  assert.ok(costUsd(1300, 350) < 0.004);
});
