/** Cohort keys, first-touch merging, and click identity rules. Pure. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { attributionFromBeehiiv, cohortKey, cohortLabel, mergeAttribution, EMPTY_ATTRIBUTION, hasRealAttribution } from "../lib/subscribers/cohort";
import { isBotUserAgent, parseChannel, parseToken } from "../lib/subscribers/clicks";
import { adClickUrl, beehiivSnippetHtml } from "../lib/ads/serve";
import type { PrismaClient } from "@prisma/client";
import { beehiivColumns, trackedColumns } from "../lib/subscribers/sync";
import { attributionFromUser } from "../lib/subscribers/cohort";
import { DEFAULT_NEWSLETTER_CLICK_VALUE_CENTS, getNewsletterClickValueCents } from "../lib/settings";
import { newsletterClicksFor, revenueCentsFor } from "../lib/subscribers/report";

const fb = { ...EMPTY_ATTRIBUTION, utmSource: "facebook", utmMedium: "facebook_mobile_reels", utmCampaign: "email only", referringSite: "www.tradingtips.com/5-best-cheap-stocks-to-buy-under-5/" };
const direct = { ...EMPTY_ATTRIBUTION, utmSource: "direct" };

test("cohortKey lowercases, fills blanks, keys untagged signups by landing page, and sanitizes the separator", () => {
  assert.equal(cohortKey(fb), "facebook|facebook_mobile_reels|email only");
  assert.equal(cohortKey(direct), "direct|(none)|(none)");
  assert.equal(cohortKey({ ...EMPTY_ATTRIBUTION, landingPath: "/go/Breakouts" }), "landing:/go/breakouts|(none)|(none)", "no UTM → the landing page is the cohort");
  assert.equal(cohortKey({ ...fb, landingPath: "/go/breakouts" }), "facebook|facebook_mobile_reels|email only", "a UTM source wins over the landing page");
  assert.equal(cohortKey({ ...EMPTY_ATTRIBUTION, utmSource: "a|b", utmCampaign: "x" }), "a/b|(none)|x");
  assert.deepEqual(cohortLabel("facebook|cto|7-high-yield"), { source: "facebook", medium: "cto", campaign: "7-high-yield" });
});

test("Beehiiv 'direct' with nothing else is not real attribution", () => {
  assert.equal(hasRealAttribution(direct), false);
  assert.equal(hasRealAttribution(fb), true);
  const mapped = attributionFromBeehiiv({ id: "sub_1", email: "a@b.co", status: "active", created: 1, utm_source: " facebook ", utm_medium: "", referring_site: "x" });
  assert.equal(mapped.utmSource, "facebook");
  assert.equal(mapped.utmMedium, null);
});

test("mergeAttribution: first tagged signup wins, an untagged earlier source does not", () => {
  const jan = new Date("2026-01-10T00:00:00Z");
  const mar = new Date("2026-03-10T00:00:00Z");
  const fresh = mergeAttribution(null, { source: "beehiiv_si", createdAt: mar, attribution: fb });
  assert.equal(fresh.attributionSource, "beehiiv_si");
  assert.equal(fresh.firstSeenAt, mar);

  // Earlier app signup with no tags: keeps the Facebook attribution, moves firstSeenAt back.
  const withApp = mergeAttribution({ firstSeenAt: mar, attributionSource: "beehiiv_si", ...fb }, { source: "app", createdAt: jan, attribution: EMPTY_ATTRIBUTION });
  assert.equal(withApp.attributionSource, "beehiiv_si");
  assert.equal(withApp.utmSource, "facebook");
  assert.equal(withApp.firstSeenAt, jan);

  // Earlier tagged signup replaces a later tagged one.
  const earlierTagged = mergeAttribution({ firstSeenAt: mar, attributionSource: "beehiiv_si", ...fb }, { source: "app", createdAt: jan, attribution: { ...EMPTY_ATTRIBUTION, utmSource: "facebook", utmCampaign: "breakouts" } });
  assert.equal(earlierTagged.attributionSource, "app");
  assert.equal(earlierTagged.utmCampaign, "breakouts");

  // Later tagged signup does not replace an earlier tagged one.
  const laterTagged = mergeAttribution({ firstSeenAt: jan, attributionSource: "app", ...fb, utmCampaign: "breakouts" }, { source: "beehiiv_si", createdAt: mar, attribution: fb });
  assert.equal(laterTagged.utmCampaign, "breakouts");
});

test("click tokens and channels are validated; unrendered merge tags are dropped", () => {
  assert.equal(parseToken("u_cm1abcdefgh"), "u_cm1abcdefgh");
  assert.equal(parseToken("sub_06807c53-739a-4d8a-a4e6-f709437b0065"), "sub_06807c53-739a-4d8a-a4e6-f709437b0065");
  assert.equal(parseToken("{{api_subscription_id}}"), null);
  assert.equal(parseToken("<script>"), null);
  assert.equal(parseToken(""), null);
  assert.equal(parseChannel("si"), "beehiiv_si");
  assert.equal(parseChannel("fsa"), "beehiiv_fsa");
  assert.equal(parseChannel("alert"), "alert");
  assert.equal(parseChannel("other"), "unknown");
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari"), false);
});

test("tracked URLs carry channel and token; the Beehiiv snippet keeps the merge tag intact", () => {
  assert.equal(adClickUrl("ad1", { channel: "alert", token: "u_x1234567", appUrl: "https://x.test" }), "https://x.test/api/ads/click/ad1?c=alert&s=u_x1234567");
  assert.equal(adClickUrl("ad1", { appUrl: "https://x.test" }), "https://x.test/api/ads/click/ad1");
  const html = beehiivSnippetHtml({ id: "ad1", leadIn: "Special Report", headline: "H", headlineColor: "#1a2b5c", body: "B", ctaText: "Go", ctaUrl: "https://example.com", imageUrl: null }, "si", "https://x.test");
  assert.match(html, /href="https:\/\/x\.test\/api\/ads\/click\/ad1\?c=si&amp;s=\{\{api_subscription_id\}\}"/);
});

test("Beehiiv click stats map onto the subscriber columns and price into revenue", () => {
  const pub = { key: "si", name: "SI", id: "pub_x", source: "beehiiv_si" } as const;
  const cols = beehiivColumns(pub, { id: "sub_1", email: "a@b.co", status: "active", created: 1, stats: { total_clicked: 72, total_unique_clicked: 18 } }, new Date("2026-09-06T00:00:00Z"));
  assert.equal(cols.beehiivSiClicks, 72);
  assert.equal(cols.beehiivSiUniqueClicks, 18);
  assert.ok(cols.beehiivStatsAt);
  const none = beehiivColumns(pub, { id: "sub_2", email: "c@d.co", status: "active", created: 1 });
  assert.equal(none.beehiivSiUniqueClicks, 0);
  assert.equal("beehiivStatsAt" in none, false, "no stats → timestamp untouched");
  // 18 lifetime unique SI clicks, 14 of them before tracking started → 4 count; plus $3.00 of alert clicks.
  const counts = { clickValueCents: 300, beehiivFsaUniqueClicks: 0, beehiivSiUniqueClicks: 18, beehiivFsaUniqueClicksBaseline: 0, beehiivSiUniqueClicksBaseline: 14 };
  assert.equal(newsletterClicksFor(counts), 4);
  assert.equal(revenueCentsFor(counts, 250), 1300);
  // A baseline above the lifetime count (Beehiiv recount) never goes negative.
  assert.equal(newsletterClicksFor({ ...counts, beehiivSiUniqueClicks: 10 }), 0);
});

const settingDb = (value: string | null) => ({ appSetting: { findUnique: async () => (value === null ? null : { key: "k", value }) } }) as unknown as PrismaClient;

test("the newsletter click value falls back to the default for anything but a whole non-negative cent amount", async () => {
  assert.equal(await getNewsletterClickValueCents(settingDb("300")), 300);
  assert.equal(await getNewsletterClickValueCents(settingDb("0")), 0);
  for (const raw of [null, "", "abc", "-5", "2.5", "1e3x"]) assert.equal(await getNewsletterClickValueCents(settingDb(raw)), DEFAULT_NEWSLETTER_CLICK_VALUE_CENTS, String(raw));
});

test("attributionFromUser maps the referrer and derives the landing path from an lp: signup source", () => {
  const u = { utmSource: " Facebook ", utmMedium: null, utmCampaign: "breakouts", utmTerm: null, utmContent: null, referrer: "l.facebook.com", landingPath: null, signupSource: "lp:radar" };
  const a = attributionFromUser(u);
  assert.equal(a.utmSource, "Facebook", "trimmed; cohortKey lowercases later");
  assert.equal(a.referringSite, "l.facebook.com");
  assert.equal(a.landingPath, "/go/radar", "no captured path → landing page slug");
  assert.equal(attributionFromUser({ ...u, landingPath: "/go/breakouts" }).landingPath, "/go/breakouts", "a captured path wins over the slug");
  assert.equal(attributionFromUser({ ...u, signupSource: "hero" }).landingPath, null);
});

test("trackedColumns freezes the baseline on the first tracked sync, even when the Beehiiv id was pre-loaded", () => {
  const pub = { key: "si", name: "SI", id: "pub_x", source: "beehiiv_si" } as const;
  const sub = { id: "sub_1", email: "a@b.co", status: "active", created: 1, stats: { total_clicked: 40, total_unique_clicked: 18 } };
  const now = new Date("2026-09-06T00:00:00Z");
  const fresh = trackedColumns(pub, sub, { trackingStartedAt: null, beehiivFsaId: null, beehiivSiId: null }, now);
  assert.equal(fresh.beehiivSiUniqueClicksBaseline, 18);
  assert.equal(fresh.trackingStartedAt, now);
  // Row mirrored earlier by a full-list pass (id known) but never tracked: still gets its baseline.
  const preloaded = trackedColumns(pub, sub, { trackingStartedAt: null, beehiivFsaId: null, beehiivSiId: "sub_1" }, now);
  assert.equal(preloaded.beehiivSiUniqueClicksBaseline, 18);
  // Already tracked: the baseline is not touched, only the live counts move.
  const later = trackedColumns(pub, { ...sub, stats: { total_clicked: 45, total_unique_clicked: 20 } }, { trackingStartedAt: now, beehiivFsaId: null, beehiivSiId: "sub_1" }, new Date("2026-09-07T00:00:00Z"));
  assert.equal("beehiivSiUniqueClicksBaseline" in later, false);
  assert.equal("trackingStartedAt" in later, false);
  assert.equal(later.beehiivSiUniqueClicks, 20);
});
