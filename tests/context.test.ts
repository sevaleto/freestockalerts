import { test } from "node:test";
import assert from "node:assert/strict";
import { describeContext, trailingReturn } from "../lib/alerts/context";

test("trailingReturn uses the close N sessions back", () => {
  const closes = [110, 108, 105, 100];
  assert.ok(Math.abs((trailingReturn(closes, 3) ?? 0) - 10) < 1e-9);
  assert.equal(trailingReturn(closes, 5), null);
});

test("context lines describe moving averages, volume and 52-week distance without predictions", () => {
  const ctx = describeContext({ ticker: "XYZ", price: 100, volume: 3_000_000, sma50: 95, sma200: 90, fiftyTwoWeekHigh: 120 }, { avgVolume: 2_000_000 });
  assert.equal(ctx.aboveSma50, true);
  assert.equal(ctx.aboveSma200, true);
  assert.equal(ctx.volumeRatio, 1.5);
  assert.ok(ctx.lines[0].startsWith("Above its 50-day average ($95.00) and above its 200-day ($90.00)."));
  assert.ok(ctx.lines[1].includes("1.5× its 30-session average"));
  assert.ok(ctx.lines[1].includes("1.5× participation mark"));
  assert.ok(ctx.lines.some((l) => l.includes("16.7% below its 52-week high")));
  for (const l of ctx.lines) assert.ok(!/will|should|buy|sell/i.test(l), l);
});

test("sector context distinguishes improving leadership from a bounce in a downtrend", () => {
  const leading = describeContext({ ticker: "XLE", price: 100, sma50: 98, sma200: 90 }, { etfReturn: 5, spyReturn: 2 });
  assert.equal(leading.relativeToSpyPts, 3);
  assert.ok(leading.lines.some((l) => l.includes("improving leadership")));
  const bounce = describeContext({ ticker: "XLU", price: 100, sma50: 98, sma200: 110 }, { etfReturn: 1, spyReturn: 3 });
  assert.ok(bounce.lines.some((l) => l.includes("bounce within a downtrend")));
  assert.ok(bounce.lines.some((l) => l.includes("behind the index")));
  const lagging = describeContext({ ticker: "XLP", price: 100, sma50: 98, sma200: 90 }, { etfReturn: 1, spyReturn: 3 });
  assert.ok(lagging.lines.some((l) => l.includes("lagging the index")));
});

test("no data, no lines", () => {
  assert.deepEqual(describeContext({ ticker: "^VIX", price: 20 }).lines, []);
});
