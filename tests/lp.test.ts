/** Landing pages and headline split tests: assignment, validation, reporting math, static → record mapping. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVariant, hash32 } from "../lib/ab/pick";
import { twoProportionZ, normalCdf } from "../lib/ab/stats";
import { bucketFromCookie, isPageSlug, isVariantTag, parseVariantTag, BUCKET_MAX } from "../lib/cookies/bucket";
import { validateLandingPageInput, validateVariantInput, validateSampleAlert, complianceWarnings, nextVariantKey } from "../lib/lp/validate";
import { toView, recordFromStatic, heroHeadline, DEFAULTS, firstLine } from "../lib/lp/view";
import { seedRecords } from "../lib/lp/seed";
import { HOME_VARIANTS } from "../lib/lp/home";
import { LANDING_PAGES } from "../lib/lp/pages";
import { getStrategy } from "../lib/templates/catalog";
import { variantStats, pageTotals } from "../lib/lp/report";

const variants = (weights: number[], inactive: string[] = []) =>
  weights.map((weight, i) => ({ key: String.fromCharCode(65 + i), weight, isActive: !inactive.includes(String.fromCharCode(65 + i)) }));

test("pickVariant is deterministic per bucket and salt", () => {
  const vs = variants([1, 1, 1]);
  for (let b = 0; b < 200; b++) {
    assert.equal(pickVariant(vs, b, "radar")?.key, pickVariant(vs, b, "radar")?.key);
  }
  assert.ok(hash32("a") !== hash32("b"));
});

test("pickVariant honors weights across the whole bucket space", () => {
  const vs = variants([50, 30, 20]);
  const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (let b = 0; b < BUCKET_MAX; b++) counts[pickVariant(vs, b, "home")!.key]++;
  const share = (k: string) => counts[k] / BUCKET_MAX;
  assert.ok(Math.abs(share("A") - 0.5) < 0.03, `A ${share("A")}`);
  assert.ok(Math.abs(share("B") - 0.3) < 0.03, `B ${share("B")}`);
  assert.ok(Math.abs(share("C") - 0.2) < 0.03, `C ${share("C")}`);
});

test("pickVariant skips inactive and zero-weight variants, falls back sanely", () => {
  const vs = variants([1, 0, 1], ["C"]);
  for (let b = 0; b < 500; b++) assert.equal(pickVariant(vs, b, "x")?.key, "A");
  assert.equal(pickVariant(variants([0, 0]), 7, "x")?.key, "A", "all paused → first variant");
  assert.equal(pickVariant([], 7, "x"), null);
  assert.equal(pickVariant(variants([1, 1]), null, "x", () => 0.99)?.key, "B", "no bucket → random");
});

test("assignments on different pages are independent", () => {
  const vs = variants([1, 1]);
  let same = 0;
  for (let b = 0; b < 2000; b++) if (pickVariant(vs, b, "home")?.key === pickVariant(vs, b, "radar")?.key) same++;
  assert.ok(same > 800 && same < 1200, `agreement ${same}/2000 should look like a coin flip`);
});

test("bucket and variant cookie parsing", () => {
  assert.equal(bucketFromCookie("0"), 0);
  assert.equal(bucketFromCookie("9999"), 9999);
  assert.equal(bucketFromCookie("10000"), null);
  assert.equal(bucketFromCookie("abc"), null);
  assert.equal(bucketFromCookie(undefined), null);
  assert.ok(isPageSlug("breakouts-v2"));
  assert.ok(!isPageSlug("Breakouts"));
  assert.ok(!isPageSlug("-bad"));
  assert.ok(!isPageSlug("a"));
  assert.ok(isVariantTag("home:B"));
  assert.ok(isVariantTag("under-the-radar:A"));
  assert.ok(!isVariantTag("home:b"));
  assert.ok(!isVariantTag("hero_headline:A"));
  assert.ok(!isVariantTag("home"));
  assert.deepEqual(parseVariantTag("radar:C"), { slug: "radar", key: "C" });
});

test("toSignupSource accepts any well-formed lp:<slug>, not just the built-in pages", async () => {
  // lib/auth/users pulls in the Resend client, which insists on a key at import time.
  process.env.RESEND_API_KEY ||= "re_test_placeholder";
  const { toSignupSource } = await import("../lib/auth/users");
  assert.equal(toSignupSource("lp:radar"), "lp:radar");
  assert.equal(toSignupSource("lp:new-angle-2"), "lp:new-angle-2");
  assert.equal(toSignupSource("lp:Bad Slug"), "unknown");
  assert.equal(toSignupSource("hero"), "hero");
});

test("validateLandingPageInput: slug, strategy, variants", () => {
  const good = {
    slug: "momentum-v2",
    status: "live",
    templateSlug: "quality-breakout-radar",
    bullets: "one\n\ntwo\n",
    variants: [
      { key: "b", headline: "Second", subheadline: "Sub B", weight: "50", isActive: "true" },
      { key: "A", headline: "First\r\nline", subheadline: "Sub A", weight: 50 },
    ],
  };
  const ok = validateLandingPageInput(good);
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.equal(ok.input.status, "LIVE");
  assert.deepEqual(ok.input.bullets, ["one", "two"]);
  assert.deepEqual(ok.input.variants.map((v) => v.key), ["A", "B"], "sorted by key");
  assert.equal(ok.input.variants[0].headline, "First\nline");
  assert.equal(ok.input.variants[1].weight, 50);
  assert.equal(ok.input.eyebrow, null);

  const fail = (data: Record<string, unknown>, re: RegExp) => {
    const r = validateLandingPageInput(data);
    assert.ok(!r.ok && re.test(r.error), `${JSON.stringify(data).slice(0, 80)} → ${r.ok ? "ok" : r.error}`);
  };
  fail({ ...good, slug: "home" }, /reserved/);
  fail({ ...good, slug: "Bad_Slug" }, /Slug/);
  fail({ ...good, templateSlug: "nope" }, /Unknown strategy/);
  fail({ ...good, templateSlug: "" }, /Pick a strategy/);
  fail({ ...good, variants: [] }, /At least one/);
  fail({ ...good, variants: [good.variants[0], good.variants[0]] }, /Duplicate/);
  fail({ ...good, variants: [{ key: "A", headline: "", subheadline: "x" }] }, /headline is required/);
  fail({ ...good, variants: [{ key: "A", headline: "h", subheadline: "x", weight: 101 }] }, /weight/);
  fail({ ...good, sampleAlert: { ticker: "X" } }, /Sample alert/);

  // Editing: slug and kind come from the row; HOME ignores the strategy.
  const home = validateLandingPageInput({ variants: good.variants }, { existing: { slug: "home", kind: "HOME" } });
  assert.ok(home.ok && home.input.slug === "home" && home.input.kind === "HOME" && home.input.templateSlug === "");
});

test("validateVariantInput and validateSampleAlert edge cases", () => {
  const v = validateVariantInput({ key: "c", headline: " Hi ", subheadline: "there", weight: 0 });
  assert.ok(v.ok && v.input.key === "C" && v.input.headline === "Hi" && v.input.weight === 0 && v.input.isActive);
  assert.ok(!validateVariantInput({ key: "AB", headline: "h", subheadline: "s" }).ok);
  assert.deepEqual(validateSampleAlert(null), { ok: true, sample: null });
  const sample = validateSampleAlert({ ...LANDING_PAGES.radar.sampleAlert, volumeMultiple: "1.6", extra: "dropped" });
  assert.ok(sample.ok && sample.sample && sample.sample.volumeMultiple === 1.6 && !("extra" in sample.sample));
  assert.ok(!validateSampleAlert([]).ok);
});

test("compliance warnings flag the banned words without blocking", () => {
  assert.deepEqual(complianceWarnings("Guaranteed returns, risk-free"), ["guaranteed", "guarantee", "risk-free"]);
  assert.deepEqual(complianceWarnings("Free alerts that explain themselves"), []);
  assert.equal(nextVariantKey(["A", "B"]), "C");
  assert.equal(nextVariantKey(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))), null);
});

test("twoProportionZ: not enough data, significant, and no difference", () => {
  assert.equal(twoProportionZ(5, 100, 9, 100).label, "not enough data");
  const sig = twoProportionZ(50, 1000, 90, 1000);
  assert.equal(sig.label, "significant");
  assert.ok(sig.lift !== null && Math.abs(sig.lift - 0.8) < 1e-9);
  assert.ok(sig.p !== null && sig.p < 0.01);
  const flat = twoProportionZ(50, 1000, 52, 1000);
  assert.equal(flat.label, "no clear difference");
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
});

test("static pages and the homepage map onto records and views", () => {
  const records = seedRecords();
  assert.equal(records.length, 1 + Object.keys(LANDING_PAGES).length);
  assert.equal(records[0].slug, "home");
  assert.equal(records[0].variants.length, HOME_VARIANTS.length);
  for (const r of records.slice(1)) {
    assert.equal(r.variants.length, 1);
    assert.equal(r.variants[0].key, "A");
    assert.ok(getStrategy(r.templateSlug), `${r.slug} → ${r.templateSlug}`);
  }

  const radar = recordFromStatic(LANDING_PAGES.radar);
  const view = toView(radar, radar.variants[0], getStrategy(radar.templateSlug));
  assert.equal(view.source, "lp:radar");
  assert.equal(view.metaContentName, "lp_radar");
  assert.equal(view.variantTag, "radar:A");
  assert.equal(view.headline, LANDING_PAGES.radar.headline);
  assert.equal(view.ogTitle, LANDING_PAGES.radar.ogTitle);

  // A bare page (only slug + strategy + one variant) still renders complete copy.
  const strategy = getStrategy("quality-breakout-radar")!;
  const bare = { ...radar, slug: "bare", templateSlug: strategy.slug, eyebrow: null, logicLine: null, bullets: [], ctaLabel: null, googleLabel: null, proofTitle: null, disclosure: null, afterSignupNote: null, sampleAlert: null, ogTitle: null, ogDescription: null, variants: [{ key: "B", headline: "Only\nvariant", subheadline: "Sub", weight: 1, isActive: true, views: 0 }] };
  const bareView = toView(bare, bare.variants[0], strategy);
  assert.equal(bareView.eyebrow, DEFAULTS.eyebrow);
  assert.equal(bareView.ctaLabel, DEFAULTS.ctaLabel);
  assert.equal(bareView.logicLine, strategy.valueProposition);
  assert.deepEqual(bareView.bullets, strategy.triggerRules.slice(0, 3));
  assert.equal(bareView.sampleAlert.ticker, strategy.sampleAlert.ticker);
  assert.equal(bareView.ogTitle, firstLine("Only\nvariant"));
  assert.equal(bareView.variantTag, "bare:B");

  const hero = heroHeadline("home", HOME_VARIANTS[0]);
  assert.equal(hero.line1, "Stop missing trades.");
  assert.equal(hero.line2, "Start getting context.");
  assert.equal(hero.variantTag, "home:A");
});

test("variantStats joins views with lead counts and compares against A", () => {
  const vs = [
    { key: "A", headline: "", subheadline: "", weight: 1, isActive: true, views: 1000 },
    { key: "B", headline: "", subheadline: "", weight: 1, isActive: true, views: 1000 },
  ];
  const counts = new Map([
    ["radar:A", { leads: 50, confirmed: 30 }],
    ["radar:B", { leads: 90, confirmed: 60 }],
  ]);
  const stats = variantStats("radar", vs, counts);
  assert.equal(stats[0].vsControl, null);
  assert.equal(stats[0].conversion, 0.05);
  assert.equal(stats[1].vsControl?.label, "significant");
  const totals = pageTotals(stats);
  assert.deepEqual({ views: totals.views, leads: totals.leads, confirmed: totals.confirmed }, { views: 2000, leads: 140, confirmed: 90 });
});
