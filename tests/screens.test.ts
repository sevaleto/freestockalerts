import { test } from "node:test";
import assert from "node:assert/strict";
import { SCREENS, SCREENED_SLUGS, evaluateScreen, type Snapshot } from "../lib/templates/screens";
import { screened } from "../lib/templates/screened";

test("every stored constituent still passes its strategy's rules on the snapshot it was built from", () => {
  for (const slug of SCREENED_SLUGS) {
    const def = SCREENS[slug];
    const data = screened.strategies[slug];
    assert.ok(data, `${slug} missing from screened.json`);
    assert.equal(data!.constituents.length, def.pick, slug);
    for (const c of data!.constituents) {
      const result = evaluateScreen(def, c.snapshot);
      assert.ok(result.qualifies, `${slug}: ${c.ticker} fails ${result.failed.join(", ")}`);
      const trigger = def.trigger(c.snapshot)!;
      assert.equal(c.alertType, trigger.alertType, `${slug}: ${c.ticker} alert type`);
      assert.equal(c.triggerValue, trigger.triggerValue, `${slug}: ${c.ticker} trigger value`);
      assert.equal(c.rationale, def.rationale(c.snapshot), `${slug}: ${c.ticker} rationale drifted from its snapshot`);
      assert.ok(!/\$-|est\.\.|undefined|NaN/.test(c.rationale), `${slug}: ${c.ticker} rationale formatting: ${c.rationale}`);
    }
  }
});

test("dynamic thresholds: earnings-day highs and dividend buy zones are computed from the snapshot", () => {
  const pe = screened.strategies["post-earnings-strength-radar"]!;
  for (const c of pe.constituents) {
    if (c.alertType === "PRICE_ABOVE") assert.equal(c.triggerValue, Math.round(c.snapshot.earnings!.reactionHigh * 100) / 100);
    else assert.ok(c.snapshot.price >= c.snapshot.earnings!.reactionHigh, `${c.ticker}: 52-week-high alert only when already above the earnings-day high`);
  }
  const dg = screened.strategies["dividend-growth-buy-zones"]!;
  const priced = dg.constituents.filter((c) => c.alertType === "PRICE_BELOW");
  assert.ok(priced.length >= 7, "most dividend alerts should be calculated price levels");
  for (const c of priced) {
    const d = c.snapshot.dividend!;
    assert.equal(c.triggerValue, Math.round((d.forwardAnnual / d.yieldP80) * 100) / 100);
    assert.ok(c.triggerValue < c.snapshot.price, `${c.ticker}: buy-zone price must be below the current price`);
  }
});

test("missing data fails closed unless the rule says it can be skipped", () => {
  const base: Snapshot = { symbol: "TEST", companyName: "Test Co", sector: "Technology", marketCap: 1e10, avgVolume: 2e6, price: 100, sma50: 90, sma200: 80, yearHigh: 102, yearLow: 60 };
  // Quality breakout without fundamentals: positive-fcf is "fail when unavailable".
  const qb = evaluateScreen(SCREENS["quality-breakout-radar"], base);
  assert.equal(qb.qualifies, false);
  assert.ok(qb.failed.includes("positive-fcf"));
  assert.ok(qb.failed.includes("growth"));
  assert.ok(!qb.failed.includes("leverage"), "leverage is skipped when unavailable");
  // A bank passes the leverage rule regardless of the ratio.
  const bank = { ...base, sector: "Financial Services", fundamentals: { fcfYield: 0.05, revenueGrowth: 0.1, netDebtToEbitda: 12 } };
  assert.equal(evaluateScreen(SCREENS["quality-breakout-radar"], bank).qualifies, true);
  const nonBank = { ...bank, sector: "Industrials" };
  assert.ok(evaluateScreen(SCREENS["quality-breakout-radar"], nonBank).failed.includes("leverage"));
});

test("RSI oversold is never the final trigger on the leader pullback list", () => {
  const def = SCREENS["leader-pullback-and-reclaim"];
  const s: Snapshot = { symbol: "BIG", companyName: "Big Co", marketCap: 1e11, avgVolume: 5e6, price: 90, sma50: 95, sma200: 85, yearHigh: 100, yearLow: 70, rsi: 40, lastQuarterEpsSurprise: 0.02 };
  assert.equal(evaluateScreen(def, s).qualifies, true);
  assert.equal(def.trigger(s)!.alertType, "SMA_CROSS_ABOVE");
  assert.equal(def.trigger(s)!.triggerValue, 50);
  assert.equal(evaluateScreen(def, { ...s, rsi: 28 }).qualifies, false, "washed-out RSI does not qualify");
});
