/**
 * Daily scan for the event-driven strategies. Idempotent by construction:
 * source rows are keyed by their dedupKey, signals by signalKey, deliveries by
 * signal + user, and a symbol gets at most one signal per cooldown window.
 *
 *   GET /api/strategies/scan?strategy=insider|analyst|all&dryRun=1
 */
import type { PrismaClient, StrategySignal } from "@prisma/client";
import { fetchFmpDailyBars, fetchFmpGrades, fetchFmpGradesLatest, fetchFmpInsiderPurchases, fetchFmpQuote } from "@/lib/api/fmp";
import { getStrategy } from "@/lib/templates/catalog";
import { ANALYST, ANALYST_SLUG, INSIDER, INSIDER_SLUG } from "./config";
import { deliverSignal } from "./deliver";
import { daysAgo, isoDay, type DailyBar, type QuoteSnapshot } from "./market";
import { normalizeInsiderTransaction, type NormalizedInsiderTransaction, type RawInsiderTransaction } from "./insider/normalize";
import { dedupeTransactions, evaluateInsiderSymbol, groupBySymbol, isQualifyingPurchase, type InsiderEvaluation } from "./insider/evaluate";
import { normalizeAnalystAction, firmKey, type NormalizedAnalystAction, type RawAnalystAction } from "./analyst/normalize";
import { buildCluster, evaluateAnalystSymbol, type AnalystEvaluation } from "./analyst/evaluate";

export type StrategyKey = "insider" | "analyst";

export interface ScanOptions {
  db: PrismaClient;
  now?: Date;
  /** Evaluate and report only: no source rows, no signals, no emails, no run record. */
  dryRun?: boolean;
  /** Create signals but do not email (default true when not dryRun). */
  deliver?: boolean;
  log?: (message: string) => void;
  /** Cap on cross-market feed pages, a safety valve for runaway pagination. */
  maxPages?: number;
  /** Bounded parallelism for per-symbol quote and bar fetches. */
  concurrency?: number;
}

export interface ScanSummary {
  strategySlug: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  sourceRows: number;
  candidates: number;
  qualified: number;
  signalsCreated: number;
  emailsSent: number;
  created: Array<{ symbol: string; signalKey: string; score: number; confirmation: string }>;
  wouldCreate: Array<{ symbol: string; signalKey: string; score: number; confirmation: string; explanation: string }>;
  skipped: Array<{ symbol: string; reason: string }>;
  rejected: Array<{ symbol: string; reasons: string[] }>;
}

const DEFAULTS = { maxPages: 8, concurrency: 4 };

async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<Array<R | Error>> {
  const out: Array<R | Error> = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx]);
      } catch (err) {
        out[idx] = err instanceof Error ? err : new Error(String(err));
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function quoteSnapshot(symbol: string, now: Date): Promise<QuoteSnapshot | null> {
  const q = await fetchFmpQuote(symbol);
  if (!q || !(q.price > 0)) return null;
  return {
    symbol,
    companyName: q.companyName ?? symbol,
    price: q.price,
    marketCap: q.marketCap ?? 0,
    volume: q.volume ?? 0,
    sma50: typeof q.sma50 === "number" && q.sma50 > 0 ? q.sma50 : null,
    changePercent: q.changePercent ?? 0,
    asOf: now.toISOString(),
  };
}

/** Enough history for a 20-session average plus the strategy window. */
const barsFrom = (now: Date, windowDays: number) => isoDay(daysAgo(windowDays + 45, now));

interface SignalDraft {
  strategySlug: string;
  symbol: string;
  companyName: string;
  signalKey: string;
  score: number;
  price: number;
  confirmation: string;
  explanation: string;
  payload: unknown;
  dataAsOf: Date;
}

type CreateOutcome = { skipped: string; row?: undefined } | { row: StrategySignal; skipped?: undefined };

/** Create the signal unless it exists or the symbol is inside its cooldown. Returns the row or the skip reason. */
async function createSignalIfNew(db: PrismaClient, draft: SignalDraft, cooldownDays: number, now: Date): Promise<CreateOutcome> {
  const existing = await db.strategySignal.findUnique({ where: { signalKey: draft.signalKey }, select: { id: true } });
  if (existing) return { skipped: "already signaled (same event)" };
  const recent = await db.strategySignal.findFirst({
    where: { strategySlug: draft.strategySlug, symbol: draft.symbol, createdAt: { gte: daysAgo(cooldownDays, now) } },
    select: { createdAt: true },
  });
  if (recent) return { skipped: `cooldown: signaled ${Math.floor((now.getTime() - recent.createdAt.getTime()) / 86_400_000)} days ago` };
  try {
    const row = await db.strategySignal.create({ data: { ...draft, payload: draft.payload as never } });
    return { row };
  } catch (err) {
    // Unique violation from a concurrent run: treat as already signaled.
    if ((err as { code?: string }).code === "P2002") return { skipped: "already signaled (concurrent run)" };
    throw err;
  }
}

async function finishRun(db: PrismaClient, runId: string | null, summary: ScanSummary, error?: string) {
  if (!runId) return;
  await db.strategyScanRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      status: error ? "ERROR" : "OK",
      candidates: summary.candidates,
      qualified: summary.qualified,
      signalsCreated: summary.signalsCreated,
      emailsSent: summary.emailsSent,
      error: error ?? null,
    },
  });
}

