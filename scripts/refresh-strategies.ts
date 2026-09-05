/**
 * Rebuilds the constituent lists for the data-driven strategies from live
 * Financial Modeling Prep data and writes them to lib/templates/screened.json.
 *
 *   set -a; source .env.local; set +a
 *   npm run refresh:strategies              # all screened strategies
 *   npm run refresh:strategies -- --only quality-breakout-radar,leader-pullback-and-reclaim
 *
 * Nothing is written to the database. Review the diff in screened.json, then
 * `npm run prisma:seed` to push the new lists. Every number that ends up in a
 * rationale comes from the snapshot saved next to it, so the page and the
 * tests can re-check the list against the rules in lib/templates/screens.ts.
 *
 * The script is read-only against FMP. Responses are cached on disk for the
 * run (REFRESH_CACHE_DIR) so a re-run after a crash is cheap.
 */
import fs from "node:fs";
import path from "node:path";
import {
  SCREENS,
  SCREENED_SLUGS,
  evaluateScreen,
  type DividendSnapshot,
  type EarningsSnapshot,
  type Fundamentals,
  type ScreenDefinition,
  type ScreenedSlug,
  type Snapshot,
} from "../lib/templates/screens";
import type { ScreenedFile, ScreenedStrategy } from "../lib/templates/screened";

const KEY = process.env.FMP_API_KEY;
if (!KEY) throw new Error("FMP_API_KEY missing (set -a; source .env.local; set +a)");
const BASE = "https://financialmodelingprep.com/stable";
const OUT = path.join(__dirname, "..", "lib", "templates", "screened.json");
const CACHE_DIR = process.env.REFRESH_CACHE_DIR || "";
const CONCURRENCY = Number(process.env.REFRESH_CONCURRENCY || 8);
const EARNINGS_WINDOW_DAYS = 45;

const args = process.argv.slice(2);
const onlyArg = args[args.indexOf("--only") + 1];
const only = args.includes("--only") && onlyArg ? (onlyArg.split(",") as ScreenedSlug[]) : SCREENED_SLUGS;

/* ------------------------------ fetch layer ------------------------------ */

let inFlight = 0;
const queue: Array<() => void> = [];
const acquire = () =>
  new Promise<void>((resolve) => {
    if (inFlight < CONCURRENCY) {
      inFlight++;
      resolve();
    } else queue.push(() => { inFlight++; resolve(); });
  });
const release = () => {
  inFlight--;
  queue.shift()?.();
};

