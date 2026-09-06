/**
 * Keep the Subscriber table current. The tracked population is the app's own
 * users (people who signed up on the website); each of them is looked up by
 * email in both Beehiiv publications so their newsletter clicks can be
 * credited. The first time a subscription's stats are read, the counts are
 * stored as a baseline: only clicks after that moment count.
 *
 * `syncBeehiivPublication` (a cursor-based pass over a whole list) is kept for
 * the day a full list should be mirrored; the cron does not use it.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { findSubscriptionByEmail, listPosts, listSubscriptions, type BeehiivPost, type BeehiivSubscription } from "@/lib/beehiiv/client";
import { BEEHIIV_PUBLICATIONS, type BeehiivPublication } from "@/lib/beehiiv/config";
import { attributionFromBeehiiv, attributionFromUser, cohortKey, mergeAttribution, type AttributionSource } from "./cohort";

type Db = PrismaClient;
type Log = (m: string) => void;

const EXISTING_SELECT = { id: true, firstSeenAt: true, attributionSource: true, utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true, referringSite: true, landingPath: true } as const;

interface UpsertInput {
  email: string;
  firstName?: string | null;
  source: AttributionSource;
  createdAt: Date;
  attribution: ReturnType<typeof attributionFromBeehiiv>;
  /** Source-specific columns (ids, statuses). */
  columns: Record<string, unknown>;
}

/**
 * Upsert a batch of subscribers by email with first-touch attribution rules.
 * One read for the batch, one createMany for the new rows, one transaction
 * of updates for the rest: a 100-row page costs three round trips, not 300.
 * Returns email → subscriber id for every row in the batch.
 */
export async function upsertSubscribers(db: Db, inputs: UpsertInput[]): Promise<Map<string, string>> {
  const byEmail = new Map<string, UpsertInput>();
  for (const i of inputs) byEmail.set(i.email.trim().toLowerCase(), { ...i, email: i.email.trim().toLowerCase() });
  const emails = [...byEmail.keys()];
  if (!emails.length) return new Map();
  const userIds = [...byEmail.values()].map((i) => i.columns.userId).filter((v): v is string => typeof v === "string");
  const existing = await db.subscriber.findMany({
    where: { OR: [{ email: { in: emails } }, ...(userIds.length ? [{ userId: { in: userIds } }] : [])] },
    select: { email: true, userId: true, ...EXISTING_SELECT },
  });
  const existingByEmail = new Map(existing.map((e) => [e.email, e]));
  const existingByUser = new Map(existing.filter((e) => e.userId).map((e) => [e.userId as string, e]));

  const creates: Prisma.SubscriberCreateManyInput[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const [email, input] of byEmail) {
    // An app user who changed their email keeps their row: match on userId first.
    const byUser = typeof input.columns.userId === "string" ? existingByUser.get(input.columns.userId) : undefined;
    const row = byUser ?? existingByEmail.get(email) ?? null;
    const merged = mergeAttribution(row, { source: input.source, createdAt: input.createdAt, attribution: input.attribution });
    const data = { ...merged, cohortKey: cohortKey(merged), ...input.columns, ...(input.firstName ? { firstName: input.firstName } : {}) };
    if (row) updates.push(db.subscriber.update({ where: { id: row.id }, data: { ...data, ...(row.email !== email ? { email } : {}) } }));
    else creates.push({ email, ...data } as Prisma.SubscriberCreateManyInput);
  }
  if (creates.length) await db.subscriber.createMany({ data: creates, skipDuplicates: true });
  if (updates.length) await db.$transaction(updates);

  const ids = await db.subscriber.findMany({ where: { OR: [{ email: { in: emails } }, ...(userIds.length ? [{ userId: { in: userIds } }] : [])] }, select: { id: true, email: true } });
  return new Map(ids.map((r) => [r.email, r.id]));
}

/** Single-row convenience (tests, on-the-spot mirroring). */
export async function upsertSubscriber(db: Db, input: UpsertInput): Promise<string> {
  const ids = await upsertSubscribers(db, [input]);
  return ids.get(input.email.trim().toLowerCase())!;
}

const firstNameOf = (s: BeehiivSubscription) => {
  const f = s.custom_fields?.find((c) => /first.?name/i.test(c.name));
  return typeof f?.value === "string" && f.value.trim() ? f.value.trim().slice(0, 80) : null;
};

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

