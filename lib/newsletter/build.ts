/**
 * One run = one or both of the day's issues: gather the facts, have Claude
 * write the brief or the recap, attach yesterday's Smart Investor ads, create
 * the Beehiiv draft, and record everything in NewsletterIssue. Every path
 * leaves the row in a final state.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { fetchFmpNyseHolidays } from "@/lib/api/fmp";
import { beehiivEditUrl, createPost, type CreatePostBody } from "@/lib/beehiiv/client";
import { publicationByKey } from "@/lib/beehiiv/config";
import { getSetting } from "@/lib/settings";
import { claudeIssueWriter, numberedItems, writeIssue, type IssueWriter } from "./article";
import { KIND_LABEL, KIND_WINDOW_ET, NEWSLETTER, NEWSLETTER_PAUSED_KEY, SLOT_KIND, type IssueKind, type Slot } from "./config";
import { dateKeyWeekday, easternMinutes, longDate, pacificDateKey, shiftDateKey, type DateKey } from "./dates";
import { gatherFacts, renderFacts, type FactsDeps, type IssueFacts } from "./facts";
import { buildCreatePostBody, type RenderMode } from "./render";
import { advertiserLabel, fetchTsiAdsFor, type TsiAdsResult } from "./tsiAds";
import { costUsd, EMPTY_USAGE, type ModelUsage } from "./usage";

export type IssueStatus = "pending" | "drafted" | "needs_review" | "failed" | "skipped";

export interface BuildDeps {
  db: PrismaClient;
  /** Injected in tests; also passed through to Beehiiv calls. */
  fetchImpl?: typeof fetch;
  writer?: IssueWriter;
  facts?: (kind: IssueKind, dateKey: DateKey) => Promise<IssueFacts>;
  factsDeps?: FactsDeps;
  tsiAds?: (dateKey: DateKey) => Promise<TsiAdsResult>;
  holidays?: () => Promise<string[]>;
  now?: Date;
  log?: (m: string) => void;
  /** Run everything except the Beehiiv write and the NewsletterIssue rows. */
  dry?: boolean;
  renderMode?: RenderMode;
}

export interface SlotResult {
  slot: Slot;
  kind: IssueKind;
  status: IssueStatus;
  skipped?: boolean;
  headline?: string;
  subjectLine?: string;
  beehiivPostId?: string;
  beehiivPostUrl?: string;
  adsFound: number;
  tsiPostTitle?: string;
  tsiAdvertisers?: string;
  reviewReason?: string;
  error?: string;
  /** Why a slot was not built this run (outside its window, holiday, already drafted). */
  note?: string;
  costUsd: number;
  /** Set on dry runs so the caller can write preview files. */
  body?: CreatePostBody;
}

export interface BuildResult {
  dateKey: DateKey;
  tsiDateKey: DateKey;
  paused: boolean;
  slots: SlotResult[];
  warnings: string[];
  totalCostUsd: number;
  ms: number;
}

