import { test } from "node:test";
import assert from "node:assert/strict";
import { INSIDER } from "../lib/strategies/config";
import { accessionFromUrl, classifyRole, isCommonStock, normalizeInsiderTransaction, prettyName, type RawInsiderTransaction } from "../lib/strategies/insider/normalize";
import { dedupeTransactions, evaluateInsiderSymbol, isQualifyingPurchase } from "../lib/strategies/insider/evaluate";
import type { DailyBar, QuoteSnapshot } from "../lib/strategies/market";

const NOW = new Date("2026-09-05T21:00:00Z");
const URL1 = "https://www.sec.gov/Archives/edgar/data/1420800/000119312526384028/0001193125-26-384028-index.htm";

const raw = (over: Partial<RawInsiderTransaction> = {}): RawInsiderTransaction => ({
  symbol: "XYZ",
  filingDate: "2026-08-26",
  transactionDate: "2026-08-25",
  reportingCik: "0001",
  companyCik: "0009",
  transactionType: "P-Purchase",
  securitiesOwned: 120_000,
  reportingName: "Doe Jane",
  typeOfOwner: "officer: Chief Executive Officer",
  acquisitionOrDisposition: "A",
  directOrIndirect: "D",
  formType: "4",
  securitiesTransacted: 10_000,
  price: 25,
  securityName: "Common Stock",
  url: URL1,
  ...over,
});

const norm = (over: Partial<RawInsiderTransaction> = {}) => normalizeInsiderTransaction(raw(over))!;

const quote = (over: Partial<QuoteSnapshot> = {}): QuoteSnapshot => ({
  symbol: "XYZ",
  companyName: "Example Co.",
  price: 30,
  marketCap: 5e9,
  volume: 3_000_000,
  sma50: 27,
  changePercent: 2.5,
  asOf: NOW.toISOString(),
  ...over,
});

/** 40 sessions ending 2026-09-04; closes rise to `peak` after the purchase, average volume 1.5M. */
const bars = (peak = 29, volume = 1_500_000): DailyBar[] => {
  const out: DailyBar[] = [];
  const d = new Date("2026-07-10T00:00:00Z");
  let i = 0;
  while (d < new Date("2026-09-05T00:00:00Z")) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const date = d.toISOString().slice(0, 10);
      const close = date > "2026-08-25" ? peak - (i % 3) * 0.3 : 26;
      out.push({ date, open: close, high: close + 0.5, low: close - 0.5, close, volume });
      i++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

test("SEC code P purchase by a CEO qualifies", () => {
  assert.deepEqual(isQualifyingPurchase(norm(), NOW), { ok: true });
});

test("option exercise, award/grant, sale, gift and zero-price transactions do not qualify", () => {
  assert.match((isQualifyingPurchase(norm({ transactionType: "M-Exempt" }), NOW) as { reason: string }).reason, /not a purchase/);
  assert.match((isQualifyingPurchase(norm({ transactionType: "A-Award", price: 0 }), NOW) as { reason: string }).reason, /not a purchase/);
  assert.match((isQualifyingPurchase(norm({ transactionType: "S-Sale", acquisitionOrDisposition: "D" }), NOW) as { reason: string }).reason, /not a purchase/);
  assert.match((isQualifyingPurchase(norm({ transactionType: "G-Gift" }), NOW) as { reason: string }).reason, /not a purchase/);
  assert.match((isQualifyingPurchase(norm({ price: 0 }), NOW) as { reason: string }).reason, /zero or missing price/);
  assert.match((isQualifyingPurchase(norm({ transactionType: "" }), NOW) as { reason: string }).reason, /no SEC transaction code/);
  assert.match((isQualifyingPurchase(norm({ acquisitionOrDisposition: "D" }), NOW) as { reason: string }).reason, /disposition/);
});

test("purchase below $100,000, old purchases, non-common securities and irrelevant insiders do not qualify", () => {
  assert.match((isQualifyingPurchase(norm({ securitiesTransacted: 3_000 }), NOW) as { reason: string }).reason, /below \$100,000/);
  assert.match((isQualifyingPurchase(norm({ transactionDate: "2026-07-01" }), NOW) as { reason: string }).reason, /days old/);
  assert.match((isQualifyingPurchase(norm({ securityName: "Series A Preference Shares" }), NOW) as { reason: string }).reason, /security is/);
  assert.match((isQualifyingPurchase(norm({ typeOfOwner: "10 percent owner" }), NOW) as { reason: string }).reason, /not a director or senior officer/);
  assert.match((isQualifyingPurchase(norm({ typeOfOwner: "officer: SVP, General Counsel" }), NOW) as { reason: string }).reason, /not a director or senior officer/);
  assert.deepEqual(isQualifyingPurchase(norm({ typeOfOwner: "director" }), NOW), { ok: true });
  assert.deepEqual(isQualifyingPurchase(norm({ typeOfOwner: "director, 10 percent owner, officer: Executive Chairman and CEO" }), NOW), { ok: true });
});

test("roles, titles, accession numbers and names are parsed from the provider's free text", () => {
  const ceo = classifyRole("director, officer: Chief Executive Officer");
  assert.deepEqual({ ...ceo }, { isDirector: true, isOfficer: true, isSenior: true, isRelevant: true, title: "Chief Executive Officer" });
  assert.equal(classifyRole("officer: Chief Administrative Officer").isSenior, false);
  assert.equal(classifyRole("officer: Chief Administrative Officer").isRelevant, true);
  assert.equal(classifyRole("officer: President and COO").isSenior, true);
  assert.equal(accessionFromUrl(URL1), "0001193125-26-384028");
  assert.equal(accessionFromUrl(undefined), null);
  assert.equal(prettyName("ENGERT OLIVER"), "Oliver Engert");
  assert.equal(prettyName("Doe Jane A."), "Jane A. Doe");
  assert.equal(prettyName("De Lange Bob"), "Bob De Lange");
  assert.equal(isCommonStock("Class A Common Stock"), true);
  assert.equal(isCommonStock("Common Stock, $0.01 par value per share"), true);
  assert.equal(isCommonStock("Warrant"), false);
  assert.equal(isCommonStock("Restricted Stock Unit"), false);
});

test("duplicate filings collapse to one transaction and one signal key", () => {
  const a = norm();
  const b = norm();
  const c = norm({ transactionDate: "2026-08-26", securitiesTransacted: 4_000 }); // same accession, different line
  assert.equal(a.dedupKey, b.dedupKey);
  assert.notEqual(a.dedupKey, c.dedupKey);
  const unique = dedupeTransactions([a, b, c]);
  assert.equal(unique.length, 2);
  const ev1 = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [a], quote: quote(), bars: bars(), now: NOW });
  const ev2 = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [b], quote: quote(), bars: bars(), now: NOW });
  assert.equal(ev1.signalKey, ev2.signalKey);
});

