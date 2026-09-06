/**
 * The numbers and headlines each issue is written from. The code gathers and
 * filters; the model only writes. Every source is optional: a failed feed
 * leaves a section out and the prompt says so.
 */
import {
  fetchFmpBatchQuotes,
  fetchFmpEarningsCalendar,
  fetchFmpEconomicCalendar,
  fetchFmpGradesNews,
  fetchFmpLatestStockNews,
  fetchFmpMovers,
  fetchFmpSectorSnapshot,
  fetchFmpTreasuryRates,
  type FmpEconomicEvent,
  type FmpGradeNews,
  type FmpMarketNewsItem,
  type FmpMover,
  type FmpProfileLite,
  type FmpSectorChange,
  type FmpTreasuryDay,
} from "@/lib/api/fmp";
import { NEWSLETTER, type IssueKind } from "./config";
import { longDate, shiftDateKey, type DateKey } from "./dates";
import { dropNonStocks, groupCandidates, renderNewsBlock, type Candidate } from "./topics";

export interface QuoteLine {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: number;
}

export interface IssueFacts {
  kind: IssueKind;
  dateKey: DateKey;
  /** Sections that could not be loaded, named for the prompt and the report. */
  missing: string[];
  economic: FmpEconomicEvent[];
  earnings: QuoteLine[];
  grades: FmpGradeNews[];
  news: Candidate[];
  treasury: { today: FmpTreasuryDay | null; previous: FmpTreasuryDay | null };
  /** Closing recap: index ETFs as proxies plus large-cap movers and sector moves. */
  indexes: QuoteLine[];
  gainers: QuoteLine[];
  losers: QuoteLine[];
  actives: QuoteLine[];
  sectors: FmpSectorChange[];
}

export interface FactsDeps {
  now?: Date;
  news?: () => Promise<FmpMarketNewsItem[]>;
  profile?: (t: string) => Promise<FmpProfileLite | null>;
  quotes?: (tickers: string[]) => Promise<QuoteLine[]>;
  economic?: (from: string, to: string) => Promise<FmpEconomicEvent[]>;
  earnings?: (from: string, to: string) => Promise<{ symbol: string }[]>;
  grades?: () => Promise<FmpGradeNews[]>;
  movers?: (kind: "biggest-gainers" | "biggest-losers" | "most-actives") => Promise<FmpMover[]>;
  treasury?: (from: string, to: string) => Promise<FmpTreasuryDay[]>;
  sectors?: (date: string) => Promise<FmpSectorChange[]>;
}

/** The index proxies the recap quotes when the writer cannot confirm the official closes. */
export const INDEX_PROXIES: Record<string, string> = { SPY: "S&P 500 (SPY)", QQQ: "Nasdaq-100 (QQQ)", DIA: "Dow (DIA)", IWM: "Russell 2000 (IWM)" };

const US_HIGH_IMPACT = (e: FmpEconomicEvent) => e.country === "US" && /high|medium/i.test(e.impact);

async function defaultQuotes(tickers: string[]): Promise<QuoteLine[]> {
  if (!tickers.length) return [];
  const rows = (await fetchFmpBatchQuotes(tickers)) as Array<{ ticker: string; companyName: string; price: number; changePercent: number; marketCap: number }>;
  return rows.map((q) => ({ symbol: q.ticker, name: q.companyName, price: q.price, changePercent: q.changePercent, marketCap: q.marketCap }));
}

async function defaultNews(): Promise<FmpMarketNewsItem[]> {
  const pages = await Promise.all(Array.from({ length: NEWSLETTER.newsFetchPages }, (_, i) => fetchFmpLatestStockNews(NEWSLETTER.newsFetchLimit, i).catch(() => [] as FmpMarketNewsItem[])));
  return pages.flat();
}

