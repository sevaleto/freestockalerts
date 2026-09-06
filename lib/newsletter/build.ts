/**
 * One run = the day's issue slots: pick topics once, then per slot write the
 * article, attach yesterday's Smart Investor ads, create the Beehiiv draft,
 * and record everything in NewsletterIssue. A slot's failure never blocks the
 * other, and every path leaves the row in a final state.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { fetchFmpLatestStockNews, type FmpMarketNewsItem } from "@/lib/api/fmp";
import { beehiivEditUrl, createPost, type CreatePostBody } from "@/lib/beehiiv/client";
import { publicationByKey } from "@/lib/beehiiv/config";
import { getSetting } from "@/lib/settings";
import { claudeArticleWriter, writeArticle, type ArticleWriter } from "./article";
import { NEWSLETTER, NEWSLETTER_PAUSED_KEY, type Slot } from "./config";
import { dateKeyWeekday, pacificDateKey, shiftDateKey, type DateKey } from "./dates";
import { buildCreatePostBody, type RenderMode } from "./render";
import { claudeTopicPicker, groupCandidates, loadExclusions, pickTopics, type TopicPick, type TopicPicker } from "./topics";
import { advertiserLabel, fetchTsiAdsFor, type TsiAdsResult } from "./tsiAds";
import { addUsage, costUsd, EMPTY_USAGE, type ModelUsage } from "./usage";

export type IssueStatus = "pending" | "drafted" | "needs_review" | "failed" | "skipped";

export interface BuildDeps {
  db: PrismaClient;
  /** Injected in tests; also passed through to Beehiiv calls. */
  fetchImpl?: typeof fetch;
  picker?: TopicPicker;
  writer?: ArticleWriter;
  news?: () => Promise<FmpMarketNewsItem[]>;
  tsiAds?: (dateKey: DateKey) => Promise<TsiAdsResult>;
  now?: Date;
  log?: (m: string) => void;
  /** Run everything except the Beehiiv write. */
  dry?: boolean;
  renderMode?: RenderMode;
}

