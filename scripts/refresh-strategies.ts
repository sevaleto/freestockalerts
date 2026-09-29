/**
 * Rebuilds the constituent lists for the data-driven strategies and writes
 * them to lib/templates/screened.json.
 *
 *   set -a; source .env.local; set +a
 *   npm run refresh:strategies              # all screened strategies
 *   npm run refresh:strategies -- --only quality-breakout-radar,leader-pullback-and-reclaim
 *
 * Sources (FMP was retired 2026-09-18):
 *   - Universe: US common stocks on the NYSE and Nasdaq (Twelve Data reference
 *     list, matched to SEC CIKs)
 *   - Prices, 52-week range, average volume, daily bars: Twelve Data
 *   - Market cap: price x shares outstanding from SEC XBRL
 *   - Fundamentals and quarterly revenue: SEC XBRL companyfacts (free)
 *   - Earnings dates: SEC Form 8-K Item 2.02 filings (free)
 *   - EPS surprises, dividends, sector: Twelve Data (21, 21 and 11 credits each,
 *     fetched only for names that already pass every free rule)
 *
 * Nothing is written to the database. Review the diff in screened.json, then
 * `npm run prisma:seed` to push the new lists. Every number that ends up in a
 * rationale comes from the snapshot saved next to it, so the page and the
 * tests can re-check the list against the rules in lib/templates/screens.ts.
 *
 * The production app shares the Twelve Data key, so the script spends at most
 * REFRESH_CREDITS_PER_MIN (default 450 of 610) and is best run after the close.
 * Responses are cached on disk (REFRESH_CACHE_DIR, default a dated temp dir), so
 * a re-run the same day is nearly free.
 */
import fs from "node:fs";
import os from "node:os";
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
import { parseTdQuoteResponse, parseTdTimeSeries, type AppQuote, type DailyBarTD } from "../lib/api/twelveData";
import { rsiSeries, sma } from "../lib/marketData/indicators";
import { XBRL_CONCEPTS, dilutedShares, fundamentalsFromFacts, quarterlyRevenue, type CompanyFacts } from "../lib/sec/fundamentals";

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
if (!TD_KEY) throw new Error("TWELVE_DATA_API_KEY missing (set -a; source .env.local; set +a)");
const SEC_UA = process.env.SEC_USER_AGENT || "Manuel Jesus sevaleto@gmail.com";
const TODAY = new Date();
const TODAY_KEY = TODAY.toISOString().slice(0, 10);
const OUT = path.join(__dirname, "..", "lib", "templates", "screened.json");
const CACHE_DIR = process.env.REFRESH_CACHE_DIR || path.join(os.tmpdir(), `fsa-refresh-${TODAY_KEY}`);
const CREDITS_PER_MIN = Number(process.env.REFRESH_CREDITS_PER_MIN || 450);
const EARNINGS_WINDOW_DAYS = 45;
const BAR_SESSIONS = 1300; // five years for dividend yield history; one credit whatever the size
const QUOTE_BATCH = 120;

const args = process.argv.slice(2);
const onlyArg = args[args.indexOf("--only") + 1];
const only = args.includes("--only") && onlyArg ? (onlyArg.split(",") as ScreenedSlug[]) : SCREENED_SLUGS;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => isoDay(new Date(Date.parse(iso + "T00:00:00Z") + days * 86_400_000));
const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : null;
};

/* --------------------------------- cache --------------------------------- */

fs.mkdirSync(CACHE_DIR, { recursive: true });
const cacheFile = (key: string) => path.join(CACHE_DIR, encodeURIComponent(key).slice(0, 200) + ".json");
function cached<T>(key: string): { hit: true; value: T } | { hit: false } {
  const f = cacheFile(key);
  return fs.existsSync(f) ? { hit: true, value: JSON.parse(fs.readFileSync(f, "utf8")) as T } : { hit: false };
}
const store = (key: string, value: unknown) => fs.writeFileSync(cacheFile(key), JSON.stringify(value));

/** At most `limit` calls of fn in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

/* ------------------------------ Twelve Data ------------------------------ */