const attempt = async <T,>(label: string, missing: string[], fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[newsletter] ${label} unavailable:`, err instanceof Error ? err.message : err);
    missing.push(label);
    return fallback;
  }
};

/** Everything the morning brief or the closing recap is written from. */
export async function gatherFacts(kind: IssueKind, dateKey: DateKey, deps: FactsDeps = {}): Promise<IssueFacts> {
  const now = deps.now ?? new Date();
  const missing: string[] = [];
  const quotes = deps.quotes ?? defaultQuotes;
  const yesterday = shiftDateKey(dateKey, -1);

  const [newsRows, economic, earningsRows, grades, treasuryRows] = await Promise.all([
    attempt("news feed", missing, () => (deps.news ?? defaultNews)(), [] as FmpMarketNewsItem[]),
    attempt("economic calendar", missing, () => (deps.economic ?? fetchFmpEconomicCalendar)(kind === "morning" ? dateKey : dateKey, dateKey), [] as FmpEconomicEvent[]),
    kind === "morning" ? attempt("earnings calendar", missing, () => (deps.earnings ?? fetchFmpEarningsCalendar)(dateKey, dateKey), [] as { symbol: string }[]) : Promise.resolve([] as { symbol: string }[]),
    attempt("analyst grades", missing, () => (deps.grades ?? fetchFmpGradesNews)(), [] as FmpGradeNews[]),
    attempt("treasury rates", missing, () => (deps.treasury ?? fetchFmpTreasuryRates)(shiftDateKey(dateKey, -5), dateKey), [] as FmpTreasuryDay[]),
  ]);

  const lookback = NEWSLETTER[kind].newsLookbackHours;
  const grouped = groupCandidates(newsRows, { now, lookbackHours: lookback, exclude: new Set(), limit: NEWSLETTER.newsTickerLimit + 8 });
  const news = (await dropNonStocks(grouped, deps.profile)).kept.slice(0, NEWSLETTER.newsTickerLimit);

  // Earnings today: only names big enough to matter, ranked by size.
  const earningsSymbols = [...new Set(earningsRows.map((r) => r.symbol).filter((s) => /^[A-Z]{1,5}$/.test(s)))].slice(0, 120);
  const earnings = (await attempt("earnings quotes", missing, () => quotes(earningsSymbols), [] as QuoteLine[]))
    .filter((q) => q.marketCap >= NEWSLETTER.minMarketCap)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 12);

  // Analyst moves from the last day, US-listed tickers only.
  const sinceGrades = now.getTime() - 26 * 3_600_000;
  const recentGrades = grades.filter((g) => /^[A-Z]{1,5}$/.test(g.symbol) && new Date(g.publishedDate).getTime() >= sinceGrades).slice(0, 40);
  const gradeQuotes = await attempt("grade quotes", missing, () => quotes([...new Set(recentGrades.map((g) => g.symbol))].slice(0, 60)), [] as QuoteLine[]);
  const bigCaps = new Set(gradeQuotes.filter((q) => q.marketCap >= NEWSLETTER.minMarketCap).map((q) => q.symbol));
  const gradesFiltered = recentGrades.filter((g) => bigCaps.has(g.symbol)).slice(0, 18);

  const facts: IssueFacts = {
    kind,
    dateKey,
    missing,
    economic: economic.filter(US_HIGH_IMPACT).slice(0, 12),
    earnings,
    grades: gradesFiltered,
    news,
    treasury: {
      today: treasuryRows.find((t) => t.date === dateKey) ?? treasuryRows[0] ?? null,
      previous: treasuryRows.find((t) => t.date < dateKey && t.date !== (treasuryRows.find((x) => x.date === dateKey)?.date ?? "")) ?? treasuryRows[1] ?? null,
    },
    indexes: [],
    gainers: [],
    losers: [],
    actives: [],
    sectors: [],
  };

  if (kind === "closing") {
    const movers = deps.movers ?? fetchFmpMovers;
    const [indexes, gainersRaw, losersRaw, activesRaw, sectors] = await Promise.all([
      attempt("index quotes", missing, () => quotes(Object.keys(INDEX_PROXIES)), [] as QuoteLine[]),
      attempt("gainers", missing, () => movers("biggest-gainers"), [] as FmpMover[]),
      attempt("losers", missing, () => movers("biggest-losers"), [] as FmpMover[]),
      attempt("most actives", missing, () => movers("most-actives"), [] as FmpMover[]),
      attempt("sector performance", missing, () => (deps.sectors ?? fetchFmpSectorSnapshot)(dateKey), [] as FmpSectorChange[]),
    ]);
    const moverSymbols = [...new Set([...gainersRaw, ...losersRaw, ...activesRaw].map((m) => m.symbol).filter((s) => /^[A-Z]{1,5}$/.test(s)))].slice(0, 120);
    const moverQuotes = await attempt("mover quotes", missing, () => quotes(moverSymbols), [] as QuoteLine[]);
    const big = new Map(moverQuotes.filter((q) => q.marketCap >= NEWSLETTER.minMarketCap).map((q) => [q.symbol, q]));
    const pick = (list: FmpMover[], n: number) => list.filter((m) => big.has(m.symbol)).slice(0, n).map((m) => ({ ...big.get(m.symbol)!, changePercent: m.changePercent }));
    facts.indexes = indexes.map((q) => ({ ...q, name: INDEX_PROXIES[q.symbol] ?? q.name }));
    facts.gainers = pick(gainersRaw, 8);
    facts.losers = pick(losersRaw, 8);
    facts.actives = pick(activesRaw, 8);
    facts.sectors = sectors.filter((s) => s.exchange === "NASDAQ" || s.exchange === "NYSE").slice(0, 22);
    void yesterday;
  }
  return facts;
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const cap = (v: number) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B` : `$${(v / 1e6).toFixed(0)}M`);
const num = (v: number | null, unit = "") => (v === null ? "n/a" : `${v}${unit}`);