export function beehiivColumns(pub: BeehiivPublication, s: BeehiivSubscription, now = new Date()): Record<string, unknown> {
  const created = new Date(s.created * 1000);
  const clicks = count(s.stats?.total_clicked);
  const unique = count(s.stats?.total_unique_clicked);
  const stats = s.stats ? { beehiivStatsAt: now } : {};
  return pub.key === "fsa"
    ? { beehiivFsaId: s.id, beehiivFsaStatus: s.status, beehiivFsaCreatedAt: created, beehiivFsaClicks: clicks, beehiivFsaUniqueClicks: unique, ...stats }
    : { beehiivSiId: s.id, beehiivSiStatus: s.status, beehiivSiCreatedAt: created, beehiivSiClicks: clicks, beehiivSiUniqueClicks: unique, ...stats };
}

/** Clicks that arrived with a Beehiiv token before the subscriber was synced get attached now. */
async function attachOrphanClicks(db: Db, tokenToSubscriber: Map<string, string>) {
  const tokens = [...tokenToSubscriber.keys()];
  if (!tokens.length) return;
  const orphans = await db.emailAdClick.findMany({ where: { token: { in: tokens }, subscriberId: null }, select: { id: true, token: true } });
  if (!orphans.length) return;
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const bySubscriber = new Map<string, typeof orphans>();
  for (const o of orphans) {
    const sid = tokenToSubscriber.get(o.token!);
    if (!sid) continue;
    bySubscriber.set(sid, [...(bySubscriber.get(sid) ?? []), o]);
  }
  // Attach only: these arrived via Beehiiv tokens, and newsletter clicks are credited from Beehiiv's own counts.
  for (const [subscriberId, clicks] of bySubscriber) {
    ops.push(db.emailAdClick.updateMany({ where: { id: { in: clicks.map((c) => c.id) } }, data: { subscriberId } }));
  }
  if (ops.length) await db.$transaction(ops);
}

export interface BeehiivSyncOptions {
  db: Db;
  pub: BeehiivPublication;
  /** Stop after this many pages; the cursor is saved so the next run continues. */
  maxPages?: number;
  log?: Log;
  fetchImpl?: typeof fetch;
}

export interface BeehiivSyncResult {
  source: string;
  pages: number;
  rows: number;
  completed: boolean;
  resumed: boolean;
}

/**
 * Continue (or start) a pass over one publication, newest first. A pass that
 * did not reach the end leaves its cursor on the run row; the next call picks
 * it up. When a pass completes, the next call starts a fresh one from the top.
 */
export async function syncBeehiivPublication({ db, pub, maxPages = 60, log = () => {}, fetchImpl }: BeehiivSyncOptions): Promise<BeehiivSyncResult> {
  const open = await db.subscriberSyncRun.findFirst({ where: { source: pub.source, completed: false, error: null, cursor: { not: null } }, orderBy: { startedAt: "desc" } });
  const run = open ?? (await db.subscriberSyncRun.create({ data: { source: pub.source } }));
  let cursor: string | null = run.cursor ?? null;
  const now = new Date();
  let pages = 0;
  let rows = 0;
  let completed = false;
  try {
    while (pages < maxPages) {
      const page = await listSubscriptions(pub.id, { cursor, limit: 100, status: "all", fetchImpl });
      pages++;
      const inputs = page.data
        .filter((s) => !!s.email)
        .map((s) => ({
          email: s.email,
          firstName: firstNameOf(s),
          source: pub.source,
          createdAt: new Date(s.created * 1000),
          attribution: attributionFromBeehiiv(s),
          columns: beehiivColumns(pub, s, now),
        }));
      const ids = await upsertSubscribers(db, inputs);
      const tokenToSubscriber = new Map<string, string>();
      for (const s of page.data) {
        const id = ids.get(s.email.trim().toLowerCase());
        if (id) tokenToSubscriber.set(s.id, id);
      }
      await attachOrphanClicks(db, tokenToSubscriber);
      rows += inputs.length;
      cursor = page.nextCursor;
      if (!page.hasMore || !cursor) {
        completed = true;
        break;
      }
    }
    await db.subscriberSyncRun.update({
      where: { id: run.id },
      data: { pagesFetched: { increment: pages }, rowsUpserted: { increment: rows }, cursor: completed ? null : cursor, completed, ...(completed ? { finishedAt: new Date() } : {}) },
    });
    log(`${pub.source}: ${pages} pages, ${rows} rows${completed ? ", pass complete" : ", will resume"}`);
    return { source: pub.source, pages, rows, completed, resumed: !!open };
  } catch (err) {
    await db.subscriberSyncRun.update({ where: { id: run.id }, data: { error: (err instanceof Error ? err.message : String(err)).slice(0, 500), finishedAt: new Date(), pagesFetched: { increment: pages }, rowsUpserted: { increment: rows } } });
    throw err;
  }
}