let creditsUsed = 0;
const spent: Array<{ t: number; c: number }> = [];
async function spend(cost: number) {
  for (;;) {
    const now = Date.now();
    while (spent.length && now - spent[0].t > 61_000) spent.shift();
    const used = spent.reduce((a, s) => a + s.c, 0);
    if (used + cost <= CREDITS_PER_MIN) {
      spent.push({ t: now, c: cost });
      creditsUsed += cost;
      return;
    }
    await sleep(1000);
  }
}

/** Twelve Data GET with a credit budget. Null when the provider has no data for the symbol. */
async function td<T>(pathAndQuery: string, cost: number): Promise<T | null> {
  const c = cached<T | null>(`td${pathAndQuery}`);
  if (c.hit) return c.value;
  for (let attempt = 0; attempt < 6; attempt++) {
    await spend(cost);
    const sep = pathAndQuery.includes("?") ? "&" : "?";
    const res = await fetch(`https://api.twelvedata.com${pathAndQuery}${sep}apikey=${TD_KEY}`);
    const body = (await res.json().catch(() => null)) as { status?: string; code?: number; message?: string } | null;
    const code = res.status !== 200 ? res.status : body?.status === "error" ? body.code : 200;
    if (code === 429 || (code ?? 0) >= 500) {
      await sleep(15_000 * (attempt + 1));
      continue;
    }
    const value = code === 200 ? (body as T) : null;
    if (code !== 200 && code !== 404 && code !== 400) console.warn(`  ! td ${pathAndQuery.split("&")[0]} → ${code} ${body?.message ?? ""}`);
    store(`td${pathAndQuery}`, value);
    return value;
  }
  throw new Error(`td ${pathAndQuery} gave up after retries`);
}

/* ---------------------------------- SEC ---------------------------------- */

let nextSecSlot = 0;
async function secThrottle() {
  const now = Date.now();
  const wait = Math.max(0, nextSecSlot - now);
  nextSecSlot = Math.max(now, nextSecSlot) + 125; // 8 requests per second, under the SEC's 10
  if (wait) await sleep(wait);
}

/** SEC GET; `trim` shrinks the payload before it is cached. Null on 404. */
async function sec<T>(url: string, trim: (v: any) => T = (v) => v): Promise<T | null> {
  const c = cached<T | null>(url);
  if (c.hit) return c.value;
  for (let attempt = 0; attempt < 5; attempt++) {
    await secThrottle();
    const res = await fetch(url, { headers: { "User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate" } });
    if (res.status === 404) {
      store(url, null);
      return null;
    }
    if (res.status === 429 || res.status >= 500 || res.status === 403) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    const value = trim(await res.json());
    store(url, value);
    return value;
  }
  throw new Error(`${url} gave up after retries`);
}

const cik10 = (cik: number) => String(cik).padStart(10, "0");

const KEEP = new Set(XBRL_CONCEPTS);
const companyFacts = (cik: number) =>
  sec<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10(cik)}.json`, (v) => {
    const gaap = v?.facts?.["us-gaap"] ?? {};
    const kept: Record<string, unknown> = {};
    for (const [tag, body] of Object.entries(gaap)) if (KEEP.has(tag)) kept[tag] = { units: (body as any).units };
    return { facts: { "us-gaap": kept } } as CompanyFacts;
  });

interface Submissions {
  state: string | null;
  earningsReleases: Array<{ date: string; accepted: string }>;
}
const submissions = (cik: number) =>
  sec<Submissions>(`https://data.sec.gov/submissions/CIK${cik10(cik)}.json`, (v) => {
    const r = v?.filings?.recent ?? {};
    const releases: Submissions["earningsReleases"] = [];
    (r.form ?? []).forEach((form: string, i: number) => {
      if (form === "8-K" && String(r.items?.[i] ?? "").split(",").includes("2.02")) releases.push({ date: r.filingDate[i], accepted: r.acceptanceDateTime?.[i] ?? "" });
    });
    return { state: v?.addresses?.business?.stateOrCountry ?? null, earningsReleases: releases.slice(0, 12) };
  });

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
);