/* ------------------------------- insider --------------------------------- */

export async function runInsiderScan(opts: ScanOptions): Promise<ScanSummary> {
  const { db, now = new Date(), dryRun = false, deliver = !dryRun, log = () => {}, maxPages = DEFAULTS.maxPages, concurrency = DEFAULTS.concurrency } = opts;
  const strategy = getStrategy(INSIDER_SLUG);
  const summary: ScanSummary = { strategySlug: INSIDER_SLUG, dryRun, startedAt: now.toISOString(), finishedAt: "", sourceRows: 0, candidates: 0, qualified: 0, signalsCreated: 0, emailsSent: 0, created: [], wouldCreate: [], skipped: [], rejected: [] };
  const run = dryRun ? null : await db.strategyScanRun.create({ data: { strategySlug: INSIDER_SLUG, dryRun } });

  try {
    const start = isoDay(daysAgo(INSIDER.lookbackDays, now));
    const raw: NormalizedInsiderTransaction[] = [];
    for (let page = 0; page < maxPages; page++) {
      const rows = (await fetchFmpInsiderPurchases(page)) as RawInsiderTransaction[];
      if (!rows.length) break;
      for (const r of rows) {
        const n = normalizeInsiderTransaction(r);
        if (n) raw.push(n);
      }
      const oldest = rows[rows.length - 1]?.filingDate ?? "";
      if (oldest && oldest < start) break;
    }
    const deduped = dedupeTransactions(raw);
    const qualifying = deduped.filter((t) => isQualifyingPurchase(t, now).ok);
    summary.sourceRows = qualifying.length;
    log(`insider: ${deduped.length} purchases fetched, ${qualifying.length} qualify on their own`);

    if (!dryRun && qualifying.length) {
      await db.insiderTransaction.createMany({
        data: qualifying.map((t) => ({
          symbol: t.symbol,
          dedupKey: t.dedupKey,
          accession: t.accession,
          insiderName: t.insiderName,
          insiderTitle: t.insiderTitle,
          ownerType: t.ownerType,
          isDirector: t.isDirector,
          isOfficer: t.isOfficer,
          isSenior: t.isSenior,
          transactionCode: t.transactionCode,
          acquisitionOrDisposition: t.acquisitionOrDisposition,
          securityName: t.securityName,
          transactionDate: new Date(t.transactionDate + "T00:00:00Z"),
          filingDate: t.filingDate ? new Date(t.filingDate + "T00:00:00Z") : null,
          shares: t.shares,
          price: t.price,
          value: t.value,
          sharesOwnedAfter: t.sharesOwnedAfter,
          filingUrl: t.filingUrl,
          raw: t.raw as never,
        })),
        skipDuplicates: true,
      });
    }

    const bySymbol = groupBySymbol(qualifying);
    summary.candidates = bySymbol.size;
    const evaluations = await mapPool([...bySymbol.entries()], concurrency, async ([symbol, purchases]): Promise<InsiderEvaluation | null> => {
      const quote = await quoteSnapshot(symbol, now);
      if (!quote) return null;
      const earliest = [...purchases].sort((a, b) => (a.transactionDate < b.transactionDate ? -1 : 1))[0].transactionDate;
      const bars: DailyBar[] = await fetchFmpDailyBars(symbol, isoDay(daysAgo(45, new Date(earliest + "T00:00:00Z"))));
      return evaluateInsiderSymbol({ symbol, purchases, quote, bars, now });
    });

    for (const [i, ev] of evaluations.entries()) {
      const symbol = [...bySymbol.keys()][i];
      if (ev instanceof Error) {
        summary.rejected.push({ symbol, reasons: [`fetch failed: ${ev.message}`] });
        log(`insider: ${symbol} fetch failed: ${ev.message}`);
        continue;
      }
      if (!ev) {
        summary.rejected.push({ symbol, reasons: ["no quote"] });
        continue;
      }
      if (!ev.qualifies) {
        summary.rejected.push({ symbol, reasons: ev.reasons });
        continue;
      }
      summary.qualified++;
      const draft: SignalDraft = { strategySlug: INSIDER_SLUG, symbol, companyName: ev.payload.companyName, signalKey: ev.signalKey, score: ev.score, price: ev.price, confirmation: ev.confirmation!, explanation: ev.explanation, payload: ev.payload, dataAsOf: now };
      if (dryRun) {
        const exists = await db.strategySignal.findUnique({ where: { signalKey: ev.signalKey }, select: { id: true } }).catch(() => null);
        if (exists) summary.skipped.push({ symbol, reason: "already signaled (same event)" });
        else summary.wouldCreate.push({ symbol, signalKey: ev.signalKey, score: ev.score, confirmation: ev.confirmation!, explanation: ev.explanation });
        continue;
      }
      const res = await createSignalIfNew(db, draft, INSIDER.cooldownDays, now);
      if (res.skipped !== undefined) {
        summary.skipped.push({ symbol, reason: res.skipped });
        continue;
      }
      summary.signalsCreated++;
      summary.created.push({ symbol, signalKey: ev.signalKey, score: ev.score, confirmation: ev.confirmation! });
      if (deliver) {
        const d = await deliverSignal(db, { ...res.row, payload: res.row.payload }, strategy?.name ?? "Insider Purchase Confirmation", log);
        summary.emailsSent += d.sent;
      }
    }
    summary.finishedAt = new Date().toISOString();
    await finishRun(db, run?.id ?? null, summary);
    return summary;
  } catch (err) {
    summary.finishedAt = new Date().toISOString();
    await finishRun(db, run?.id ?? null, summary, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/* ------------------------------- analyst --------------------------------- */

export async function runAnalystScan(opts: ScanOptions): Promise<ScanSummary> {
  const { db, now = new Date(), dryRun = false, deliver = !dryRun, log = () => {}, maxPages = DEFAULTS.maxPages, concurrency = DEFAULTS.concurrency } = opts;
  const strategy = getStrategy(ANALYST_SLUG);
  const summary: ScanSummary = { strategySlug: ANALYST_SLUG, dryRun, startedAt: now.toISOString(), finishedAt: "", sourceRows: 0, candidates: 0, qualified: 0, signalsCreated: 0, emailsSent: 0, created: [], wouldCreate: [], skipped: [], rejected: [] };
  const run = dryRun ? null : await db.strategyScanRun.create({ data: { strategySlug: ANALYST_SLUG, dryRun } });

  try {
    const start = isoDay(daysAgo(ANALYST.lookbackDays, now));
    const feed: NormalizedAnalystAction[] = [];
    for (let page = 0; page < maxPages; page++) {
      const rows = (await fetchFmpGradesLatest(page)) as RawAnalystAction[];
      if (!rows.length) break;
      for (const r of rows) {
        const n = normalizeAnalystAction(r);
        if (n) feed.push(n);
      }
      const oldest = String(rows[rows.length - 1]?.publishedDate ?? "").slice(0, 10);
      if (oldest && oldest < start) break;
    }

    // Candidates: symbols with positive actions from at least two firms in the feed.
    const positiveFirms = new Map<string, Set<string>>();
    for (const a of feed) {
      if (a.actionDate < start || !a.isPositiveAction) continue;
      if (!positiveFirms.has(a.symbol)) positiveFirms.set(a.symbol, new Set());
      positiveFirms.get(a.symbol)!.add(firmKey(a));
    }
    const candidates = [...positiveFirms.entries()].filter(([, firms]) => firms.size >= ANALYST.minFirms).map(([s]) => s);
    summary.candidates = candidates.length;
    log(`analyst: ${feed.length} feed rows, ${candidates.length} symbols with ${ANALYST.minFirms}+ positive firms`);

    const evaluations = await mapPool(candidates, concurrency, async (symbol): Promise<{ ev: AnalystEvaluation; actions: NormalizedAnalystAction[] } | null> => {
      // The per-symbol history is authoritative; the feed rows fill any gaps.
      const history = ((await fetchFmpGrades(symbol)) as RawAnalystAction[]).map(normalizeAnalystAction).filter((a): a is NormalizedAnalystAction => !!a);
      const actions = [...history, ...feed.filter((a) => a.symbol === symbol)].filter((a) => a.actionDate >= start);
      const cluster = buildCluster(symbol, actions, now);
      const quote = await quoteSnapshot(symbol, now);
      if (!quote) return null;
      const bars = await fetchFmpDailyBars(symbol, barsFrom(now, ANALYST.lookbackDays));
      return { ev: evaluateAnalystSymbol({ cluster, quote, bars, now }), actions };
    });

    for (const [i, result] of evaluations.entries()) {
      const symbol = candidates[i];
      if (result instanceof Error) {
        summary.rejected.push({ symbol, reasons: [`fetch failed: ${result.message}`] });
        log(`analyst: ${symbol} fetch failed: ${result.message}`);
        continue;
      }
      if (!result) {
        summary.rejected.push({ symbol, reasons: ["no quote"] });
        continue;
      }
      const { ev, actions } = result;
      if (!dryRun && actions.length) {
        const seen = new Set<string>();
        const rows = actions.filter((a) => (seen.has(a.dedupKey) ? false : (seen.add(a.dedupKey), true)));
        summary.sourceRows += rows.length;
        await db.analystAction.createMany({
          data: rows.map((a) => ({
            symbol: a.symbol,
            dedupKey: a.dedupKey,
            firm: a.firm,
            actionDate: new Date(a.actionDate + "T00:00:00Z"),
            previousGrade: a.previousGrade,
            newGrade: a.newGrade,
            action: a.action,
            previousTier: a.previousTier,
            newTier: a.newTier,
            direction: a.direction,
            isTrueUpgrade: a.isTrueUpgrade,
            sourceUrl: a.sourceUrl,
            raw: a.raw as never,
          })),
          skipDuplicates: true,
        });
      }
      if (!ev.qualifies) {
        summary.rejected.push({ symbol, reasons: ev.reasons });
        continue;
      }
      summary.qualified++;
      const draft: SignalDraft = { strategySlug: ANALYST_SLUG, symbol, companyName: ev.payload.companyName, signalKey: ev.signalKey, score: ev.score, price: ev.price, confirmation: ev.confirmation!, explanation: ev.explanation, payload: ev.payload, dataAsOf: now };
      if (dryRun) {
        const exists = await db.strategySignal.findUnique({ where: { signalKey: ev.signalKey }, select: { id: true } }).catch(() => null);
        if (exists) summary.skipped.push({ symbol, reason: "already signaled (same event)" });
        else summary.wouldCreate.push({ symbol, signalKey: ev.signalKey, score: ev.score, confirmation: ev.confirmation!, explanation: ev.explanation });
        continue;
      }
      const res = await createSignalIfNew(db, draft, ANALYST.cooldownDays, now);
      if (res.skipped !== undefined) {
        summary.skipped.push({ symbol, reason: res.skipped });
        continue;
      }
      summary.signalsCreated++;
      summary.created.push({ symbol, signalKey: ev.signalKey, score: ev.score, confirmation: ev.confirmation! });
      if (deliver) {
        const d = await deliverSignal(db, { ...res.row, payload: res.row.payload }, strategy?.name ?? "Analyst Upgrade Clusters", log);
        summary.emailsSent += d.sent;
      }
    }
    summary.finishedAt = new Date().toISOString();
    await finishRun(db, run?.id ?? null, summary);
    return summary;
  } catch (err) {
    summary.finishedAt = new Date().toISOString();
    await finishRun(db, run?.id ?? null, summary, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function runScans(keys: StrategyKey[], opts: ScanOptions): Promise<ScanSummary[]> {
  const out: ScanSummary[] = [];
  for (const key of keys) out.push(key === "insider" ? await runInsiderScan(opts) : await runAnalystScan(opts));
  return out;
}

export { createSignalIfNew, type SignalDraft };
