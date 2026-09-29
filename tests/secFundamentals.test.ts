/** SEC XBRL fundamentals used by the strategy refresh (fixture: Apple's companyfacts, trimmed to mid-2023 onward). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  annualValues,
  conceptFacts,
  dilutedShares,
  fundamentalsFromFacts,
  latestQuarterYoY,
  quarterlyRevenue,
  ttm,
  type CompanyFacts,
  type XbrlFact,
} from "../lib/sec/fundamentals";

const aapl = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sec-companyfacts-aapl.json"), "utf8")) as CompanyFacts;
const today = new Date("2026-09-28T00:00:00Z");

test("TTM is the last fiscal year plus this year-to-date minus last year-to-date", () => {
  const ocf = ttm(conceptFacts(aapl, "NetCashProvidedByUsedInOperatingActivities"), today)!;
  assert.equal(ocf.end, "2026-06-27");
  const facts = conceptFacts(aapl, "NetCashProvidedByUsedInOperatingActivities");
  const fy = facts.find((f) => f.start === "2024-09-29" && f.end === "2025-09-27")!.val;
  const ytd = facts.find((f) => f.start === "2025-09-28" && f.end === "2026-06-27")!.val;
  const priorYtd = facts.find((f) => f.start === "2024-09-29" && f.end === "2025-06-28")!.val;
  assert.equal(ocf.value, fy + ytd - priorYtd);
});

test("TTM is null when the latest filing is stale", () => {
  assert.equal(ttm(conceptFacts(aapl, "NetCashProvidedByUsedInOperatingActivities"), new Date("2027-12-31")), null);
});

test("a fiscal fourth quarter is derived as the year minus nine months", () => {
  const q4 = quarterlyRevenue(aapl, "2025-10-31")!;
  assert.equal(q4.end, "2025-09-27");
  assert.equal(q4.value, 102_466_000_000);
  const q3 = quarterlyRevenue(aapl, "2026-07-31")!;
  assert.deepEqual(q3, { end: "2026-06-27", value: 109_417_000_000, yearAgo: 94_036_000_000 });
});

test("no quarter within 100 days of the report means no revenue comparison", () => {
  const facts: XbrlFact[] = [{ start: "2025-01-01", end: "2025-03-31", val: 10 }];
  assert.equal(latestQuarterYoY(facts, "2025-09-01"), null);
});

test("fundamentals match Apple's reported fiscal 2025", () => {
  const f = fundamentalsFromFacts(aapl, 3.7e12, today);
  assert.equal(f.growthFiscalYear, "2025");
  assert.ok(Math.abs(f.revenueGrowth! - 0.0643) < 0.001, `revenue growth ${f.revenueGrowth}`);
  assert.ok(Math.abs(f.netIncomeGrowth! - 0.195) < 0.001, `net income growth ${f.netIncomeGrowth}`);
  assert.equal(f.positiveNetIncomeYears, 3);
  assert.ok(f.netProfitMargin! > 0.25 && f.netProfitMargin! < 0.3);
  assert.ok(f.fcfYield! > 0.03 && f.fcfYield! < 0.04);
  assert.ok(f.netDebtToEbitda! > 0 && f.netDebtToEbitda! < 0.5);
  assert.ok(f.payoutRatio! > 0.1 && f.payoutRatio! < 0.15);
  assert.ok(f.dividendsPaidTtm! > 0);
});

test("leverage stays null when no debt concept is reported, so 'net cash' is never claimed on missing data", () => {
  const noDebt: CompanyFacts = { facts: { "us-gaap": { ...aapl.facts!["us-gaap"] } } };
  delete noDebt.facts!["us-gaap"].LongTermDebt;
  delete noDebt.facts!["us-gaap"].CommercialPaper;
  assert.equal(fundamentalsFromFacts(noDebt, 3.7e12, today).netDebtToEbitda, undefined);
});

test("annual values keep one figure per fiscal year, and diluted shares come from the latest quarter", () => {
  const years = annualValues(conceptFacts(aapl, "NetIncomeLoss"));
  assert.deepEqual(years.map((y) => y.end).slice(-2), ["2024-09-28", "2025-09-27"]);
  const shares = dilutedShares(aapl, today)!;
  assert.ok(shares > 14e9 && shares < 15.5e9);
});

test("a malformed unit (object instead of list) reads as no facts", () => {
  const odd = { facts: { "us-gaap": { WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: {} as unknown as XbrlFact[] } } } } };
  assert.deepEqual(conceptFacts(odd, "WeightedAverageNumberOfDilutedSharesOutstanding", "shares"), []);
  assert.equal(dilutedShares(odd, today), null);
});

test("diluted shares fall back to the annual figure when the fiscal fourth quarter is the latest period", () => {
  const facts: XbrlFact[] = [
    { start: "2025-12-01", end: "2026-02-28", val: 1_481_600_000 },
    { start: "2025-06-01", end: "2026-05-31", val: 1_481_000_000 },
  ];
  const cf = { facts: { "us-gaap": { WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: facts } } } } };
  assert.equal(dilutedShares(cf, today), 1_481_000_000);
});