/* -------------------------------- universe -------------------------------- */

interface Listing {
  symbol: string;
  cik: number;
}

interface Candidate {
  symbol: string;
  cik: number;
  companyName: string;
  price: number;
  avgVolume: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  bars: DailyBarTD[];
  sma50: number | null;
  sma200: number | null;
}

/** Drop listing boilerplate the provider appends to some names. */
const cleanName = (name: string) => name.replace(/\s+(class [a-c]\s+)?(common stock|ordinary shares)$/i, "").trim();

/** "Alphabet Inc." and "Alphabet Inc. Class A" are the same company. */
const companyKey = (name: string) =>
  "co:" + name.toLowerCase().replace(/\b(class [abc]|inc\.?|corp\.?|corporation|ltd\.?|plc|co\.?|company|holdings?|the)\b/g, "").replace(/[^a-z0-9]/g, "");

async function listings(): Promise<Listing[]> {
  const secList = await sec<{ fields: string[]; data: Array<[number, string, string, string]> }>("https://www.sec.gov/files/company_tickers_exchange.json");
  const common = new Set<string>();
  for (const exchange of ["NYSE", "NASDAQ"]) {
    const body = await td<{ data?: Array<{ symbol: string; country?: string; type?: string }> }>(`/stocks?exchange=${exchange}&type=Common%20Stock`, 1);
    for (const s of body?.data ?? []) if (s.country === "United States" && s.type === "Common Stock") common.add(s.symbol);
  }
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const [cik, , ticker, exchange] of secList?.data ?? []) {
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker) || (exchange !== "NYSE" && exchange !== "Nasdaq") || !common.has(ticker) || seen.has(ticker)) continue;
    seen.add(ticker);
    out.push({ symbol: ticker, cik });
  }
  return out;
}

async function quotes(symbols: string[]): Promise<Map<string, AppQuote>> {
  const out = new Map<string, AppQuote>();
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += QUOTE_BATCH) chunks.push(symbols.slice(i, i + QUOTE_BATCH));
  let done = 0;
  await pool(chunks, 2, async (chunk) => {
    const body = await td<unknown>(`/quote?symbol=${chunk.join(",")}`, chunk.length);
    for (const q of parseTdQuoteResponse(body, chunk).quotes) out.set(q.ticker, q);
    done += chunk.length;
    if (done % 1200 < QUOTE_BATCH) console.log(`  quotes ${done}/${symbols.length}`);
  });
  return out;
}

/** Latest cover-page share count per CIK from the SEC's bulk frames (the four most recent quarters). */
async function frameShares(): Promise<Map<number, { shares: number; loc: string }>> {
  const out = new Map<number, { shares: number; loc: string; end: string }>();
  const y = TODAY.getUTCFullYear();
  const q = Math.floor(TODAY.getUTCMonth() / 3) + 1;
  const frames: string[] = [];
  for (let i = 0; i < 4; i++) {
    const qq = ((q - 1 - i + 8) % 4) + 1;
    const yy = y - (q - 1 - i < 0 ? 1 : 0);
    frames.push(`CY${yy}Q${qq}I`);
  }
  for (const frame of frames) {
    const body = await sec<{ data: Array<{ cik: number; val: number; loc?: string; end: string }> }>(
      `https://data.sec.gov/api/xbrl/frames/dei/EntityCommonStockSharesOutstanding/shares/${frame}.json`
    );
    for (const r of body?.data ?? []) {
      const prev = out.get(r.cik);
      if (!prev || r.end > prev.end) out.set(r.cik, { shares: r.val, loc: r.loc ?? "", end: r.end });
    }
  }
  return out;
}