test("a confirmed purchase qualifies with a breakout, and the explanation reads as specified", () => {
  const ev = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm()], quote: quote({ price: 30 }), bars: bars(29, 1_500_000), now: NOW });
  assert.deepEqual(ev.reasons, []);
  assert.equal(ev.qualifies, true);
  assert.equal(ev.confirmation, "breakout");
  assert.match(ev.explanation, /^Jane Doe, Chief Executive Officer, purchased approximately 10,000 shares worth \$250,000\. The stock is now above its 50-day average and is breaking above its post-purchase high on stronger-than-normal volume\.$/);
  assert.equal(ev.payload.purchases[0].filingUrl, URL1);
  assert.equal(ev.payload.distinctInsiders, 1);
  assert.equal(ev.payload.postPurchaseHigh, 29);
});

test("a purchase without price confirmation does not create an alert", () => {
  const below50 = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm()], quote: quote({ price: 26, sma50: 27 }), bars: bars(29), now: NOW });
  assert.equal(below50.qualifies, false);
  assert.ok(below50.reasons.some((r) => /50-day/.test(r)));
  const noBreak = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm()], quote: quote({ price: 27.5, sma50: 27, volume: 1_500_000 }), bars: bars(29), now: NOW });
  assert.equal(noBreak.qualifies, false);
  assert.equal(noBreak.confirmation, null);
  assert.ok(noBreak.reasons.some((r) => /post-purchase high/.test(r)));
  // Within 3% of the high on 1.5× volume is the alternative confirmation.
  const near = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm()], quote: quote({ price: 28.5, sma50: 27, volume: 2_400_000 }), bars: bars(29, 1_500_000), now: NOW });
  assert.equal(near.confirmation, "near-high-volume");
  assert.equal(near.qualifies, true);
});

test("liquidity and market-cap floors apply", () => {
  const small = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm()], quote: quote({ marketCap: 5e8 }), bars: bars(), now: NOW });
  assert.ok(small.reasons.some((r) => /market cap/.test(r)));
  const thin = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm()], quote: quote(), bars: bars(29, 200_000), now: NOW });
  assert.ok(thin.reasons.some((r) => /average volume/.test(r)));
});

test("multiple independent insiders, senior titles, size and ownership share raise the score", () => {
  const one = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm({ typeOfOwner: "director", securitiesOwned: 2_000_000 })], quote: quote(), bars: bars(), now: NOW });
  assert.deepEqual(one.payload.scoreBreakdown, { breakout: INSIDER.score.breakout });
  const two = evaluateInsiderSymbol({
    symbol: "XYZ",
    purchases: [norm({ typeOfOwner: "director", securitiesOwned: 2_000_000 }), norm({ reportingCik: "0002", reportingName: "Roe John", typeOfOwner: "director", securitiesOwned: 2_000_000 })],
    quote: quote(),
    bars: bars(),
    now: NOW,
  });
  assert.equal(two.score, one.score + INSIDER.score.multipleInsiders);
  assert.equal(two.payload.distinctInsiders, 2);
  const ceo = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm({ securitiesOwned: 2_000_000 })], quote: quote(), bars: bars(), now: NOW });
  assert.equal(ceo.score, one.score + INSIDER.score.seniorInsider);
  const big = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm({ typeOfOwner: "director", securitiesTransacted: 30_000, securitiesOwned: 2_000_000 })], quote: quote(), bars: bars(), now: NOW });
  assert.equal(big.score, one.score + INSIDER.score.largePurchase);
  // 10,000 bought on 110,000 held before = 9% (no bonus); on 20,000 = 100% (bonus).
  const rel = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [norm({ typeOfOwner: "director", securitiesOwned: 30_000 })], quote: quote(), bars: bars(), now: NOW });
  assert.equal(rel.score, one.score + INSIDER.score.bigRelativeToHoldings);
  assert.equal(rel.payload.purchases[0].relativeToHoldings, 0.5);
});

test("missing optional ownership information does not crash processing", () => {
  const t = norm({ securitiesOwned: null });
  assert.equal(t.sharesOwnedAfter, null);
  const ev = evaluateInsiderSymbol({ symbol: "XYZ", purchases: [t], quote: quote(), bars: bars(), now: NOW });
  assert.equal(ev.qualifies, true);
  assert.equal(ev.payload.purchases[0].relativeToHoldings, null);
  assert.equal("bigRelativeToHoldings" in ev.payload.scoreBreakdown, false);
  const noUrl = norm({ url: undefined });
  assert.equal(noUrl.accession, null);
  assert.ok(noUrl.dedupKey.startsWith("noacc|"));
});