export interface SlotResult {
  slot: Slot;
  status: IssueStatus;
  skipped?: boolean;
  ticker?: string;
  companyName?: string;
  headline?: string;
  subjectLine?: string;
  beehiivPostId?: string;
  beehiivPostUrl?: string;
  adsFound: number;
  tsiPostTitle?: string;
  tsiAdvertisers?: string;
  reviewReason?: string;
  error?: string;
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
  /** Rebuild slots that already have a draft; the old draft stays in Beehiiv. */
  force?: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

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
    return result;
  };

  if (!opts.force && (await getSetting(NEWSLETTER_PAUSED_KEY, deps.db)) === "1") {
    log("paused by the admin setting; nothing built");
    result.paused = true;
    return finish();
  }

  // Idempotency: a slot with a draft is not rebuilt unless forced.
  const existing = await deps.db.newsletterIssue.findMany({ where: { issueDate: dateKey, slot: { in: requested } } });
  const slots: Slot[] = [];
  for (const slot of requested) {
    const row = existing.find((r) => r.slot === slot);
    if (row && !opts.force && (row.status === "drafted" || row.status === "needs_review")) {
      log(`slot ${slot}: already ${row.status} (${row.beehiivPostId ?? "no id"}); skipped`);
      result.slots.push({ slot, status: "skipped", skipped: true, ticker: row.ticker ?? undefined, headline: row.headline ?? undefined, beehiivPostId: row.beehiivPostId ?? undefined, beehiivPostUrl: row.beehiivPostUrl ?? undefined, adsFound: row.adsFound, costUsd: 0 });
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

  // Topics: one picker call for every slot being built, so the two never collide.
  const picker = deps.picker ?? claudeTopicPicker;
  const writer = deps.writer ?? claudeArticleWriter;
  let picks: TopicPick[] = [];
  let pickerUsage: ModelUsage = EMPTY_USAGE;
  try {
    const rows = await (deps.news ?? (() => fetchFmpLatestStockNews(NEWSLETTER.newsFetchLimit)))();
    const exclusions = await loadExclusions(deps.db, dateKey, slots.map((slot) => ({ issueDate: dateKey, slot })));
    const lookbackHours = dateKeyWeekday(dateKey) === 1 ? NEWSLETTER.mondayNewsLookbackHours : NEWSLETTER.newsLookbackHours;
    const candidates = groupCandidates(rows, { now, lookbackHours, exclude: new Set(exclusions.recentTickers), limit: NEWSLETTER.candidateLimit });
    log(`${rows.length} headlines → ${candidates.length} candidate tickers (${exclusions.recentTickers.length} on cooldown, ${exclusions.recentEvents.length} past events)`);
    const picked = await pickTopics({ candidates, exclusions, dateKey, slots }, picker);
    picks = picked.picks;
    pickerUsage = picked.usage;
    for (const p of picks) log(`slot ${p.slot}: ${p.ticker} — ${p.eventSummary}`);
  } catch (err) {
    const error = `Topic selection failed: ${err instanceof Error ? err.message : String(err)}`;
    log(error);
    for (const slot of slots) {
      await upsertIssue(deps.db, dateKey, slot, { status: "failed", error: error.slice(0, 1000), forced: !!opts.force });
      result.slots.push({ slot, status: "failed", error, adsFound: 0, costUsd: 0 });
    }
    return finish();
  }
  const pickerCostPerSlot = round6(costUsd(pickerUsage) / slots.length);

  const outcomes = await Promise.allSettled(
    slots.map((slot) => {
      const pick = picks.find((p) => p.slot === slot);
      if (!pick) return Promise.reject(new Error(`the picker returned nothing for slot ${slot}`));
      return buildSlot({ slot, pick, dateKey, tsiDateKey, tsi, writer, deps, force: !!opts.force, pickerCostUsd: pickerCostPerSlot, log });
    })
  );
  for (let i = 0; i < slots.length; i++) {
    const o = outcomes[i];
    if (o.status === "fulfilled") result.slots.push(o.value);
    else {
      const error = o.reason instanceof Error ? o.reason.message : String(o.reason);
      await upsertIssue(deps.db, dateKey, slots[i], { status: "failed", error: error.slice(0, 1000), forced: !!opts.force }).catch(() => {});
      result.slots.push({ slot: slots[i], status: "failed", error, adsFound: 0, costUsd: pickerCostPerSlot });
    }
  }
  result.slots.sort((a, b) => a.slot - b.slot);
  return finish();
}

interface SlotJob {
  slot: Slot;
  pick: TopicPick;
  dateKey: DateKey;
  tsiDateKey: DateKey;
  tsi: TsiAdsResult;
  writer: ArticleWriter;
  deps: BuildDeps;
  force: boolean;
  pickerCostUsd: number;
  log: (m: string) => void;
}

async function buildSlot(job: SlotJob): Promise<SlotResult> {
  const { slot, pick, dateKey, deps } = job;
  const source = job.tsi.bySlot.get(slot);
  const ads = source?.ads ?? [];
  const tsiFields = source ? { tsiPostId: source.post.id, tsiPostTitle: source.post.title, tsiAdvertisers: advertiserLabel(source.title) } : {};
  const eventKey = `${pick.ticker}:${dateKey}:${pick.eventSlug}`;

  await upsertIssue(deps.db, dateKey, slot, {
    status: "pending",
    ticker: pick.ticker,
    companyName: pick.companyName,
    eventKey,
    eventSummary: pick.eventSummary,
    adsFound: ads.length,
    adsHtml: ads.map((a) => a.html),
    ...tsiFields,
    forced: job.force,
    error: null,
    beehiivPostId: null,
    beehiivPostUrl: null,
    model: NEWSLETTER.model,
  });

  const written = await writeArticle(pick, dateKey, job.writer);
  const cost = round6(costUsd(written.usage) + job.pickerCostUsd);
  const usageFields = { inputTokens: written.usage.inputTokens, outputTokens: written.usage.outputTokens, webSearches: written.usage.webSearches, costUsd: cost };
  const base: SlotResult = { slot, status: "failed", ticker: pick.ticker, companyName: pick.companyName, adsFound: ads.length, costUsd: cost, ...("tsiPostTitle" in tsiFields ? { tsiPostTitle: tsiFields.tsiPostTitle, tsiAdvertisers: tsiFields.tsiAdvertisers } : {}) };

  if (!written.article) {
    const error = `Article failed after ${written.attempts} attempt(s): ${written.reason ?? "unknown"}`;
    await upsertIssue(deps.db, dateKey, slot, { status: "failed", error: error.slice(0, 1000), ...usageFields });
    job.log(`slot ${slot}: ${error}`);
    return { ...base, status: "failed", error };
  }

  const reviewReason = written.status === "needs_review" ? written.reason : null;
  const body = buildCreatePostBody({
    dateKey,
    slot,
    article: written.article,
    ticker: pick.ticker,
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
  await upsertIssue(deps.db, dateKey, slot, {
    status,
    headline: written.article.headline,
    subjectLine: body.email_settings?.email_subject_line ?? written.article.headline,
    previewText: body.email_settings?.email_preview_text ?? null,
    sources: written.article.sources as unknown as Prisma.InputJsonValue,
    articleText: written.article.paragraphs.join("\n\n"),
    reviewReason,
    beehiivPostId,
    beehiivPostUrl,
    ...usageFields,
  });
  job.log(`slot ${slot}: ${status} "${written.article.headline}"${beehiivPostId ? ` → ${beehiivPostId}` : " (dry)"} ads=${ads.length} $${cost.toFixed(4)}`);
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
