/**
 * Company fundamentals from SEC XBRL "companyfacts" payloads
 * (https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json). Free, no key,
 * and the numbers are the filers' own. Pure functions, no I/O; the strategy
 * refresh script does the fetching.
 *
 * Flow items (revenue, cash flow) are trailing twelve months where the filings
 * allow it: the latest fiscal year plus this year's year-to-date minus last
 * year's year-to-date. Balance-sheet items are the latest reported instant.
 * Anything the filings do not support comes back null, and the screens treat
 * null conservatively (see lib/templates/screens.ts).
 */
import type { Fundamentals } from "@/lib/templates/screens";

export interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
}

export interface CompanyFacts {
  facts?: Record<string, Record<string, { units?: Record<string, XbrlFact[]> }>>;
}

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY_MS;
const duration = (f: XbrlFact) => (f.start ? daysBetween(f.start, f.end) + 1 : 0);
const isAnnual = (f: XbrlFact) => duration(f) >= 340 && duration(f) <= 380;
const isQuarter = (f: XbrlFact) => duration(f) >= 80 && duration(f) <= 100;
const near = (a: string, b: string, tolerance = 10) => Math.abs(daysBetween(a, b)) <= tolerance;

/** Facts for one us-gaap (or dei) concept in one unit, latest filing winning for each period. */
export function conceptFacts(cf: CompanyFacts, tag: string, unit = "USD", taxonomy = "us-gaap"): XbrlFact[] {
  const units = cf.facts?.[taxonomy]?.[tag]?.units?.[unit];
  // SEC occasionally serves an empty object where the fact list belongs.
  const raw = Array.isArray(units) ? units : [];
  const byPeriod = new Map<string, XbrlFact>();
  for (const f of raw) {
    if (typeof f.val !== "number" || !Number.isFinite(f.val) || !f.end) continue;
    const key = `${f.start ?? ""}|${f.end}`;
    const prev = byPeriod.get(key);
    if (!prev || (f.filed ?? "") > (prev.filed ?? "")) byPeriod.set(key, f);
  }
  return [...byPeriod.values()].sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : duration(a) - duration(b)));
}

export interface PeriodValue {
  value: number;
  /** Period end, YYYY-MM-DD. */
  end: string;
}

/**
 * Trailing twelve months ending at the latest reported period. Uses the
 * annual figure when the latest period is a fiscal year end, otherwise
 * FY + YTD - prior-year YTD. Null when the latest period is stale or the
 * pieces are missing.
 */
export function ttm(facts: XbrlFact[], today = new Date(), maxAgeDays = 200): PeriodValue | null {
  const flows = facts.filter((f) => f.start);
  if (!flows.length) return null;
  const latestEnd = flows.reduce((m, f) => (f.end > m ? f.end : m), flows[0].end);
  if (daysBetween(latestEnd, today.toISOString().slice(0, 10)) > maxAgeDays) return null;
  const atEnd = flows.filter((f) => f.end === latestEnd);
  const annual = atEnd.find(isAnnual);
  if (annual) return { value: annual.val, end: latestEnd };
  const ytd = atEnd.filter((f) => duration(f) < 340).sort((a, b) => duration(b) - duration(a))[0];
  if (!ytd?.start) return null;
  const priorFy = flows.find((f) => isAnnual(f) && near(f.end, ytd.start!, 10) && f.end < ytd.start!);
  const priorYtd = flows.find((f) => near(f.end, latestEnd, 375) && daysBetween(f.end, latestEnd) >= 355 && Math.abs(duration(f) - duration(ytd)) <= 10);
  if (!priorFy || !priorYtd) return null;
  return { value: priorFy.val + ytd.val - priorYtd.val, end: latestEnd };
}

/** Fiscal-year values, oldest first, one per year end. */
export function annualValues(facts: XbrlFact[]): PeriodValue[] {
  const byEnd = new Map<string, PeriodValue>();
  for (const f of facts) if (isAnnual(f)) byEnd.set(f.end, { value: f.val, end: f.end });
  return [...byEnd.values()].sort((a, b) => (a.end < b.end ? -1 : 1));
}

/** Latest instant (balance-sheet) value, optionally only at a given date. */
export function latestInstant(facts: XbrlFact[], at?: string): PeriodValue | null {
  const instants = facts.filter((f) => !f.start && (!at || f.end === at));
  if (!instants.length) return null;
  const f = instants.reduce((m, x) => (x.end > m.end ? x : m), instants[0]);
  return { value: f.val, end: f.end };
}

/**
 * Three-month value for the quarter ending at `end`. A fiscal fourth quarter
 * is usually only reported inside the annual figure, so it is derived as the
 * fiscal year minus the nine-month year-to-date.
 */