/** Mirror app users into the subscriber table (cheap: one query, upsert per user). */
export async function syncAppUsers(db: Db, log: Log = () => {}, since?: Date): Promise<number> {
  const users = await db.user.findMany({
    // Anyone not mirrored yet is always included, so a user created during an outage is never skipped for good.
    where: since ? { OR: [{ subscriber: null }, { createdAt: { gte: since } }, { updatedAt: { gte: since } }] } : undefined,
    select: { id: true, email: true, firstName: true, createdAt: true, signupSource: true, utmSource: true, utmMedium: true, utmCampaign: true, utmTerm: true, utmContent: true, referrer: true, landingPath: true },
  });
  let n = 0;
  for (let i = 0; i < users.length; i += 100) {
    const batch = users.slice(i, i + 100).map((u) => ({
      email: u.email,
      firstName: u.firstName,
      source: "app" as const,
      createdAt: u.createdAt,
      attribution: attributionFromUser(u),
      columns: { userId: u.id, appCreatedAt: u.createdAt },
    }));
    await upsertSubscribers(db, batch);
    n += batch.length;
  }
  log(`app: ${n} users mirrored`);
  return n;
}

/** Upsert sent issues and their per-link click stats. Newest first; `maxPages` of 50. */
export async function syncNewsletterPosts(db: Db, pub: BeehiivPublication, opts: { maxPages?: number; log?: Log; fetchImpl?: typeof fetch } = {}): Promise<number> {
  const { maxPages = 4, log = () => {}, fetchImpl } = opts;
  let page = 1;
  let posts = 0;
  for (;;) {
    const res = await listPosts(pub.id, { page, limit: 50, fetchImpl });
    for (const post of res.data) {
      if (!post.publish_date) continue;
      await upsertPost(db, pub, post);
      posts++;
    }
    if (page >= res.totalPages || page >= maxPages) break;
    page++;
  }
  log(`${pub.source} posts: ${posts} issues`);
  return posts;
}

async function upsertPost(db: Db, pub: BeehiivPublication, post: BeehiivPost) {
  const em = post.stats?.email ?? {};
  const data = {
    publication: pub.key,
    title: post.title?.trim().slice(0, 300) || "(untitled)",
    subtitle: post.subtitle?.trim().slice(0, 300) || null,
    webUrl: post.web_url ?? null,
    publishDate: post.publish_date ? new Date(post.publish_date * 1000) : null,
    recipients: count(em.recipients),
    delivered: count(em.delivered),
    uniqueOpens: count(em.unique_opens),
    clicks: count(em.clicks),
    uniqueClicks: count(em.unique_clicks),
    verifiedClicks: count(em.verified_clicks),
    uniqueVerifiedClicks: count(em.unique_verified_clicks),
    syncedAt: new Date(),
  };
  await db.newsletterPost.upsert({ where: { id: post.id }, create: { id: post.id, ...data }, update: data });
  const links = (post.stats?.clicks ?? []).filter((l) => l.url).slice(0, 200);
  if (!links.length) return;
  await db.$transaction(
    links.map((l) => {
      const row = {
        baseUrl: (l.base_url || l.url).slice(0, 1000),
        emailClicks: count(l.email?.clicks ?? l.total_clicks),
        emailUniqueClicks: count(l.email?.unique_clicks ?? l.total_unique_clicks),
        verifiedClicks: count(l.email?.verified_clicks),
        uniqueVerifiedClicks: count(l.email?.unique_verified_clicks),
        webClicks: count(l.web?.clicks),
      };
      return db.newsletterLink.upsert({ where: { postId_url: { postId: post.id, url: l.url.slice(0, 2000) } }, create: { postId: post.id, url: l.url.slice(0, 2000), ...row }, update: row });
    }),
  );
}

