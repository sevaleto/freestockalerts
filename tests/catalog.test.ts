import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STRATEGIES,
  SUPPORTED_ALERT_TYPES,
  SECTION_ORDER,
  groupedBySection,
  orderedStrategies,
  getStrategy,
  isRefreshOverdue,
  refreshAgeDays,
} from "../lib/templates/catalog";
import { LEGACY_TEMPLATE_SLUGS } from "../lib/templates/redirects";
import { LANDING_PAGES } from "../lib/lp/pages";

const REQUIRED_TEXT: Array<keyof (typeof STRATEGIES)[number]> = [
  "id",
  "slug",
  "name",
  "valueProposition",
  "description",
  "universe",
  "triggerSummary",
  "refreshCadence",
  "watches",
  "whyInvestorsWatch",
  "methodology",
  "riskSummary",
];

const BANNED = [
  /guaranteed (returns?|winners?|profits?|income|results?)/i,
  /\bguarantee\b(?! future| that| profits| a bounce)/i,
  /easy profits?/i,
  /historically always/i,
  /historically a buying opportunity/i,
  /institutional (buying|money|accumulat)/i,
  /panic selling, not fundamentals/i,
  /funds watch/i,
  /finds? winners/i,
  /beats? the market/i,
  /success rate/i,
  /risk-free/i,
  /\bsecret\b/i,
  /\binsider\b/i,
  /buffett/i,
  /berkshire/i,
];

const allText = (s: (typeof STRATEGIES)[number]) =>
  JSON.stringify({ ...s, items: s.items.map((i) => i.rationale) });

test("catalog has the twelve strategies with unique ids and slugs", () => {
  assert.equal(STRATEGIES.length, 12);
  assert.equal(new Set(STRATEGIES.map((s) => s.slug)).size, 12);
  assert.equal(new Set(STRATEGIES.map((s) => s.id)).size, 12);
  const expected = [
    "post-earnings-strength-radar",
    "quality-breakout-radar",
    "under-the-radar-breakouts",
    "insider-purchase-confirmation",
    "analyst-upgrade-clusters",
    "quality-compounders-on-pullback",
    "leader-pullback-and-reclaim",
    "200-day-comeback-watchlist",
    "dividend-growth-buy-zones",
    "sector-leadership-radar",
    "market-stress-alerts",
    "earnings-calendar-alerts",
  ];
  assert.deepEqual(STRATEGIES.map((s) => s.slug), expected);
});

test("every strategy carries the required metadata", () => {
  for (const s of STRATEGIES) {
    for (const key of REQUIRED_TEXT) {
      assert.ok(typeof s[key] === "string" && (s[key] as string).trim().length > 0, `${s.slug}: ${key}`);
    }
    for (const list of ["qualificationRules", "triggerRules", "disqualifiers", "whenItFails", "related"] as const) {
      assert.ok(Array.isArray(s[list]) && s[list].length > 0, `${s.slug}: ${list}`);
    }
    assert.ok(["IDEA_DISCOVERY", "ENTRY_TIMING", "MARKET_MONITORING"].includes(s.section), s.slug);
    assert.ok(s.version >= 1);
    assert.ok(s.refreshIntervalDays > 0);
    assert.ok(s.landing.eyebrow && s.landing.headline && s.landing.description && s.landing.cta, `${s.slug}: landing copy`);
    assert.ok(s.seo.title.length > 10 && s.seo.title.length <= 70, `${s.slug}: seo title length ${s.seo.title.length}`);
    assert.ok(s.seo.description.length > 50 && s.seo.description.length <= 175, `${s.slug}: seo description length ${s.seo.description.length}`);
    assert.ok(s.sampleAlert.ticker && s.sampleAlert.context, `${s.slug}: sample alert`);
    assert.equal(s.status, "active");
  }
});

test("titles and descriptions are unique across strategies (no thin duplicate pages)", () => {
  assert.equal(new Set(STRATEGIES.map((s) => s.seo.title)).size, STRATEGIES.length);
  assert.equal(new Set(STRATEGIES.map((s) => s.seo.description)).size, STRATEGIES.length);
  assert.equal(new Set(STRATEGIES.map((s) => s.landing.headline)).size, STRATEGIES.length);
  assert.equal(new Set(STRATEGIES.map((s) => s.whenItFails.join("|"))).size, STRATEGIES.length);
});

test("only supported alert types and valid directions are used", () => {
  for (const s of STRATEGIES) {
    for (const item of s.items) {
      assert.ok((SUPPORTED_ALERT_TYPES as readonly string[]).includes(item.alertType), `${s.slug}: ${item.ticker} ${item.alertType}`);
      assert.ok(["ABOVE", "BELOW", "BOTH"].includes(item.triggerDirection));
      assert.ok(Number.isFinite(item.triggerValue));
      assert.ok(/^[\^A-Z.-]{1,6}$/.test(item.ticker), `${s.slug}: ticker ${item.ticker}`);
      if (item.alertType === "SMA_CROSS_ABOVE" || item.alertType === "SMA_CROSS_BELOW") assert.ok([50, 200].includes(item.triggerValue));
      if (item.alertType === "PRICE_ABOVE" || item.alertType === "PRICE_BELOW") assert.ok(item.triggerValue > 0);
    }
  }
});