export interface BuildOptions {
  dateKey?: DateKey;
  slots?: Slot[];
  /** Rebuild slots that already have a draft and ignore the time window and holiday check. */
  force?: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** A pending row younger than this belongs to a run that is still going (the function limit is 800s with Fluid compute). */
export const IN_PROGRESS_MS = 14 * 60_000;

/** Why the slot's kind cannot be built right now, or null when it can. */
export function windowReason(kind: IssueKind, now: Date, holidays: Set<string>, dateKey: DateKey): string | null {
  const wd = dateKeyWeekday(dateKey);
  if (wd === 0 || wd === 6) return "markets are closed on weekends";
  if (holidays.has(dateKey)) return "NYSE holiday";
  const minutes = easternMinutes(now);
  const w = KIND_WINDOW_ET[kind];
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  if (minutes < w.from) return `${KIND_LABEL[kind]} builds from ${hhmm(w.from)} ET; it is ${hhmm(minutes)} ET`;
  if (minutes > w.to) return `${KIND_LABEL[kind]} window closed at ${hhmm(w.to)} ET`;
  return null;
}

export async function buildDailyIssues(opts: BuildOptions, deps: BuildDeps): Promise<BuildResult> {
  const started = Date.now();
  const now = deps.now ?? new Date();
  const log = deps.log ?? (() => {});
  const dateKey = opts.dateKey ?? pacificDateKey(now);
  const tsiDateKey = shiftDateKey(dateKey, -1);
  const requested = opts.slots ?? [...NEWSLETTER.slots];
  const warnings: string[] = [];
  const result: BuildResult = { dateKey, tsiDateKey, paused: false, slots: [], warnings, totalCostUsd: 0, ms: 0 };
  const finish = () => {
    result.totalCostUsd = round6(result.slots.reduce((n, s) => n + s.costUsd, 0));
    result.ms = Date.now() - started;
    result.slots.sort((a, b) => a.slot - b.slot);
    return result;
  };

  if (!opts.force && (await getSetting(NEWSLETTER_PAUSED_KEY, deps.db)) === "1") {
    log("paused by the admin setting; nothing built");
    result.paused = true;
    return finish();
  }

  // Market calendar: weekends and NYSE holidays produce nothing unless forced.
  let holidays = new Set<string>();
  if (!opts.force) {
    try {
      holidays = new Set(await (deps.holidays ?? fetchFmpNyseHolidays)());
    } catch (err) {
      warnings.push(`Could not load the NYSE holiday calendar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Idempotency: a slot with a draft is not rebuilt unless forced, a slot another
  // run is writing right now (pending, touched in the last few minutes) is left alone,
  // and a slot outside its time window waits for its cron.
  const existing = await deps.db.newsletterIssue.findMany({ where: { issueDate: dateKey, slot: { in: requested } } });
  const slots: Slot[] = [];
  for (const slot of requested) {
    const kind = SLOT_KIND[slot];
    const row = existing.find((r) => r.slot === slot);
    const inProgress = row?.status === "pending" && now.getTime() - row.updatedAt.getTime() < IN_PROGRESS_MS;
    const base = { slot, kind, skipped: true, headline: row?.headline ?? undefined, beehiivPostId: row?.beehiivPostId ?? undefined, beehiivPostUrl: row?.beehiivPostUrl ?? undefined, adsFound: row?.adsFound ?? 0, costUsd: 0 };
    if (row && !opts.force && (row.status === "drafted" || row.status === "needs_review" || inProgress)) {
      log(`slot ${slot}: already ${inProgress ? "building" : row.status} (${row.beehiivPostId ?? "no id"}); skipped`);
      result.slots.push({ ...base, status: inProgress ? "pending" : "skipped", note: inProgress ? "another run is building it" : `already ${row.status}` });
      continue;
    }
    const closed = opts.force ? null : windowReason(kind, now, holidays, dateKey);
    if (closed) {
      log(`slot ${slot}: ${closed}; skipped`);
      result.slots.push({ ...base, status: "skipped", note: closed });
      continue;
    }
    slots.push(slot);
  }
  if (!slots.length) return finish();

  // Yesterday's Smart Investor ads: one API call; failure means placeholders, not a failed run.
  let tsi: TsiAdsResult = { bySlot: new Map(), warnings: [] };
  try {
    tsi = await (deps.tsiAds ?? ((d: DateKey) => fetchTsiAdsFor(d, { fetchImpl: deps.fetchImpl })))(tsiDateKey);
    warnings.push(...tsi.warnings);
  } catch (err) {
    warnings.push(`Could not load The Smart Investor ads for ${tsiDateKey}: ${err instanceof Error ? err.message : String(err)}`);
  }
  for (const [n, s] of tsi.bySlot) log(`Smart Investor #${n} "${s.post.title}": ${s.ads.length} ad(s) from ${s.contentSource} content`);

  const writer = deps.writer ?? claudeIssueWriter;
  const outcomes = await Promise.allSettled(slots.map((slot) => buildSlot({ slot, dateKey, tsiDateKey, tsi, writer, deps, force: !!opts.force, now, log })));
  for (let i = 0; i < slots.length; i++) {
    const o = outcomes[i];
    if (o.status === "fulfilled") result.slots.push(o.value);
    else {
      const error = o.reason instanceof Error ? o.reason.message : String(o.reason);
      if (!deps.dry) await upsertIssue(deps.db, dateKey, slots[i], { status: "failed", error: error.slice(0, 1000), forced: !!opts.force }).catch(() => {});
      result.slots.push({ slot: slots[i], kind: SLOT_KIND[slots[i]], status: "failed", error, adsFound: 0, costUsd: 0 });
    }
  }
  return finish();
}

interface SlotJob {
  slot: Slot;
  dateKey: DateKey;
  tsiDateKey: DateKey;
  tsi: TsiAdsResult;
  writer: IssueWriter;
  deps: BuildDeps;
  force: boolean;
  now: Date;
  log: (m: string) => void;
}

async function buildSlot(job: SlotJob): Promise<SlotResult> {
  const { slot, dateKey, deps } = job;
  const kind = SLOT_KIND[slot];
  const source = job.tsi.bySlot.get(slot);
  const ads = source?.ads ?? [];
  const tsiFields = source ? { tsiPostId: source.post.id, tsiPostTitle: source.post.title, tsiAdvertisers: advertiserLabel(source.title) } : {};

  // Dry runs leave the issue log alone: a "drafted" row with no Beehiiv id would make the cron skip the slot.
  const record = deps.dry ? async () => {} : (patch: IssuePatch) => upsertIssue(deps.db, dateKey, slot, patch);

  await record({
    status: "pending",
    ticker: null,
    companyName: null,
    eventKey: `${kind}:${dateKey}`,
    eventSummary: null,
    adsFound: ads.length,
    adsHtml: ads.map((a) => a.html),
    ...tsiFields,
    forced: job.force,
    // A rebuilt row starts clean; the previous issue's fields must not linger.
    headline: null,
    subjectLine: null,
    previewText: null,
    sources: Prisma.JsonNull,
    articleText: null,
    reviewReason: null,
    error: null,
    beehiivPostId: null,
    beehiivPostUrl: null,
    model: NEWSLETTER.model,
    inputTokens: 0,
    outputTokens: 0,
    webSearches: 0,
    costUsd: 0,
  });

  const facts = await (deps.facts ?? ((k: IssueKind, d: DateKey) => gatherFacts(k, d, { ...deps.factsDeps, now: job.now })))(kind, dateKey);
  if (facts.missing.length) job.log(`slot ${slot}: facts missing ${facts.missing.join(", ")}`);
  const written = await writeIssue(kind, renderFacts(facts), dateKey, job.writer);
  const usage: ModelUsage = written.usage ?? EMPTY_USAGE;
  const cost = round6(costUsd(usage));
  const usageFields = { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches, costUsd: cost };
  const base: SlotResult = { slot, kind, status: "failed", adsFound: ads.length, costUsd: cost, ...("tsiPostTitle" in tsiFields ? { tsiPostTitle: tsiFields.tsiPostTitle, tsiAdvertisers: tsiFields.tsiAdvertisers } : {}) };

  if (!written.article) {
    const error = `${KIND_LABEL[kind]} failed after ${written.attempts} attempt(s): ${written.reason ?? "unknown"}`;
    await record({ status: "failed", error: error.slice(0, 1000), ...usageFields });
    job.log(`slot ${slot}: ${error}`);
    return { ...base, status: "failed", error };
  }

  const reviewReason = written.status === "needs_review" ? written.reason : null;
  // The brief's headline is fixed, like the CNBC list it is modeled on: "Top 9 things to watch Monday, September 8".
  if (kind === "morning") {
    const items = numberedItems(written.article.paragraphs);
    if (items.ok) written.article.headline = `Top ${items.items.length} things to watch ${longDate(dateKey)}`;
  }
  const body = buildCreatePostBody({
    dateKey,
    slot,
    kind,
    article: written.article,
    reviewReason,
    ads: { first: ads[0]?.html ?? null, second: ads[1]?.html ?? null, tsiDateKey: job.tsiDateKey },
    renderMode: deps.renderMode,
  });

  let beehiivPostId: string | null = null;
  let beehiivPostUrl: string | null = null;
  if (!deps.dry) {
    const pub = publicationByKey("fsa");
    if (!pub) throw new Error("FreeStockAlerts publication is not configured");
    const created = await createPost(pub.id, body, { fetchImpl: deps.fetchImpl });
    beehiivPostId = created.id;
    beehiivPostUrl = beehiivEditUrl(created.id);
  }

  const status: IssueStatus = reviewReason ? "needs_review" : "drafted";
  await record({
    status,
    headline: written.article.headline,
    eventSummary: written.article.subtitle || null,
    subjectLine: body.email_settings?.email_subject_line ?? written.article.headline,
    previewText: body.email_settings?.email_preview_text ?? null,
    sources: written.article.sources as unknown as Prisma.InputJsonValue,
    articleText: written.article.paragraphs.join("\n\n"),
    reviewReason,
    beehiivPostId,
    beehiivPostUrl,
    ...usageFields,
  });
  job.log(`slot ${slot}: ${status} "${written.article.headline}"${beehiivPostId ? ` -> ${beehiivPostId}` : " (dry)"} ads=${ads.length} $${cost.toFixed(4)}`);
  return {
    ...base,
    status,
    headline: written.article.headline,
    subjectLine: body.email_settings?.email_subject_line,
    beehiivPostId: beehiivPostId ?? undefined,
    beehiivPostUrl: beehiivPostUrl ?? undefined,
    reviewReason: reviewReason ?? undefined,
    body: deps.dry ? body : undefined,
  };
}

type IssuePatch = Omit<Prisma.NewsletterIssueUncheckedCreateInput, "issueDate" | "slot" | "status" | "id"> & { status: IssueStatus };

async function upsertIssue(db: PrismaClient, issueDate: DateKey, slot: Slot, patch: IssuePatch) {
  return db.newsletterIssue.upsert({
    where: { issueDate_slot: { issueDate, slot } },
    create: { ...(patch as Omit<Prisma.NewsletterIssueUncheckedCreateInput, "issueDate" | "slot">), issueDate, slot },
    update: patch as Prisma.NewsletterIssueUncheckedUpdateInput,
  });
}