/**
 * Beehiiv columns for a tracked subscriber, with the baseline frozen the first
 * time tracking sees this subscription: either the id is new, or tracking has
 * not started yet for the row (e.g. it was pre-loaded by a full-list mirror).
 */
export function trackedColumns(pub: BeehiivPublication, s: BeehiivSubscription, existing: { trackingStartedAt: Date | null; beehiivFsaId: string | null; beehiivSiId: string | null }, now: Date): Record<string, unknown> {
  const base = beehiivColumns(pub, s, now);
  const clicks = count(s.stats?.total_clicked);
  const unique = count(s.stats?.total_unique_clicked);
  const knownId = pub.key === "fsa" ? existing.beehiivFsaId : existing.beehiivSiId;
  // New to tracking, or a new subscription id (unsubscribe + resubscribe starts Beehiiv's counts over).
  const firstSight = !existing.trackingStartedAt || knownId !== s.id;
  const baseline = firstSight
    ? pub.key === "fsa"
      ? { beehiivFsaClicksBaseline: clicks, beehiivFsaUniqueClicksBaseline: unique }
      : { beehiivSiClicksBaseline: clicks, beehiivSiUniqueClicksBaseline: unique }
    : {};
  return { ...base, ...baseline, ...(existing.trackingStartedAt ? {} : { trackingStartedAt: now }) };
}

export interface TrackedSyncResult {
  users: number;
  lookups: number;
  failures: number;
  matched: Record<string, number>;
}

/**
 * Look every app user up in each publication by email and store the
 * subscription (id, status, UTM attribution, lifetime clicks). 10 to 20 users
 * is a handful of API calls; the cron runs it hourly.
 */
export async function syncTrackedSubscribers(db: Db, opts: { publications?: BeehiivPublication[]; log?: Log; fetchImpl?: typeof fetch; now?: Date; budgetMs?: number } = {}): Promise<TrackedSyncResult> {
  const { publications = BEEHIIV_PUBLICATIONS, log = () => {}, fetchImpl } = opts;
  const now = opts.now ?? new Date();
  const tracked = await db.subscriber.findMany({ where: { userId: { not: null } }, select: { id: true, email: true, beehiivFsaId: true, beehiivSiId: true, trackingStartedAt: true } });
  const matched: Record<string, number> = {};
  let lookups = 0;
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 200_000;
  let failures = 0;
  for (const pub of publications) {
    matched[pub.source] = 0;
    for (const row of tracked) {
      if (Date.now() - started > budgetMs) {
        log(`tracked: time budget reached after ${lookups} lookups; the rest continue next run`);
        break;
      }
      lookups++;
      let sub: BeehiivSubscription | null;
      try {
        sub = await findSubscriptionByEmail(pub.id, row.email, { fetchImpl });
      } catch (err) {
        failures++;
        log(`${pub.source} lookup failed for subscriber ${row.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (!sub) continue;
      matched[pub.source]++;
      await upsertSubscribers(db, [
        {
          email: row.email,
          firstName: firstNameOf(sub),
          source: pub.source,
          createdAt: new Date(sub.created * 1000),
          attribution: attributionFromBeehiiv(sub),
          columns: trackedColumns(pub, sub, row, now),
        },
      ]);
    }
  }
  log(`tracked: ${tracked.length} users, ${lookups} lookups, ${failures} failed, matched ${JSON.stringify(matched)}`);
  return { users: tracked.length, lookups, failures, matched };
}

export interface SyncAllOptions {
  db: Db;
  log?: Log;
  /** Only app users changed since this time (default: everything). */
  appSince?: Date;
  publications?: BeehiivPublication[];
  fetchImpl?: typeof fetch;
  /** Skip the per-issue stats pull. */
  skipPosts?: boolean;
}

/** App users → tracked subscribers → Beehiiv lookups → latest issue stats. */
export async function syncAll({ db, log = () => {}, appSince, publications = BEEHIIV_PUBLICATIONS, fetchImpl, skipPosts }: SyncAllOptions) {
  const app = await syncAppUsers(db, log, appSince);
  const tracked = await syncTrackedSubscribers(db, { publications, log, fetchImpl });
  const posts: Record<string, number> = {};
  if (!skipPosts) {
    for (const pub of publications) {
      try {
        posts[pub.source] = await syncNewsletterPosts(db, pub, { log, fetchImpl, maxPages: 1 });
      } catch (err) {
        log(`${pub.source} posts failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  return { app, tracked, posts };
}