test("alert counts: ten per stock strategy, eleven sectors, ten market-stress, ten earnings, none for signal strategies", () => {
  const counts = Object.fromEntries(STRATEGIES.map((s) => [s.slug, s.items.length]));
  for (const s of STRATEGIES.filter((x) => x.kind === "signal")) assert.equal(s.items.length, 0, s.slug);
  assert.deepEqual(STRATEGIES.filter((x) => x.kind === "signal").map((x) => x.slug), ["insider-purchase-confirmation", "analyst-upgrade-clusters"]);
  assert.equal(counts["sector-leadership-radar"], 11);
  assert.equal(counts["market-stress-alerts"], 10);
  assert.equal(counts["earnings-calendar-alerts"], 10);
  for (const slug of ["post-earnings-strength-radar", "quality-breakout-radar", "under-the-radar-breakouts", "quality-compounders-on-pullback", "leader-pullback-and-reclaim", "200-day-comeback-watchlist", "dividend-growth-buy-zones"]) {
    assert.equal(counts[slug], 10, slug);
  }
  // No duplicate alerts inside a strategy.
  for (const s of STRATEGIES) {
    const keys = s.items.map((i) => `${i.ticker}|${i.alertType}|${i.triggerValue}`);
    assert.equal(new Set(keys).size, keys.length, `${s.slug} has a duplicate alert`);
  }
});

test("the same company never appears in two screened lists", () => {
  const seen = new Map<string, string>();
  for (const s of STRATEGIES.filter((x) => x.screened)) {
    for (const item of s.items) {
      assert.ok(!seen.has(item.ticker), `${item.ticker} is in both ${seen.get(item.ticker)} and ${s.slug}`);
      seen.set(item.ticker, s.slug);
    }
  }
});

test("VIX alerts use the symbol the data provider recognises", () => {
  const stress = getStrategy("market-stress-alerts")!;
  const vix = stress.items.filter((i) => /vix/i.test(i.ticker));
  assert.ok(vix.length >= 2);
  for (const i of vix) assert.equal(i.ticker, "^VIX");
});

test("sector radar covers all 11 Select Sector SPDRs with a 50-day cross", () => {
  const s = getStrategy("sector-leadership-radar")!;
  assert.deepEqual(
    s.items.map((i) => i.ticker).sort(),
    ["XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"]
  );
  for (const i of s.items) {
    assert.equal(i.alertType, "SMA_CROSS_ABOVE");
    assert.equal(i.triggerValue, 50);
  }
});

test("index grouping: three sections in order, featured idea-discovery strategies first", () => {
  const groups = groupedBySection();
  assert.deepEqual(groups.map((g) => g.section.id), SECTION_ORDER);
  assert.deepEqual(
    groups[0].strategies.slice(0, 3).map((s) => s.slug),
    ["post-earnings-strength-radar", "quality-breakout-radar", "under-the-radar-breakouts"]
  );
  assert.equal(groups.flatMap((g) => g.strategies).length, STRATEGIES.length);
  assert.equal(groups[0].strategies.length, 5, "signal strategies join idea discovery after the featured three");
  assert.deepEqual(orderedStrategies().slice(0, 3).map((s) => s.isFeatured), [true, true, true]);
  for (const g of groups) for (const s of g.strategies) assert.equal(s.section, g.section.id);
});

test("copy avoids performance promises and unsupported claims", () => {
  for (const s of STRATEGIES) {
    const text = allText(s);
    for (const re of BANNED) {
      // "Insider" in its SEC sense (Form 4 corporate insiders) is the subject of one strategy and its related-link text.
      if (String(re) === String(/\binsider\b/i) && ["insider-purchase-confirmation", "analyst-upgrade-clusters"].includes(s.slug)) continue;
      assert.ok(!re.test(text), `${s.slug} matches ${re}`);
    }
  }
  const insider = getStrategy("insider-purchase-confirmation")!;
  assert.ok(!/non-public|inside information|insider (tip|info)/i.test(allText(insider)), "insider strategy never implies non-public information");
});

test("related links point at real strategies and never at themselves", () => {
  for (const s of STRATEGIES) {
    for (const r of s.related) {
      assert.ok(getStrategy(r), `${s.slug} → ${r}`);
      assert.notEqual(r, s.slug);
    }
  }
});

test("legacy slugs all resolve to catalog strategies and never collide with current ones", () => {
  for (const [legacy, target] of Object.entries(LEGACY_TEMPLATE_SLUGS)) {
    assert.ok(getStrategy(target), `${legacy} → ${target}`);
    assert.ok(!getStrategy(legacy), `${legacy} is still a current slug`);
  }
});

test("ad landing pages reference current strategies", () => {
  for (const lp of Object.values(LANDING_PAGES)) {
    assert.ok(getStrategy(lp.templateSlug), `${lp.slug} → ${lp.templateSlug}`);
  }
});

test("refresh timestamps: screened lists carry a real date and the overdue check works", () => {
  const now = new Date("2026-09-06T12:00:00Z");
  for (const s of STRATEGIES) {
    assert.ok(s.lastRefreshedAt, `${s.slug} has no lastRefreshedAt`);
    const age = refreshAgeDays(s, now);
    assert.ok(age !== null && age >= 0 && age <= 60, `${s.slug} refreshed ${age} days before ${now.toISOString()}`);
    assert.equal(isRefreshOverdue(s, now), false, s.slug);
    if (s.screened) {
      assert.ok(s.screened.universeSize > 0);
      assert.ok(s.screened.qualifiedCount >= s.items.length);
    }
  }
  const weekly = getStrategy("leader-pullback-and-reclaim")!;
  assert.equal(isRefreshOverdue(weekly, new Date(new Date(weekly.lastRefreshedAt).getTime() + 8 * 86_400_000)), true);
  assert.equal(isRefreshOverdue({ ...weekly, lastRefreshedAt: "" }), true, "a never-built list is overdue");
});
