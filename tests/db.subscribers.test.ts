/** Beehiiv sync (fake fetch) and identified click recording against the throwaway Postgres. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { syncBeehiivPublication, syncAppUsers, syncNewsletterPosts, syncTrackedSubscribers } from "../lib/subscribers/sync";
import { recordClick } from "../lib/subscribers/clicks";
import type { BeehiivPublication } from "../lib/beehiiv/config";

const url = process.env.TEST_DATABASE_URL ?? "";
const enabled = /test/.test(url);
const prisma = enabled ? new PrismaClient({ datasourceUrl: url }) : (null as unknown as PrismaClient);
const PUB: BeehiivPublication = { key: "si", name: "test", id: "pub_test", source: "beehiiv_si" };
const EMAILS = ["sync-a@example.test", "sync-b@example.test", "sync-c@example.test"];
const USER = { id: "33333333-3333-4333-8333-333333333333", email: "sync-a@example.test", utmSource: "facebook", utmCampaign: "breakouts", createdAt: new Date("2026-01-05T00:00:00Z") };

const subs = (page: number) =>
  page === 1
    ? [
        { id: "sub_aaaaaaaa-1", email: EMAILS[0], status: "active", created: Math.floor(new Date("2026-03-01T00:00:00Z").getTime() / 1000), utm_source: "facebook", utm_medium: "reels", utm_campaign: "email only", referring_site: "www.tradingtips.com/x/", stats: { total_clicked: 9, total_unique_clicked: 4 } },
        { id: "sub_bbbbbbbb-2", email: EMAILS[1], status: "inactive", created: Math.floor(new Date("2026-02-01T00:00:00Z").getTime() / 1000), utm_source: "direct" },
      ]
    : [{ id: "sub_cccccccc-3", email: EMAILS[2], status: "active", created: Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000), utm_source: "modemobile", utm_medium: "cto", utm_campaign: "mi" }];

const POST = {
  id: "post_test-1",
  title: "09/05/2026 - Dedicated - Test",
  status: "confirmed",
  publish_date: Math.floor(new Date("2026-09-05T13:00:00Z").getTime() / 1000),
  web_url: "https://example.beehiiv.com/p/test",
  stats: {
    email: { recipients: 1000, delivered: 990, unique_opens: 200, clicks: 50, unique_clicks: 20, verified_clicks: 12, unique_verified_clicks: 10 },
    clicks: [
      { url: "https://track.example.com/a?x=1", base_url: "https://track.example.com/a", email: { clicks: 40, unique_clicks: 15, verified_clicks: 9, unique_verified_clicks: 8 }, web: { clicks: 0 } },
      { url: "https://www.beehiiv.com/powered-by?x", base_url: "https://www.beehiiv.com/powered-by", email: { clicks: 10, unique_clicks: 5, verified_clicks: 3, unique_verified_clicks: 2 }, web: { clicks: 0 } },
    ],
  },
};

/** Lifetime SI click counts returned for the tracked user; bumped by the test to simulate new clicks. */
const live = { total_clicked: 9, total_unique_clicked: 4 };