async function candidates(): Promise<Candidate[]> {
  const all = await listings();
  console.log(`listings: ${all.length} US common stocks on the NYSE and Nasdaq`);
  const minVolume = Math.min(...Object.values(SCREENS).map((d) => d.universe.avgVolumeMin));
  const minCap = Math.min(...Object.values(SCREENS).map((d) => d.universe.marketCapMin));
  const q = await quotes(all.map((l) => l.symbol));
  const liquid = all.filter((l) => {
    const x = q.get(l.symbol);
    return x && x.price > 0 && x.avgVolume >= minVolume && x.fiftyTwoWeekHigh > 0 && x.fiftyTwoWeekLow > 0;
  });
  console.log(`quotes: ${q.size}, average volume ≥ ${minVolume / 1e6}M: ${liquid.length}`);

  const frames = await frameShares();
  const withCap: Array<Listing & { marketCap: number }> = [];
  await pool(liquid, 8, async (l) => {
    const quote = q.get(l.symbol)!;
    const f = frames.get(l.cik);
    let shares = f?.shares ?? null;
    // Location: the frame's business address, or the filer's SEC submissions record. Checked first; it is free.
    const us = f ? f.loc.startsWith("US") : US_STATES.has((await submissions(l.cik))?.state ?? "");
    if (!us) return;
    if (!shares) {
      // Multi-class issuers report cover-page shares by class only; use the diluted share count instead.
      const concept = await sec<any>(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik10(l.cik)}/us-gaap/WeightedAverageNumberOfDilutedSharesOutstanding.json`);
      shares = concept ? dilutedShares({ facts: { "us-gaap": { WeightedAverageNumberOfDilutedSharesOutstanding: { units: concept.units } } } }, TODAY) : null;
    }
    if (!shares) {
      // Last resort for US issuers that report no company-wide count in XBRL (51 credits each).
      const stats = await td<{ statistics?: { stock_statistics?: { shares_outstanding?: number } } }>(`/statistics?symbol=${l.symbol}`, 51);
      shares = n(stats?.statistics?.stock_statistics?.shares_outstanding);
    }
    if (!shares) return;
    const marketCap = shares * quote.price;
    if (marketCap < minCap) return;
    if (us) withCap.push({ ...l, marketCap });
  });
  console.log(`market cap ≥ $${minCap / 1e9}B and US-based: ${withCap.length}`);

  const out: Candidate[] = [];
  await pool(withCap, 4, async (l) => {
    const body = await td<unknown>(`/time_series?symbol=${l.symbol}&interval=1day&outputsize=${BAR_SESSIONS}`, 1);
    const bars = parseTdTimeSeries(body);
    if (bars.length < 60) return;
    const quote = q.get(l.symbol)!;
    const closes = bars.map((b) => b.close);
    out.push({
      symbol: l.symbol,
      cik: l.cik,
      companyName: cleanName(quote.companyName),
      price: quote.price,
      avgVolume: quote.avgVolume,
      yearHigh: quote.fiftyTwoWeekHigh,
      yearLow: quote.fiftyTwoWeekLow,
      marketCap: l.marketCap,
      bars,
      sma50: sma(closes, 50),
      sma200: sma(closes, 200),
    });
  });
  out.sort((a, b) => b.marketCap - a.marketCap);
  console.log(`daily bars: ${out.length}`);
  return out;
}

/* ---------------------------- derived snapshots ---------------------------- */

const rsi14 = (bars: DailyBarTD[]) => rsiSeries(bars.map((b) => b.close)).at(-1) ?? null;

function sessionsBelow200(bars: DailyBarTD[]): number | null {
  if (bars.length < 260) return null;
  const closes = bars.map((b) => b.close);
  let below = 0;
  for (let i = closes.length - 60; i < closes.length; i++) {
    const avg = sma(closes.slice(0, i + 1), 200);
    if (avg !== null && closes[i] < avg) below++;
  }
  return below;
}

const FUNDAMENTAL_KEYS: Array<keyof Fundamentals> = [
  "fcfYield",
  "revenueGrowth",
  "netIncomeGrowth",
  "growthFiscalYear",
  "netDebtToEbitda",
  "netProfitMargin",
  "payoutRatio",
  "positiveNetIncomeYears",
];

/** Reaction to the latest earnings release in the window; EPS is filled in later (it costs credits). */
function earningsReaction(bars: DailyBarTD[], reportDate: string, quarter: { value: number; yearAgo: number } | null): EarningsSnapshot | null {
  const idx = bars.findIndex((b) => b.date >= reportDate);
  if (idx < 1) return null;
  // Companies that report after the close react the next session; the reaction day carries the volume.
  const choices = [bars[idx], bars[idx + 1]].filter(Boolean);
  const reaction = choices.reduce((best, b) => (b.volume > best.volume ? b : best), choices[0]);
  const rIdx = bars.indexOf(reaction);
  const prev = bars[rIdx - 1];
  const priorVolumes = bars.slice(Math.max(0, rIdx - 30), rIdx).map((b) => b.volume).filter((v) => v > 0);
  if (!prev || priorVolumes.length < 15) return null;
  const avgVol = priorVolumes.reduce((a, c) => a + c, 0) / priorVolumes.length;
  return {
    date: reportDate,
    epsActual: null,
    epsEstimated: null,
    revenueActual: quarter?.value ?? null,
    revenueEstimated: null,
    revenueYearAgo: quarter?.yearAgo ?? null,
    reactionDate: reaction.date,
    reactionPct: reaction.close / prev.close - 1,
    reactionVolumeRatio: reaction.volume / avgVol,
    reactionHigh: reaction.high,
    preReportClose: prev.close,
  };
}

type TdEarning = { date: string; eps_estimate: number | null; eps_actual: number | null };
const earningsRows = async (symbol: string) =>
  ((await td<{ earnings?: TdEarning[] }>(`/earnings?symbol=${symbol}`, 21))?.earnings ?? []).filter((r) => n(r.eps_actual) !== null && n(r.eps_estimate) !== null && r.date <= TODAY_KEY);

/** Surprise on the latest reported quarter, if it was reported in the last four months. */
async function lastQuarterSurprise(symbol: string): Promise<number | null> {
  const rows = (await earningsRows(symbol)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = rows[0];
  if (!last || last.date < addDays(TODAY_KEY, -125)) return null;
  const est = n(last.eps_estimate)!;
  const act = n(last.eps_actual)!;
  if (est === 0) return act >= 0 ? 0 : -1;
  return (act - est) / Math.abs(est);
}

async function sector(symbol: string): Promise<string | null> {
  const p = await td<{ sector?: string }>(`/profile?symbol=${symbol}`, 11);
  return p?.sector || null;
}

async function dividendSnapshot(c: Candidate, fcfPayout: number | null): Promise<DividendSnapshot | null> {
  const rows = (await td<{ dividends?: Array<{ ex_date: string; amount: number }> }>(`/dividends?symbol=${c.symbol}&range=full`, 21))?.dividends ?? [];
  let paid = rows.filter((r) => (n(r.amount) ?? 0) > 0 && r.ex_date <= TODAY_KEY).sort((a, b) => (a.ex_date < b.ex_date ? 1 : -1));
  if (paid.length < 8) return null;
  // Specials are far above the regular payment; leave them out of the regular series.
  const median = [...paid.slice(0, 8)].map((r) => r.amount).sort((a, b) => a - b)[4];
  paid = paid.filter((r) => r.amount <= median * 2);
  const latest = paid[0];
  const inLastYear = paid.filter((r) => r.ex_date > addDays(latest.ex_date, -360)).length;
  const ppy = [1, 2, 4, 12].reduce((best, k) => (Math.abs(k - inLastYear) < Math.abs(best - inLastYear) ? k : best), 4);
  const yearAgo = paid[ppy];
  const forwardAnnual = latest.amount * ppy;
  if (forwardAnnual <= 0 || c.price <= 0) return null;

  const thisYear = TODAY.getUTCFullYear();
  const byYear = new Map<number, number>();
  for (const r of paid) byYear.set(Number(r.ex_date.slice(0, 4)), (byYear.get(Number(r.ex_date.slice(0, 4))) ?? 0) + r.amount);
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

  // Yield at each ex-date over five years: the annualised payment over that day's close.
  const fiveYearsAgo = addDays(TODAY_KEY, -365 * 5);
  const closeOn = (date: string) => {
    let lo = 0;
    let hi = c.bars.length - 1;
    let found: DailyBarTD | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (c.bars[mid].date <= date) {
        found = c.bars[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found && found.date > addDays(date, -7) ? found.close : null;
  };
  const yields = paid
    .filter((r) => r.ex_date >= fiveYearsAgo)
    .map((r) => {
      const close = closeOn(r.ex_date);
      return close ? (r.amount * ppy) / close : null;
    })
    .filter((y): y is number => y !== null && y > 0)
    .sort((a, b) => a - b);
  if (yields.length < 8) return null;
  const p80 = yields[Math.min(yields.length - 1, Math.floor(0.8 * (yields.length - 1)))];

  return {
    forwardAnnual,
    paymentsPerYear: ppy,
    yieldNow: forwardAnnual / c.price,
    yieldP80: p80,
    growthYears,
    growthYearsCapped,
    recentCut: !!yearAgo && latest.amount < yearAgo.amount,
    fcfPayout,
    buyZonePrice: forwardAnnual / p80,
  };
}

/* --------------------------------- build --------------------------------- */

/** Rules that need data costing Twelve Data credits (or the sector, for the bank exemption). Checked last, on survivors only. */
const PAID_RULES = new Set(["leverage", "balance-sheet", "no-big-miss", "beat-eps-revenue-up", "growth-record", "no-cut", "covered", "min-yield", "zone-pending"]);
const freeRulesOf = (def: ScreenDefinition): ScreenDefinition => ({ ...def, rules: def.rules.filter((r) => !PAID_RULES.has(r.id)) });

async function buildStrategy(def: ScreenDefinition, pool0: Candidate[], exclude: Set<string>): Promise<ScreenedStrategy> {
  console.log(`\n=== ${def.slug}`);
  const u = def.universe;
  const inUniverse = pool0.filter((c) => c.marketCap >= u.marketCapMin && (!u.marketCapMax || c.marketCap <= u.marketCapMax) && c.avgVolume >= u.avgVolumeMin);
  const byCandidate = new Map<Snapshot, Candidate>();
  const snapshots: Snapshot[] = inUniverse.map((c) => {
    const s: Snapshot = {
      symbol: c.symbol,
      companyName: c.companyName,
      sector: null,
      marketCap: c.marketCap,
      avgVolume: c.avgVolume,
      price: c.price,
      sma50: c.sma50,
      sma200: c.sma200,
      yearHigh: c.yearHigh,
      yearLow: c.yearLow,
    };
    if (def.needs.rsi) s.rsi = rsi14(c.bars);
    if (def.needs.sma200History) s.sessionsBelow200Of60 = sessionsBelow200(c.bars);
    byCandidate.set(s, c);
    return s;
  });

  // Stage 1: price rules only (no fundamentals or earnings loaded yet, so those rules read n/a and are ignored here).
  const priceOnly = (s: Snapshot) => freeRulesOf(def).rules.every((r) => r.test(s) !== false);
  let survivors = snapshots.filter(priceOnly);
  console.log(`  universe ${inUniverse.length}, pass price rules ${survivors.length}`);

  // Stage 2: free SEC data (fundamentals, earnings releases), then every free rule.
  const needsFacts = def.needs.fundamentals || def.needs.growth || def.needs.incomeHistory || def.needs.dividends || def.needs.earnings;
  const extra = new Map<Snapshot, { fcfPayout: number | null; dividendsPaid: number | null }>();
  await pool(survivors, 8, async (s) => {
    const c = byCandidate.get(s)!;
    // Earnings: only companies with a release in the window need their filings.
    const release = def.needs.earnings
      ? (await submissions(c.cik))?.earningsReleases.find((r) => r.date >= addDays(TODAY_KEY, -EARNINGS_WINDOW_DAYS)) ?? null
      : null;
    if (def.needs.earnings && !release) {
      s.earnings = null;
      return;
    }
    const facts = needsFacts ? await companyFacts(c.cik) : null;
    if (facts && (def.needs.fundamentals || def.needs.growth || def.needs.incomeHistory || def.needs.dividends)) {
      const f = fundamentalsFromFacts(facts, c.marketCap, TODAY);
      s.fundamentals = Object.fromEntries(FUNDAMENTAL_KEYS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]])) as Fundamentals;
      extra.set(s, { fcfPayout: f.fcfPayoutLatestYear ?? null, dividendsPaid: f.dividendsPaidTtm ?? null });
    }
    if (release) s.earnings = earningsReaction(c.bars, release.date, facts ? quarterlyRevenue(facts, addDays(release.date, 1)) : null);
  });
  survivors = survivors.filter((s) => evaluateScreen(freeRulesOf(def), s).qualifies);
  // Dividend payers only, with a loose yield floor from filed dividends so the paid lookups stay few.
  if (u.requiresDividend) survivors = survivors.filter((s) => (extra.get(s)?.dividendsPaid ?? 0) / s.marketCap >= 0.012);
  console.log(`  pass every free rule ${survivors.length}`);

  // Stage 3: paid data for the survivors, then the full screen.
  await pool(survivors, 4, async (s) => {
    const c = byCandidate.get(s)!;
    s.sector = await sector(s.symbol);
    if (def.needs.lastQuarter) s.lastQuarterEpsSurprise = await lastQuarterSurprise(s.symbol);
    if (def.needs.earnings && s.earnings) {
      const row = (await earningsRows(s.symbol)).find((r) => Math.abs(Date.parse(r.date) - Date.parse(s.earnings!.date)) <= 4 * 86_400_000);
      s.earnings.epsActual = row ? n(row.eps_actual) : null;
      s.earnings.epsEstimated = row ? n(row.eps_estimate) : null;
    }
    if (def.needs.dividends) s.dividend = await dividendSnapshot(c, extra.get(s)?.fcfPayout ?? null);
  });

  const qualified = survivors.filter((s) => evaluateScreen(def, s).qualifies && def.trigger(s) && !exclude.has(s.symbol) && !exclude.has(companyKey(s.companyName)));
  qualified.sort((a, b) => def.rank(b) - def.rank(a));
  // One line per company: drop a second share class of a name already ranked higher.
  const seenCompanies = new Set<string>();
  const deduped = qualified.filter((s) => {
    const key = companyKey(s.companyName);
    if (seenCompanies.has(key)) return false;
    seenCompanies.add(key);
    return true;
  });
  const picked = def.select ? def.select(deduped, def.pick) : deduped.slice(0, def.pick);
  console.log(`  qualified ${qualified.length}, picked ${picked.map((s) => s.symbol).join(" ")}`);
  if (picked.length < def.pick) console.warn(`  ! only ${picked.length} of ${def.pick} names qualified`);

  return {
    refreshedAt: new Date().toISOString(),
    universeSize: inUniverse.length,
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
  console.log(`cache: ${CACHE_DIR}, budget ${CREDITS_PER_MIN} credits/min`);
  const existing: ScreenedFile = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { generatedAt: "", strategies: {} };
  const pool0 = await candidates();

  // A company appears in one list only: lists built earlier in catalog order take precedence,
  // so a user who activates several strategies never gets the same alert twice.
  const chosen = new Set<string>();
  for (const slug of SCREENED_SLUGS) {
    if (!only.includes(slug)) existing.strategies[slug]?.constituents.forEach((c) => { chosen.add(c.ticker); chosen.add(companyKey(c.companyName)); });
  }
  for (const slug of SCREENED_SLUGS) {
    if (!only.includes(slug)) continue;
    const result = await buildStrategy(SCREENS[slug], pool0, chosen);
    result.constituents.forEach((c) => { chosen.add(c.ticker); chosen.add(companyKey(c.companyName)); });
    existing.strategies[slug] = result;
  }
  existing.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + "\n");
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)}; ${creditsUsed} Twelve Data credits`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