export function quarterValue(facts: XbrlFact[], end: string): number | null {
  const direct = facts.find((f) => f.end === end && isQuarter(f));
  if (direct) return direct.val;
  const fy = facts.find((f) => f.end === end && isAnnual(f));
  if (!fy?.start) return null;
  const nineMonths = facts.find((f) => f.start === fy.start && duration(f) >= 260 && duration(f) <= 285);
  return nineMonths ? fy.val - nineMonths.val : null;
}

/** Latest quarter ending before `before`, and the same quarter a year earlier. */
export function latestQuarterYoY(facts: XbrlFact[], before: string, maxLagDays = 100): { end: string; value: number; yearAgo: number } | null {
  const ends = [...new Set(facts.filter((f) => f.start && (isQuarter(f) || isAnnual(f)) && f.end < before).map((f) => f.end))].sort().reverse();
  const end = ends[0];
  if (!end || daysBetween(end, before) > maxLagDays) return null;
  const value = quarterValue(facts, end);
  const priorEnd = ends.find((e) => daysBetween(e, end) >= 355 && daysBetween(e, end) <= 375);
  const yearAgo = priorEnd ? quarterValue(facts, priorEnd) : null;
  return value !== null && yearAgo !== null ? { end, value, yearAgo } : null;
}

/* ------------------------------ concept picks ------------------------------ */

const REVENUE = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
  "RevenuesNetOfInterestExpense",
];
const NET_INCOME = ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"];
const OPERATING_CASH = ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"];
const CAPEX = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
  "PaymentsToAcquireOilAndGasPropertyAndEquipment",
  "PaymentsToAcquireOilAndGasProperty",
];
const OPERATING_INCOME = ["OperatingIncomeLoss"];
const DEPRECIATION = ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAndAmortization", "Depreciation"];
const DIVIDENDS_PAID = ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"];
const CASH = ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"];
const SHORT_TERM_INVESTMENTS = ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"];

/** The concept among `tags` with the most recent data, and its facts. */
export function pickConcept(cf: CompanyFacts, tags: string[]): { tag: string; facts: XbrlFact[] } | null {
  let best: { tag: string; facts: XbrlFact[]; end: string } | null = null;
  for (const tag of tags) {
    const facts = conceptFacts(cf, tag);
    if (!facts.length) continue;
    const end = facts[facts.length - 1].end;
    if (!best || end > best.end) best = { tag, facts, end };
  }
  return best ? { tag: best.tag, facts: best.facts } : null;
}

const ttmOf = (cf: CompanyFacts, tags: string[], today: Date) => {
  const c = pickConcept(cf, tags);
  return c ? ttm(c.facts, today) : null;
};

/** Total debt at `at`: long-term (current + noncurrent) plus short-term borrowings. Null when no debt concept is reported then. */
function debtAt(cf: CompanyFacts, at: string): number | null {
  const v = (tag: string) => latestInstant(conceptFacts(cf, tag), at)?.value ?? null;
  let longTerm = v("LongTermDebt");
  if (longTerm === null) {
    const parts = [v("LongTermDebtNoncurrent"), v("LongTermDebtCurrent")];
    if (parts.some((p) => p !== null)) longTerm = parts.reduce<number>((a, p) => a + (p ?? 0), 0);
  }
  if (longTerm === null) {
    const parts = [v("LongTermDebtAndCapitalLeaseObligations"), v("LongTermDebtAndCapitalLeaseObligationsCurrent")];
    if (parts.some((p) => p !== null)) longTerm = parts.reduce<number>((a, p) => a + (p ?? 0), 0);
  }
  const shortTerm = [v("ShortTermBorrowings"), v("CommercialPaper")];
  if (longTerm === null && shortTerm.every((p) => p === null)) return null;
  return (longTerm ?? 0) + shortTerm.reduce<number>((a, p) => a + (p ?? 0), 0);
}

export interface SecFundamentals extends Fundamentals {
  /** Latest fiscal year: dividends paid / free cash flow. */
  fcfPayoutLatestYear?: number | null;
  /** TTM dividends paid; > 0 means the company pays a dividend. */
  dividendsPaidTtm?: number | null;
}

