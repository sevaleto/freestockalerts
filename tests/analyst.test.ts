import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYST } from "../lib/strategies/config";
import { normalizeAnalystAction, normalizeGrade, type RawAnalystAction } from "../lib/strategies/analyst/normalize";
import { buildCluster, evaluateAnalystSymbol, hashKeys } from "../lib/strategies/analyst/evaluate";
import type { DailyBar, QuoteSnapshot } from "../lib/strategies/market";

const NOW = new Date("2026-09-05T21:00:00Z");

const raw = (over: Partial<RawAnalystAction> = {}): RawAnalystAction => ({
  symbol: "XYZ",
  date: "2026-09-01",
  gradingCompany: "Firm A",
  previousGrade: "Hold",
  newGrade: "Buy",
  action: "upgrade",
  ...over,
});
const act = (over: Partial<RawAnalystAction> = {}) => normalizeAnalystAction(raw(over))!;

const quote = (over: Partial<QuoteSnapshot> = {}): QuoteSnapshot => ({
  symbol: "XYZ",
  companyName: "Example Co.",
  price: 110,
  marketCap: 8e9,
  volume: 3_000_000,
  sma50: 100,
  changePercent: 2.4,
  asOf: NOW.toISOString(),
  ...over,
});

const bars = (high = 105, volume = 1_500_000): DailyBar[] => {
  const out: DailyBar[] = [];
  const d = new Date("2026-07-20T00:00:00Z");
  while (d < new Date("2026-09-05T00:00:00Z")) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      const date = d.toISOString().slice(0, 10);
      const close = date === "2026-09-03" ? high : 98;
      out.push({ date, open: close, high: close + 1, low: close - 1, close, volume });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

test("rating language is normalized while the original wording is kept", () => {
  assert.equal(normalizeGrade("Overweight"), "BUY");
  assert.equal(normalizeGrade("Outperform"), "BUY");
  assert.equal(normalizeGrade("Market Outperform"), "BUY");
  assert.equal(normalizeGrade("Strong Buy"), "STRONG_BUY");
  assert.equal(normalizeGrade("Speculative Buy"), "STRONG_BUY");
  assert.equal(normalizeGrade("Equal-Weight"), "HOLD");
  assert.equal(normalizeGrade("Sector Perform"), "HOLD");
  assert.equal(normalizeGrade("Underweight"), "SELL");
  assert.equal(normalizeGrade("Reduce"), "SELL");
  assert.equal(normalizeGrade("Gibberish"), null);
  const a = act({ previousGrade: "Equal-Weight", newGrade: "Overweight" });
  assert.equal(a.previousGrade, "Equal-Weight");
  assert.equal(a.newGrade, "Overweight");
  assert.equal(a.previousTier, "HOLD");
  assert.equal(a.newTier, "BUY");
  assert.equal(a.isTrueUpgrade, true);
});

test("direction comes from the tiers, so a Hold→Hold record labeled 'downgrade' is not a downgrade", () => {
  const noisy = act({ previousGrade: "Hold", newGrade: "Hold", action: "downgrade", gradingCompany: "Craig-Hallum" });
  assert.equal(noisy.direction, "NEUTRAL");
  assert.equal(noisy.isMajorDowngrade, false);
  const reit = act({ previousGrade: "Buy", newGrade: "Buy", action: "maintain" });
  assert.equal(reit.isTrueUpgrade, false);
  assert.equal(reit.isPositiveAction, false);
  const init = act({ previousGrade: null, newGrade: "Outperform", action: "initialise" });
  assert.equal(init.isPositiveInitiation, true);
  assert.equal(init.isPositiveAction, true);
  const initHold = act({ previousGrade: null, newGrade: "Neutral", action: "initiate" });
  assert.equal(initHold.isPositiveAction, false);
  const major = act({ previousGrade: "Buy", newGrade: "Hold", action: "downgrade" });
  assert.equal(major.isMajorDowngrade, true);
  const minor = act({ previousGrade: "Strong Buy", newGrade: "Buy", action: "downgrade" });
  assert.equal(minor.isMinorDowngrade, true);
  assert.equal(minor.isMajorDowngrade, false);
});

test("FMP's internal financial rating is not an analyst action", () => {
  // ratings-snapshot rows have no firm, no date and letter grades; the normalizer refuses them.
  const snapshot = normalizeAnalystAction({ symbol: "AAPL", rating: "B", overallScore: 3 } as unknown as RawAnalystAction);
  assert.equal(snapshot, null);
  assert.equal(normalizeGrade("B"), null);
  assert.equal(normalizeGrade("A+"), null);
});

test("two different firms upgrading within 14 days form a cluster; one firm twice does not", () => {
  const two = buildCluster("XYZ", [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm B", date: "2026-09-03" })], NOW);
  assert.equal(two.firms, 2);
  assert.equal(two.hasTrueUpgrade, true);
  assert.equal(two.spanDays, 2);
  const same = buildCluster("XYZ", [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm A", date: "2026-09-03" }), act({ gradingCompany: "Firm A, Inc." })], NOW);
  assert.equal(same.firms, 1);
  const stale = buildCluster("XYZ", [act({ gradingCompany: "Firm A", date: "2026-08-01" }), act({ gradingCompany: "Firm B" })], NOW);
  assert.equal(stale.firms, 1);
});

test("a reiteration does not count as the second action; an offsetting major downgrade blocks the cluster", () => {
  const withReit = buildCluster("XYZ", [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm B", previousGrade: "Buy", newGrade: "Buy", action: "maintain" })], NOW);
  assert.equal(withReit.firms, 1);
  const conflict = buildCluster(
    "XYZ",
    [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm B", date: "2026-09-02" }), act({ gradingCompany: "Firm C", previousGrade: "Buy", newGrade: "Hold", action: "downgrade", date: "2026-09-03" })],
    NOW
  );
  assert.equal(conflict.firms, 2);
  assert.equal(conflict.majorDowngrades.length, 1);
  const ev = evaluateAnalystSymbol({ cluster: conflict, quote: quote(), bars: bars(), now: NOW });
  assert.equal(ev.qualifies, false);
  assert.ok(ev.reasons.some((r) => /conflicting downgrade from Firm C/.test(r)));
  const minor = buildCluster("XYZ", [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm B", date: "2026-09-02" }), act({ gradingCompany: "Firm C", previousGrade: "Strong Buy", newGrade: "Buy", action: "downgrade" })], NOW);
  const evMinor = evaluateAnalystSymbol({ cluster: minor, quote: quote(), bars: bars(), now: NOW });
  assert.equal(evMinor.qualifies, true);
  assert.equal(evMinor.payload.scoreBreakdown.minorDowngrade, ANALYST.score.minorDowngradePenalty);
});

test("a qualifying cluster with a 20-day-high breakout scores and explains as specified", () => {
  const cluster = buildCluster("XYZ", [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm B", date: "2026-09-03" }), act({ gradingCompany: "Firm C", previousGrade: null, newGrade: "Outperform", action: "initiate", date: "2026-09-04" })], NOW);
  const ev = evaluateAnalystSymbol({ cluster, quote: quote({ price: 110, volume: 3_000_000 }), bars: bars(105, 1_500_000), now: NOW });
  assert.deepEqual(ev.reasons, []);
  assert.equal(ev.confirmation, "breakout");
  assert.deepEqual(ev.payload.scoreBreakdown, { base: 1, threeOrMoreFirms: 1, tightWindow: 1, trueUpgrade: 1, breakout: 1, volume: 1 });
  assert.equal(ev.score, 6);
  assert.match(ev.explanation, /^XYZ received 3 positive analyst actions from independent firms during the past 3 days, including at least one outright upgrade\. Shares are now above their 50-day average and breaking a 20-day high on elevated volume\.$/);
  assert.equal(ev.payload.firms.length, 3);
  assert.equal(ev.payload.actions[2].newTier, "Buy");
});

test("a cluster without price or volume confirmation does not create an alert", () => {
  const cluster = buildCluster("XYZ", [act({ gradingCompany: "Firm A" }), act({ gradingCompany: "Firm B", date: "2026-09-03" })], NOW);
  const flat = evaluateAnalystSymbol({ cluster, quote: quote({ price: 102, volume: 1_400_000 }), bars: bars(105, 1_500_000), now: NOW });
  assert.equal(flat.qualifies, false);
  assert.equal(flat.confirmation, null);
  assert.ok(flat.reasons.includes("no price or volume confirmation"));
  const volumeOnly = evaluateAnalystSymbol({ cluster, quote: quote({ price: 102, volume: 2_500_000, changePercent: 1.2 }), bars: bars(105, 1_500_000), now: NOW });
  assert.equal(volumeOnly.confirmation, "volume");
  assert.equal(volumeOnly.qualifies, true);
  const below = evaluateAnalystSymbol({ cluster, quote: quote({ price: 99, sma50: 100 }), bars: bars(95), now: NOW });
  assert.ok(below.reasons.some((r) => /50-day/.test(r)));
  const single = buildCluster("XYZ", [act({ gradingCompany: "Firm A" })], NOW);
  const isolated = evaluateAnalystSymbol({ cluster: single, quote: quote(), bars: bars(), now: NOW });
  assert.equal(isolated.qualifies, false);
});

test("duplicate analyst records collapse and produce one signal key", () => {
  const a = act({ gradingCompany: "Firm A" });
  const b = act({ gradingCompany: "Firm A" });
  assert.equal(a.dedupKey, b.dedupKey);
  const c1 = buildCluster("XYZ", [a, b, act({ gradingCompany: "Firm B", date: "2026-09-03" })], NOW);
  const c2 = buildCluster("XYZ", [a, act({ gradingCompany: "Firm B", date: "2026-09-03" })], NOW);
  assert.equal(c1.firms, 2);
  const k1 = evaluateAnalystSymbol({ cluster: c1, quote: quote(), bars: bars(), now: NOW }).signalKey;
  const k2 = evaluateAnalystSymbol({ cluster: c2, quote: quote(), bars: bars(), now: NOW }).signalKey;
  assert.equal(k1, k2);
  assert.equal(hashKeys(["b", "a"]), hashKeys(["a", "b"]));
});