let calls = 0;
async function get<T>(pathAndQuery: string): Promise<T> {
  const cacheFile = CACHE_DIR ? path.join(CACHE_DIR, encodeURIComponent(pathAndQuery) + ".json") : "";
  if (cacheFile && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as T;
  await acquire();
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const sep = pathAndQuery.includes("?") ? "&" : "?";
      const res = await fetch(`${BASE}${pathAndQuery}${sep}apikey=${KEY}`);
      calls++;
      if (res.status === 429 || res.status >= 500) {
        // Per-minute plan limit: back off long enough for the window to roll over.
        await sleep((res.status === 429 ? 8000 : 1500) * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${pathAndQuery} → ${res.status}`);
      const json = (await res.json()) as T;
      if (cacheFile) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(json));
      }
      return json;
    }
    throw new Error(`${pathAndQuery} → gave up after retries`);
  } finally {
    release();
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapAll<T, R>(items: T[], fn: (t: T) => Promise<R | null>): Promise<Map<T, R>> {
  const out = new Map<T, R>();
  await Promise.all(
    items.map(async (item) => {
      try {
        const r = await fn(item);
        if (r !== null && r !== undefined) out.set(item, r);
      } catch (err) {
        console.warn(`  ! ${String(item)}: ${err instanceof Error ? err.message : err}`);
      }
    })
  );
  return out;
}

/** Drop listing boilerplate the provider appends to some names. */
const cleanName = (name: string) => name.replace(/\s+(class [a-c]\s+)?(common stock|ordinary shares)$/i, "").trim();

/** "Alphabet Inc." and "Alphabet Inc. Class A" are the same company. */
const companyKey = (name: string) =>
  "co:" + name.toLowerCase().replace(/\b(class [abc]|inc\.?|corp\.?|corporation|ltd\.?|plc|co\.?|company|holdings?|the)\b/g, "").replace(/[^a-z0-9]/g, "");

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

/* -------------------------------- sources -------------------------------- */

type Screened = { symbol: string; companyName: string; marketCap: number; sector?: string; avgVolume?: number; volume?: number };

async function universe(minCap: number, maxCap: number | undefined, minVol: number, dividend: boolean) {
  const params = [
    `marketCapMoreThan=${minCap}`,
    maxCap ? `marketCapLowerThan=${maxCap}` : "",
    `volumeMoreThan=${minVol}`,
    dividend ? "dividendMoreThan=0.01" : "",
    "country=US",
    "exchange=NASDAQ,NYSE",
    "isEtf=false",
    "isFund=false",
    "isActivelyTrading=true",
    "limit=5000",
  ].filter(Boolean);
  const rows = await get<Screened[]>(`/company-screener?${params.join("&")}`);
  // Share classes, warrants and units carry a dot or dash; keep plain common stock.
  return rows.filter((r) => /^[A-Z]{1,5}$/.test(r.symbol) && (r.avgVolume ?? r.volume ?? 0) >= minVol);
}

type Quote = { symbol: string; name?: string; price?: number; yearHigh?: number; yearLow?: number; priceAvg50?: number; priceAvg200?: number; avgVolume?: number; marketCap?: number };
const quoteCache = new Map<string, Quote | null>();
async function quote(symbol: string): Promise<Quote | null> {
  if (quoteCache.has(symbol)) return quoteCache.get(symbol)!;
  const rows = await get<Quote[]>(`/quote?symbol=${symbol}`);
  const q = rows?.[0] ?? null;
  quoteCache.set(symbol, q);
  return q;
}

type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };
async function bars(symbol: string, from: string): Promise<Bar[]> {
  const rows = await get<Bar[]>(`/historical-price-eod/full?symbol=${symbol}&from=${from}&to=${isoDay(new Date())}`);
  // FMP returns newest first; work oldest → newest.
  return [...(rows ?? [])].reverse();
}

async function fundamentals(symbol: string, needs: ScreenDefinition["needs"]): Promise<Fundamentals> {
  const out: Fundamentals = {};
  if (needs.fundamentals) {
    const [km, ra] = await Promise.all([
      get<any[]>(`/key-metrics-ttm?symbol=${symbol}`),
      get<any[]>(`/ratios-ttm?symbol=${symbol}`),
    ]);
    const k = km?.[0] ?? {};
    const r = ra?.[0] ?? {};
    out.fcfYield = n(k.freeCashFlowYieldTTM);
    out.netDebtToEbitda = n(k.netDebtToEBITDATTM);
    out.currentRatio = n(k.currentRatioTTM);
    out.netProfitMargin = n(r.netProfitMarginTTM);
    out.interestCoverage = n(r.interestCoverageRatioTTM);
    out.payoutRatio = n(r.dividendPayoutRatioTTM);
  }
  if (needs.growth) {
    const g = (await get<any[]>(`/financial-growth?symbol=${symbol}&period=annual&limit=1`))?.[0];
    if (g) {
      out.revenueGrowth = n(g.revenueGrowth);
      out.netIncomeGrowth = n(g.netIncomeGrowth);
      out.growthFiscalYear = typeof g.fiscalYear === "string" ? g.fiscalYear : null;
    }
  }
  if (needs.incomeHistory) {
    const rows = await get<any[]>(`/income-statement?symbol=${symbol}&period=annual&limit=3`);
    out.positiveNetIncomeYears = rows?.length === 3 ? rows.filter((r) => (n(r.netIncome) ?? 0) > 0).length : null;
  }
  return out;
}

async function lastQuarterSurprise(symbol: string): Promise<number | null> {
  const rows = await get<any[]>(`/earnings?symbol=${symbol}&limit=6`);
  const reported = (rows ?? []).filter((r) => n(r.epsActual) !== null && n(r.epsEstimated) !== null).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = reported[0];
  if (!last) return null;
  const est = n(last.epsEstimated)!;
  const act = n(last.epsActual)!;
  if (est === 0) return act >= 0 ? 0 : -1;
  return (act - est) / Math.abs(est);
}

async function rsi14(symbol: string): Promise<number | null> {
  const rows = await get<any[]>(`/technical-indicators/rsi?symbol=${symbol}&periodLength=14&timeframe=1day`);
  return n(rows?.[0]?.rsi);
}

async function sessionsBelow200(symbol: string): Promise<number | null> {
  const rows = await get<any[]>(`/technical-indicators/sma?symbol=${symbol}&periodLength=200&timeframe=1day`);
  const last60 = (rows ?? []).slice(0, 60);
  if (last60.length < 60) return null;
  return last60.filter((r) => (n(r.close) ?? Infinity) < (n(r.sma) ?? 0)).length;
}

type EarningsRow = { symbol: string; date: string; epsActual: number | null; epsEstimated: number | null; revenueActual: number | null; revenueEstimated: number | null };

/** Every report in the window, fetched in 5-day chunks so no chunk hits FMP's row cap. */
async function recentReports(): Promise<Map<string, EarningsRow>> {
  const out = new Map<string, EarningsRow>();
  const end = new Date();
  for (let start = daysAgo(EARNINGS_WINDOW_DAYS); start <= end; start.setUTCDate(start.getUTCDate() + 5)) {
    const to = new Date(start);
    to.setUTCDate(to.getUTCDate() + 4);
    const rows = await get<EarningsRow[]>(`/earnings-calendar?from=${isoDay(start)}&to=${isoDay(to)}`);
    for (const r of rows ?? []) {
      if (n(r.epsActual) === null) continue; // not reported yet
      const prev = out.get(r.symbol);
      if (!prev || prev.date < r.date) out.set(r.symbol, r);
    }
  }
  return out;
}

async function earningsSnapshot(symbol: string, report: EarningsRow): Promise<EarningsSnapshot | null> {
  const from = new Date(report.date + "T00:00:00Z");
  from.setUTCDate(from.getUTCDate() - 70);
  const b = await bars(symbol, isoDay(from));
  const idx = b.findIndex((bar) => bar.date >= report.date);
  if (idx < 1) return null;
  // Companies that report after the close react the next session; the reaction day carries the volume.
  const candidates = [b[idx], b[idx + 1]].filter(Boolean) as Bar[];
  const reaction = candidates.reduce((best, bar) => (bar.volume > best.volume ? bar : best), candidates[0]);
  const rIdx = b.indexOf(reaction);
  const prev = b[rIdx - 1];
  const priorVolumes = b.slice(Math.max(0, rIdx - 30), rIdx).map((x) => x.volume).filter((v) => v > 0);
  if (!prev || priorVolumes.length < 15) return null;
  const avgVol = priorVolumes.reduce((a, c) => a + c, 0) / priorVolumes.length;
  return {
    date: report.date,
    epsActual: n(report.epsActual),
    epsEstimated: n(report.epsEstimated),
    revenueActual: n(report.revenueActual),
    revenueEstimated: n(report.revenueEstimated),
    reactionDate: reaction.date,
    reactionPct: reaction.close / prev.close - 1,
    reactionVolumeRatio: reaction.volume / avgVol,
    reactionHigh: reaction.high,
    preReportClose: prev.close,
  };
}

type DividendRow = { date: string; adjDividend?: number; dividend?: number; yield?: number; frequency?: string };
const paymentsPerYear = (f?: string) => {
  const s = (f ?? "").toLowerCase();
  if (s.includes("month")) return 12;
  if (s.includes("semi")) return 2;
  if (s.includes("annual") && !s.includes("semi")) return 1;
  return 4;
};

async function dividendSnapshot(symbol: string, price: number, fcfPayout: number | null): Promise<DividendSnapshot | null> {
  const rows = (await get<DividendRow[]>(`/dividends?symbol=${symbol}&limit=160`)) ?? [];
  const paid = rows.filter((r) => (n(r.adjDividend) ?? 0) > 0).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (paid.length < 8) return null;
  const latest = paid[0];
  const ppy = paymentsPerYear(latest.frequency);
  const yearAgo = paid[ppy];
  const forwardAnnual = (n(latest.adjDividend) ?? 0) * ppy;
  if (forwardAnnual <= 0 || price <= 0) return null;

  const thisYear = new Date().getUTCFullYear();
  const byYear = new Map<number, number>();
  for (const r of paid) {
    const y = Number(r.date.slice(0, 4));
    byYear.set(y, (byYear.get(y) ?? 0) + (n(r.adjDividend) ?? 0));
  }
  let growthYears = 0;
  let growthYearsCapped = false;
  for (let y = thisYear - 1; y >= thisYear - 40; y--) {
    const cur = byYear.get(y);
    const prev = byYear.get(y - 1);
    if (cur === undefined) break;
    if (prev === undefined) {
      growthYearsCapped = growthYears > 0; // history ran out mid-streak
      break;
    }
    if (cur <= prev) break;
    growthYears++;
  }

  const fiveYearsAgo = isoDay(daysAgo(365 * 5));
  const yields = paid.filter((r) => r.date >= fiveYearsAgo).map((r) => n(r.yield)).filter((y): y is number => y !== null && y > 0).sort((a, b) => a - b);
  if (yields.length < 8) return null;
  const p80 = yields[Math.min(yields.length - 1, Math.floor(0.8 * (yields.length - 1)))] / 100;

  return {
    forwardAnnual,
    paymentsPerYear: ppy,
    yieldNow: forwardAnnual / price,
    yieldP80: p80,
    growthYears,
    growthYearsCapped,
    recentCut: !!yearAgo && (n(latest.adjDividend) ?? 0) < (n(yearAgo.adjDividend) ?? 0),
    fcfPayout,
    buyZonePrice: forwardAnnual / p80,
  };
}

async function fcfPayoutLatestYear(symbol: string): Promise<number | null> {
  const cf = (await get<any[]>(`/cash-flow-statement?symbol=${symbol}&period=annual&limit=1`))?.[0];
  const fcf = n(cf?.freeCashFlow);
  const paid = Math.abs(n(cf?.commonDividendsPaid) ?? n(cf?.netDividendsPaid) ?? 0);
  if (fcf === null || fcf <= 0) return null;
  return paid / fcf;
}

/* --------------------------------- main ---------------------------------- */

async function buildStrategy(def: ScreenDefinition, reports: Map<string, EarningsRow> | null, exclude: Set<string>): Promise<ScreenedStrategy> {
  console.log(`\n=== ${def.slug}`);
  const u = def.universe;
  let base = await universe(u.marketCapMin, u.marketCapMax, u.avgVolumeMin, !!u.requiresDividend);
  const universeSize = base.length;
  if (def.needs.earnings && reports) base = base.filter((c) => reports.has(c.symbol));
  console.log(`  universe ${universeSize}${def.needs.earnings ? `, reported recently ${base.length}` : ""}`);

  // Pass 1: the quote alone decides most technical rules, so run it first and only
  // fetch fundamentals for names that survive the price-based rules.
  const quotes = await mapAll(base.map((c) => c.symbol), quote);
  const snapshots: Snapshot[] = [];
  for (const c of base) {
    const q = quotes.get(c.symbol);
    if (!q || !n(q.price) || !n(q.yearHigh) || !n(q.yearLow)) continue;
    snapshots.push({
      symbol: c.symbol,
      companyName: cleanName(q.name ?? c.companyName),
      sector: c.sector ?? null,
      marketCap: n(q.marketCap) ?? c.marketCap,
      avgVolume: c.avgVolume ?? c.volume ?? 0,
      price: q.price!,
      sma50: n(q.priceAvg50),
      sma200: n(q.priceAvg200),
      yearHigh: q.yearHigh!,
      yearLow: q.yearLow!,
    });
  }
  const priceRules = { ...def, rules: def.rules.filter((r) => ["above-50-200", "near-high", "off-low", "pullback", "trend-intact", "below-50", "above-200", "pullback-8-20", "below-200", "drawdown", "improving"].includes(r.id)) };
  let survivors = snapshots.filter((s) => evaluateScreen(priceRules, s).qualifies);
  console.log(`  quotes ${snapshots.length}, pass price rules ${survivors.length}`);

  // Pass 2: everything else, only for the survivors.
  await Promise.all(
    survivors.map(async (s) => {
      try {
        if (def.needs.fundamentals || def.needs.growth || def.needs.incomeHistory) s.fundamentals = await fundamentals(s.symbol, def.needs);
        if (def.needs.lastQuarter) s.lastQuarterEpsSurprise = await lastQuarterSurprise(s.symbol);
        if (def.needs.rsi) s.rsi = await rsi14(s.symbol);
        if (def.needs.sma200History) s.sessionsBelow200Of60 = await sessionsBelow200(s.symbol);
        if (def.needs.earnings && reports) s.earnings = await earningsSnapshot(s.symbol, reports.get(s.symbol)!);
        if (def.needs.dividends) s.dividend = await dividendSnapshot(s.symbol, s.price, await fcfPayoutLatestYear(s.symbol));
      } catch (err) {
        console.warn(`  ! ${s.symbol}: ${err instanceof Error ? err.message : err}`);
      }
    })
  );

  const qualified = survivors.filter((s) => evaluateScreen(def, s).qualifies && def.trigger(s) && !exclude.has(s.symbol) && !exclude.has(companyKey(s.companyName)));
  qualified.sort((a, b) => def.rank(b) - def.rank(a));
  // One line per company: drop a second share class (GOOG/GOOGL) of a name already ranked higher.
  const seenCompanies = new Set<string>();
  const deduped = qualified.filter((s) => {
    const key = companyKey(s.companyName);
    if (seenCompanies.has(key)) return false;
    seenCompanies.add(key);
    return true;
  });
  const picked = def.select ? def.select(deduped, def.pick) : deduped.slice(0, def.pick);
  console.log(`  qualified ${qualified.length}, picked ${picked.map((s) => s.symbol).join(" ")}`);

  return {
    refreshedAt: new Date().toISOString(),
    universeSize,
    qualifiedCount: qualified.length,
    constituents: picked.map((s, i) => {
      const t = def.trigger(s)!;
      return {
        ticker: s.symbol,
        companyName: s.companyName,
        alertType: t.alertType,
        triggerValue: t.triggerValue,
        triggerDirection: t.triggerDirection,
        rationale: def.rationale(s),
        sortOrder: i + 1,
        snapshot: s,
      };
    }),
  };
}

async function main() {
  const existing: ScreenedFile = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { generatedAt: "", strategies: {} };
  const reports = only.some((s) => SCREENS[s].needs.earnings) ? await recentReports() : null;
  if (reports) console.log(`reports in the last ${EARNINGS_WINDOW_DAYS} days: ${reports.size}`);

  // A company appears in one list only: lists built earlier in catalog order take precedence,
  // so a user who activates several strategies never gets the same alert twice.
  const chosen = new Set<string>();
  for (const slug of SCREENED_SLUGS) {
    if (!only.includes(slug)) {
      // Not rebuilt this run: still reserve its current names.
      existing.strategies[slug]?.constituents.forEach((c) => { chosen.add(c.ticker); chosen.add(companyKey(c.companyName)); });
    }
  }
  for (const slug of SCREENED_SLUGS) {
    if (!only.includes(slug)) continue;
    const def = SCREENS[slug];
    const result = await buildStrategy(def, reports, chosen);
    result.constituents.forEach((c) => { chosen.add(c.ticker); chosen.add(companyKey(c.companyName)); });
    existing.strategies[slug] = result;
  }
  existing.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + "\n");
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)} after ${calls} FMP calls`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
