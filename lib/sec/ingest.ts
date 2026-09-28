/**
 * EDGAR insider ingest. Reads each business day's Form 4 filings from the daily
 * index, parses every filing, and stores the open-market purchases, so the
 * insider scan has a market-wide "latest purchases" feed without a vendor.
 *
 * Runs are time-boxed and resumable: processed accessions are recorded, a day
 * is marked complete once all its filings are read, and the next run picks up
 * where the last one stopped. A day's index is published the evening of that
 * day, so purchases reach the scan with about a one-day lag.
 */
import type { PrismaClient } from "@prisma/client";
import { fetchForm4Index, fetchSubmission, EdgarError } from "./edgar";
import { extractOwnershipXml, parseForm4Xml, purchasesFromForm4 } from "./form4";

export interface IngestOptions {
  db: PrismaClient;
  now?: Date;
  /** Stop starting new filings after this long; the next run resumes. */
  budgetMs?: number;
  /** Calendar days of index to keep complete (covers the 30-day scan window plus filing lag). */
  lookbackDays?: number;
  /** Filings older than this are pruned. */
  retainDays?: number;
  concurrency?: number;
  log?: (m: string) => void;
}

export interface IngestSummary {
  daysChecked: string[];
  daysCompleted: string[];
  daysUnpublished: string[];
  filingsRead: number;
  purchasesFound: number;
  fetchErrors: number;
  remainingInProgressDay: number;
  outOfTime: boolean;
  ms: number;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Weekdays from `lookbackDays` ago through today (UTC dates), newest first. */
export function businessDaysBack(now: Date, lookbackDays: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= lookbackDays; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(ymd(d));
  }
  return out;
}

export async function ingestInsiderFilings(opts: IngestOptions): Promise<IngestSummary> {
  const { db, now = new Date(), budgetMs = 240_000, lookbackDays = 35, retainDays = 90, concurrency = 4, log = () => {} } = opts;
  const started = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - started);
  const summary: IngestSummary = { daysChecked: [], daysCompleted: [], daysUnpublished: [], filingsRead: 0, purchasesFound: 0, fetchErrors: 0, remainingInProgressDay: 0, outOfTime: false, ms: 0 };

  const days = businessDaysBack(now, lookbackDays);
  const done = new Set((await db.secIndexDay.findMany({ where: { date: { in: days } }, select: { date: true } })).map((d) => d.date));
  const today = ymd(now);

  for (const day of days) {
    if (done.has(day)) continue;
    if (timeLeft() <= 0) {
      summary.outOfTime = true;
      break;
    }
    summary.daysChecked.push(day);
    const entries = await fetchForm4Index(day);
    if (entries === null) {
      // Not published yet (today, or tonight's file not out), or a market holiday.
      // Older than two days and still missing means a holiday: mark it done.
      const ageDays = (Date.parse(today) - Date.parse(day)) / 86_400_000;
      if (ageDays > 2) {
        await db.secIndexDay.upsert({ where: { date: day }, create: { date: day, filings: 0 }, update: {} });
        summary.daysCompleted.push(day);
      } else summary.daysUnpublished.push(day);
      continue;
    }

    const seen = new Set(
      (await db.secForm4Filing.findMany({ where: { accession: { in: entries.map((e) => e.accession) } }, select: { accession: true } })).map((f) => f.accession)
    );
    const todo = entries.filter((e) => !seen.has(e.accession));
    let dayErrors = 0;
    let next = 0;

    const worker = async () => {
      while (next < todo.length && timeLeft() > 0) {
        const entry = todo[next++];
        let text: string;
        try {
          text = await fetchSubmission(entry.fileName);
        } catch (err) {
          dayErrors++;
          summary.fetchErrors++;
          log(`fetch failed ${entry.accession}: ${err instanceof EdgarError ? err.message : String(err)}`);
          continue; // not recorded, so the next run retries it
        }
        const xml = extractOwnershipXml(text);
        if (!xml) {
          await db.secForm4Filing.upsert({ where: { accession: entry.accession }, create: { accession: entry.accession, filedDate: new Date(`${entry.dateFiled}T00:00:00Z`), error: "no ownership XML" }, update: {} });
          summary.filingsRead++;
          continue;
        }
        const doc = parseForm4Xml(xml);
        const purchases = purchasesFromForm4(doc, { accession: entry.accession, filingDate: entry.dateFiled, formType: entry.formType });
        if (purchases.length) {
          await db.secInsiderPurchase.createMany({
            data: purchases.map(({ seq, ...raw }) => ({
              accession: entry.accession,
              seq,
              symbol: raw.symbol!,
              filingDate: new Date(`${entry.dateFiled}T00:00:00Z`),
              transactionDate: new Date(`${raw.transactionDate}T00:00:00Z`),
              raw: raw as never,
            })),
            skipDuplicates: true,
          });
        }
        // Purchases first, filing marker second: a crash in between only causes a harmless re-read.
        await db.secForm4Filing.upsert({
          where: { accession: entry.accession },
          create: { accession: entry.accession, filedDate: new Date(`${entry.dateFiled}T00:00:00Z`), issuerCik: doc.issuerCik, symbol: doc.symbol, purchases: purchases.length },
          update: {},
        });
        summary.filingsRead++;
        summary.purchasesFound += purchases.length;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, todo.length)) }, worker));

    const unfinished = todo.length - next + dayErrors;
    if (next >= todo.length && dayErrors === 0) {
      await db.secIndexDay.upsert({ where: { date: day }, create: { date: day, filings: entries.length }, update: { filings: entries.length } });
      summary.daysCompleted.push(day);
      log(`${day}: complete, ${entries.length} Form 4 filings`);
    } else {
      summary.remainingInProgressDay = unfinished;
      summary.outOfTime = timeLeft() <= 0;
      log(`${day}: ${unfinished} filings left for the next run`);
      if (summary.outOfTime) break;
    }
  }

  // Keep the tables small: the scan only looks back 30 days.
  const cutoff = new Date(now.getTime() - retainDays * 86_400_000);
  await db.secInsiderPurchase.deleteMany({ where: { filingDate: { lt: cutoff } } });
  await db.secForm4Filing.deleteMany({ where: { filedDate: { lt: cutoff } } });
  await db.secIndexDay.deleteMany({ where: { date: { lt: ymd(cutoff) } } });

  summary.ms = Date.now() - started;
  return summary;
}