/** Everything the screens need from the filings, given today's market cap. */
export function fundamentalsFromFacts(cf: CompanyFacts, marketCap: number, today = new Date()): SecFundamentals {
  const out: SecFundamentals = {};
  const revenue = ttmOf(cf, REVENUE, today);
  const netIncome = ttmOf(cf, NET_INCOME, today);
  const ocf = ttmOf(cf, OPERATING_CASH, today);
  const capex = ttmOf(cf, CAPEX, today);
  const opIncome = ttmOf(cf, OPERATING_INCOME, today);
  const dep = ttmOf(cf, DEPRECIATION, today);
  const divs = ttmOf(cf, DIVIDENDS_PAID, today);

  // Capital spending under an unlisted concept is treated as zero only for companies that report none of the usual ones.
  if (ocf && marketCap > 0) out.fcfYield = (ocf.value - Math.abs(capex?.value ?? 0)) / marketCap;
  if (revenue && netIncome && revenue.value > 0) out.netProfitMargin = netIncome.value / revenue.value;
  if (divs && netIncome && netIncome.value > 0) out.payoutRatio = Math.abs(divs.value) / netIncome.value;
  out.dividendsPaidTtm = divs ? Math.abs(divs.value) : null;

  const cashConcept = pickConcept(cf, CASH);
  const cashNow = cashConcept ? latestInstant(cashConcept.facts) : null;
  if (cashNow && opIncome) {
    const debt = debtAt(cf, cashNow.end);
    const sti = pickConcept(cf, SHORT_TERM_INVESTMENTS);
    const investments = sti ? latestInstant(sti.facts, cashNow.end)?.value ?? 0 : 0;
    const ebitda = opIncome.value + (dep?.value ?? 0);
    if (debt !== null && ebitda > 0) out.netDebtToEbitda = (debt - cashNow.value - investments) / ebitda;
  }

  const revYears = annualValues(pickConcept(cf, REVENUE)?.facts ?? []);
  const niYears = annualValues(pickConcept(cf, NET_INCOME)?.facts ?? []);
  const recent = (years: PeriodValue[]) => {
    const last = years[years.length - 1];
    return last && daysBetween(last.end, today.toISOString().slice(0, 10)) <= 460 ? years : [];
  };
  const growth = (years: PeriodValue[]) => {
    const [prev, cur] = years.slice(-2);
    if (!prev || !cur || daysBetween(prev.end, cur.end) < 340 || prev.value === 0) return null;
    return (cur.value - prev.value) / Math.abs(prev.value);
  };
  const rev = recent(revYears);
  const ni = recent(niYears);
  out.revenueGrowth = growth(rev);
  out.netIncomeGrowth = growth(ni);
  const latestYear = rev[rev.length - 1] ?? ni[ni.length - 1];
  out.growthFiscalYear = latestYear ? latestYear.end.slice(0, 4) : null;
  const lastThree = ni.slice(-3);
  out.positiveNetIncomeYears = lastThree.length === 3 ? lastThree.filter((y) => y.value > 0).length : null;

  const ocfYears = annualValues(pickConcept(cf, OPERATING_CASH)?.facts ?? []);
  const capexYears = annualValues(pickConcept(cf, CAPEX)?.facts ?? []);
  const divYears = annualValues(pickConcept(cf, DIVIDENDS_PAID)?.facts ?? []);
  const lastOcf = ocfYears[ocfYears.length - 1];
  const lastDiv = divYears.find((d) => lastOcf && d.end === lastOcf.end);
  if (lastOcf && lastDiv) {
    const fcf = lastOcf.value - Math.abs(capexYears.find((c) => c.end === lastOcf.end)?.value ?? 0);
    out.fcfPayoutLatestYear = fcf > 0 ? Math.abs(lastDiv.value) / fcf : null;
  }
  return out;
}

/** Quarterly revenue for the latest quarter before `before`, with the year-earlier quarter. */
export function quarterlyRevenue(cf: CompanyFacts, before: string) {
  const c = pickConcept(cf, REVENUE);
  return c ? latestQuarterYoY(c.facts, before) : null;
}

/** Latest diluted weighted-average share count (all classes), for issuers whose cover page reports shares by class only. */
export function dilutedShares(cf: CompanyFacts, today = new Date()): number | null {
  // Fiscal fourth quarters usually appear only as the annual figure, so accept either; the latest period wins.
  const facts = conceptFacts(cf, "WeightedAverageNumberOfDilutedSharesOutstanding", "shares").filter((f) => isQuarter(f) || isAnnual(f));
  const last = facts[facts.length - 1];
  if (!last || daysBetween(last.end, today.toISOString().slice(0, 10)) > 200) return null;
  return last.val;
}

/** Every us-gaap concept read above; the refresh script keeps only these when it caches a companyfacts payload. */
export const XBRL_CONCEPTS = [
  ...REVENUE,
  ...NET_INCOME,
  ...OPERATING_CASH,
  ...CAPEX,
  ...OPERATING_INCOME,
  ...DEPRECIATION,
  ...DIVIDENDS_PAID,
  ...CASH,
  ...SHORT_TERM_INVESTMENTS,
  "LongTermDebt",
  "LongTermDebtNoncurrent",
  "LongTermDebtCurrent",
  "LongTermDebtAndCapitalLeaseObligations",
  "LongTermDebtAndCapitalLeaseObligationsCurrent",
  "ShortTermBorrowings",
  "CommercialPaper",
  "WeightedAverageNumberOfDilutedSharesOutstanding",
];