/** Facts as prompt text. Sections appear only when there is data for them. */
export function renderFacts(f: IssueFacts): string {
  const lines: string[] = [];
  lines.push(`Date: ${longDate(f.dateKey)} (${f.dateKey}).`);
  if (f.missing.length) lines.push(`Data feeds that did not load this run: ${f.missing.join(", ")}. Use web search to fill these in.`);

  if (f.kind === "closing") {
    if (f.indexes.length) {
      lines.push("", "Index proxies at the close (ETFs; confirm the official index closes with web search):");
      for (const q of f.indexes) lines.push(`- ${q.name}: ${pct(q.changePercent)} to $${q.price.toFixed(2)}`);
    }
    if (f.sectors.length) {
      lines.push("", "Sector performance today (average change):");
      for (const s of [...f.sectors].sort((a, b) => b.averageChange - a.averageChange)) lines.push(`- ${s.sector} (${s.exchange}): ${pct(s.averageChange)}`);
    }
    const movers = (label: string, list: QuoteLine[]) => {
      if (!list.length) return;
      lines.push("", `${label} (market cap $2B+):`);
      for (const q of list) lines.push(`- ${q.symbol} ${q.name}: ${pct(q.changePercent)} to $${q.price.toFixed(2)} (${cap(q.marketCap)})`);
    };
    movers("Biggest gainers", f.gainers);
    movers("Biggest losers", f.losers);
    movers("Most active", f.actives);
  }

  if (f.treasury.today) {
    const t = f.treasury.today;
    const p = f.treasury.previous;
    const delta = (a: number | null, b: number | null) => (a !== null && b !== null ? ` (${a - b >= 0 ? "+" : ""}${((a - b) * 100).toFixed(0)} bps vs ${p?.date})` : "");
    lines.push("", `Treasury yields (${t.date}): 2-year ${num(t.year2, "%")}${delta(t.year2, p?.year2 ?? null)}, 10-year ${num(t.year10, "%")}${delta(t.year10, p?.year10 ?? null)}, 30-year ${num(t.year30, "%")}${delta(t.year30, p?.year30 ?? null)}`);
  }

  if (f.economic.length) {
    lines.push("", f.kind === "morning" ? "US economic releases scheduled today (times UTC):" : "US economic releases today (times UTC):");
    for (const e of f.economic) lines.push(`- ${e.date.slice(11, 16)} ${e.event} [${e.impact}]: previous ${num(e.previous, e.unit)}, estimate ${num(e.estimate, e.unit)}${e.actual !== null ? `, actual ${num(e.actual, e.unit)}` : ""}`);
  }

  if (f.earnings.length) {
    lines.push("", "Companies reporting earnings today ($2B+):");
    for (const q of f.earnings) lines.push(`- ${q.symbol} ${q.name} (${cap(q.marketCap)})`);
  }

  if (f.grades.length) {
    lines.push("", "Analyst moves in the last day ($2B+ names):");
    for (const g of f.grades) lines.push(`- ${g.symbol} ${g.publishedDate.slice(0, 16)} ${g.gradingCompany}: ${g.title}${g.url ? ` ${g.url}` : ""}`);
  }

  if (f.news.length) {
    lines.push("", f.kind === "morning" ? "Stocks in the news since yesterday's close (headlines newest first, tagged by source type):" : "Stocks in the news today (headlines, tagged by source type):");
    lines.push(...renderNewsBlock(f.news));
  }
  return lines.join("\n");
}