const fakeFetch: typeof fetch = async (input) => {
  const u = new URL(String(input));
  const email = u.searchParams.get("email");
  if (email) {
    // Exact-email lookup; Beehiiv has been seen returning unrelated rows too, so include one.
    const rows = email === USER.email
      ? [{ id: "sub_unrelated-9", email: "someone-else@example.test", status: "active", created: 1 }, { ...subs(1)[0], stats: { ...live } }]
      : [{ id: "sub_unrelated-9", email: "someone-else@example.test", status: "active", created: 1 }];
    return new Response(JSON.stringify({ data: rows, has_more: false, next_cursor: null }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (u.pathname.endsWith("/posts")) {
    return new Response(JSON.stringify({ data: [POST, { ...POST, id: "post_draft", status: "draft", publish_date: null }], page: 1, total_pages: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const page = u.searchParams.get("cursor") === "next" ? 2 : 1;
  return new Response(JSON.stringify({ data: subs(page), has_more: page === 1, next_cursor: page === 1 ? "next" : null }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const cleanup = async () => {
  await prisma.emailAdClick.deleteMany({ where: { token: { in: ["sub_aaaaaaaa-1", "sub_cccccccc-3", `u_${USER.id}`] } } });
  await prisma.subscriber.deleteMany({ where: { email: { in: EMAILS } } });
  await prisma.subscriberSyncRun.deleteMany({ where: { source: PUB.source } });
  await prisma.emailAd.deleteMany({ where: { name: "__sync_test_ad" } });
  await prisma.user.deleteMany({ where: { email: USER.email } });
  await prisma.newsletterPost.deleteMany({ where: { id: { in: ["post_test-1", "post_draft"] } } });
};

before(async () => {
  if (!enabled) return;
  await cleanup();
  await prisma.user.create({ data: USER });
});
after(async () => {
  if (!enabled) return;
  await cleanup();
  await prisma.$disconnect();
});

test("a Beehiiv pass resumes across runs, keeps first-touch attribution, and attaches early clicks", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  const ad = await prisma.emailAd.create({ data: { name: "__sync_test_ad", leadIn: "Special Report", headline: "H", headlineColor: "#1a2b5c", body: "B", ctaText: "Go", ctaUrl: "https://example.com/x", valueCents: 250 } });
  // A newsletter click arrives before the subscriber exists locally: kept by token.
  const early = await recordClick(prisma, { adId: ad.id, adValueCents: ad.valueCents, channel: "beehiiv_si", token: "sub_cccccccc-3", ipHash: "h1", userAgent: "Mozilla/5.0 Safari" });
  assert.equal(early.counted, true);
  assert.equal(early.subscriberId, null);

  const first = await syncBeehiivPublication({ db: prisma, pub: PUB, maxPages: 1, fetchImpl: fakeFetch });
  assert.deepEqual({ pages: first.pages, rows: first.rows, completed: first.completed }, { pages: 1, rows: 2, completed: false });
  const second = await syncBeehiivPublication({ db: prisma, pub: PUB, maxPages: 5, fetchImpl: fakeFetch });
  assert.deepEqual({ pages: second.pages, rows: second.rows, completed: second.completed, resumed: second.resumed }, { pages: 1, rows: 1, completed: true, resumed: true });

  const c = await prisma.subscriber.findUnique({ where: { email: EMAILS[2] }, include: { clicks: true } });
  assert.equal(c?.cohortKey, "modemobile|cto|mi");
  assert.equal(c?.clicks.length, 1, "the early newsletter click was attached on sync");
  assert.equal(c?.countedClicks, 0, "newsletter clicks are credited from Beehiiv counts, not the redirect");
  assert.equal(c?.clickValueCents, 0);

  // App user with the same email as sub a, created earlier and tagged: app attribution wins, firstSeenAt moves back.
  await syncAppUsers(prisma, () => {}, new Date("2025-01-01T00:00:00Z"));
  const a = await prisma.subscriber.findUnique({ where: { email: EMAILS[0] } });
  assert.equal(a?.userId, USER.id);
  assert.equal(a?.beehiivSiId, "sub_aaaaaaaa-1");
  assert.equal(a?.attributionSource, "app");
  assert.equal(a?.cohortKey, "facebook|(none)|breakouts");
  assert.equal(a?.firstSeenAt.toISOString(), USER.createdAt.toISOString());
  assert.equal(a?.beehiivSiUniqueClicks, 4, "Beehiiv lifetime unique clicks synced");
  assert.equal(a?.beehiivSiClicks, 9);

  // Identified alert click, then a repeat within a day: second is logged but not counted.
  const one = await recordClick(prisma, { adId: ad.id, adValueCents: 250, channel: "alert", token: `u_${USER.id}`, ipHash: "h2", userAgent: "Mozilla/5.0 Safari" });
  const two = await recordClick(prisma, { adId: ad.id, adValueCents: 250, channel: "alert", token: `u_${USER.id}`, ipHash: "h3", userAgent: "Mozilla/5.0 Safari" });
  assert.equal(one.counted, true);
  assert.equal(one.subscriberId, a?.id);
  assert.equal(two.counted, false);
  const bot = await recordClick(prisma, { adId: ad.id, adValueCents: 250, channel: "beehiiv_si", token: "sub_aaaaaaaa-1", ipHash: "h4", userAgent: "Outlook SafeLinks scanner" });
  assert.equal(bot.counted, false);
  // A newsletter snippet click (a different ad, so the 24h dedupe does not apply) counts for the ad but does not credit the subscriber: Beehiiv already does.
  const ad2 = await prisma.emailAd.create({ data: { name: "__sync_test_ad", leadIn: "Special Report", headline: "H2", headlineColor: "#1a2b5c", body: "B", ctaText: "Go", ctaUrl: "https://example.com/y", valueCents: 250 } });
  const nl = await recordClick(prisma, { adId: ad2.id, adValueCents: 250, channel: "beehiiv_si", token: "sub_aaaaaaaa-1", ipHash: "h5", userAgent: "Mozilla/5.0 Safari" });
  void nl;
  assert.equal(nl.counted, true);
  assert.equal(nl.credited, false);
  assert.equal(nl.valueCents, 0);
  const after1 = await prisma.subscriber.findUnique({ where: { email: EMAILS[0] } });
  assert.equal(after1?.countedClicks, 1);
  assert.equal(after1?.clickValueCents, 250);
  const adRow = await prisma.emailAd.findUnique({ where: { id: ad.id } });
  assert.equal(adRow?.clicks, 2, "early newsletter click + alert click");
  assert.equal((await prisma.emailAd.findUnique({ where: { id: ad2.id } }))?.clicks, 1, "snippet click counted on its ad");

  // Issues and per-link stats land in NewsletterPost/NewsletterLink; drafts are skipped.
  const posts = await syncNewsletterPosts(prisma, PUB, { fetchImpl: fakeFetch });
  assert.equal(posts, 1);
  const issue = await prisma.newsletterPost.findUnique({ where: { id: "post_test-1" }, include: { links: true } });
  assert.equal(issue?.uniqueClicks, 20);
  assert.equal(issue?.uniqueVerifiedClicks, 10);
  assert.equal(issue?.links.length, 2);
  assert.equal(issue?.links.find((l) => l.baseUrl === "https://track.example.com/a")?.emailUniqueClicks, 15);
  await syncNewsletterPosts(prisma, PUB, { fetchImpl: fakeFetch });
  assert.equal((await prisma.newsletterLink.count({ where: { postId: "post_test-1" } })), 2, "re-sync upserts, no duplicates");
});

test("tracked subscribers: per-email lookup, baseline frozen on first sight, only later clicks count", { skip: !enabled && "TEST_DATABASE_URL not set" }, async () => {
  // Start clean for the tracked user: a fresh app user, no Beehiiv columns yet.
  await prisma.subscriber.deleteMany({ where: { email: USER.email } });
  await syncAppUsers(prisma, () => {}, new Date("2025-01-01T00:00:00Z"));
  live.total_clicked = 9;
  live.total_unique_clicked = 4;
  const first = await syncTrackedSubscribers(prisma, { publications: [PUB], fetchImpl: fakeFetch, now: new Date("2026-09-06T00:00:00Z") });
  assert.deepEqual(first.matched, { beehiiv_si: 1 });
  let row = await prisma.subscriber.findUnique({ where: { email: USER.email } });
  assert.equal(row?.beehiivSiId, "sub_aaaaaaaa-1", "the unrelated row Beehiiv returned was ignored");
  assert.equal(row?.beehiivSiUniqueClicks, 4);
  assert.equal(row?.beehiivSiUniqueClicksBaseline, 4, "first sight freezes the baseline");
  assert.equal(row?.trackingStartedAt?.toISOString(), "2026-09-06T00:00:00.000Z");
  assert.equal(row?.attributionSource, "app", "earlier tagged app signup keeps its attribution");

  // Reader clicks two more links in later issues.
  live.total_clicked = 13;
  live.total_unique_clicked = 6;
  await syncTrackedSubscribers(prisma, { publications: [PUB], fetchImpl: fakeFetch, now: new Date("2026-09-07T00:00:00Z") });
  row = await prisma.subscriber.findUnique({ where: { email: USER.email } });
  assert.equal(row?.beehiivSiUniqueClicks, 6);
  assert.equal(row?.beehiivSiUniqueClicksBaseline, 4, "baseline does not move");
  assert.equal(row?.trackingStartedAt?.toISOString(), "2026-09-06T00:00:00.000Z");
  const { cohortReport } = await import("../lib/subscribers/report");
  const report = await cohortReport(prisma, { month: null, source: null, newsletterValueCents: 250 });
  const cohort = report.find((r) => r.cohortKey === "facebook|(none)|breakouts");
  assert.equal(cohort?.newsletterClicks, 2);
  assert.equal(cohort?.revenueCents, 500 + (cohort?.alertClicks ?? 0) * 0, "2 new unique clicks at $2.50");
});
