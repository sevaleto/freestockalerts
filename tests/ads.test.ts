/** Email ads: snippet HTML, admin input validation, and the fair rotation. Pure, no DB. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEADLINE_COLORS, renderAdHtml, validateAdInput, type AdInput } from "../lib/ads/template";
import { adState, isServable, pickNextAd, type RotatableAd } from "../lib/ads/rotation";

const NOW = new Date("2026-09-05T21:40:00Z");

const base: AdInput = {
  leadIn: "Special Report",
  headline: "7 Dividend Stocks Paying Up to 9.8%",
  headlineColor: "#1a2b5c",
  body: "First paragraph.\n\nSecond paragraph.",
  ctaText: "Get the free report",
  ctaUrl: "https://www.tradingtips.com/report",
  imageUrl: "https://cdn.example.com/report.png",
};

test("renderAdHtml carries the house style and the tracked click URL", () => {
  const html = renderAdHtml(base, "https://www.freestockalerts.ai/api/ads/click/abc");
  assert.match(html, /Special Report:/);
  assert.match(html, /\(Ad\)/);
  assert.match(html, />Sponsored</);
  assert.match(html, /#f7f7f7/);
  assert.match(html, /color: #1a2b5c/);
  assert.equal((html.match(/https:\/\/www\.freestockalerts\.ai\/api\/ads\/click\/abc/g) ?? []).length, 2, "image and CTA both link through the click URL");
  assert.equal((html.match(/<p /g) ?? []).length, 2, "blank lines split paragraphs");
  assert.match(html, /<img[^>]+width="200"/);
  assert.doesNotMatch(html, /https:\/\/www\.tradingtips\.com\/report/, "raw CTA URL never appears in the email");
});

test("renderAdHtml without an image drops the image column and widens the copy", () => {
  const html = renderAdHtml({ ...base, imageUrl: null }, "https://x.test/c");
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /max-width: 560px/);
});

test("renderAdHtml escapes advertiser text and falls back to a preset color", () => {
  const html = renderAdHtml({ ...base, headline: `<script>alert("x")</script> & "quotes"`, headlineColor: "#ff0000", imageUrl: null }, "https://x.test/c?a=1&b=2");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; &quot;quotes&quot;/);
  assert.match(html, /href="https:\/\/x\.test\/c\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /#ff0000/);
  assert.match(html, new RegExp(HEADLINE_COLORS[0].value));
});

test("validateAdInput accepts a full record and normalizes scheduling and weight", () => {
  const r = validateAdInput({ ...base, name: " Sept campaign ", status: "paused", weight: "3", startAt: "2026-09-01T00:00:00Z", endAt: "2026-09-30T00:00:00.000Z", extra: "ignored" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.input.name, "Sept campaign");
  assert.equal(r.input.status, "paused");
  assert.equal(r.input.weight, 3);
  assert.equal(r.input.startAt, "2026-09-01T00:00:00.000Z");
  assert.equal(r.input.endAt, "2026-09-30T00:00:00.000Z");
  assert.equal("extra" in r.input, false);
});

test("validateAdInput rejects bad input", () => {
  const bad = (over: Record<string, unknown>) => {
    const r = validateAdInput({ ...base, name: "n", ...over });
    assert.equal(r.ok, false, JSON.stringify(over));
    return r.ok ? "" : r.error;
  };
  assert.match(bad({ headline: "" }), /headline/);
  assert.match(bad({ ctaUrl: "javascript:alert(1)" }), /CTA URL/);
  assert.match(bad({ imageUrl: "not a url" }), /Image URL/);
  assert.match(bad({ headlineColor: "#123456" }), /color/);
  assert.match(bad({ startAt: "2026-10-01", endAt: "2026-09-01" }), /End date/);
  const r = validateAdInput({ ...base, name: "n", weight: 500, status: "weird", imageUrl: "" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.input.weight, 1, "out-of-range weight falls back to 1");
    assert.equal(r.input.status, "active");
    assert.equal(r.input.imageUrl, null);
  }
});

const ad = (over: Partial<RotatableAd> & { id: string }): RotatableAd => ({
  status: "active",
  weight: 1,
  impressions: 0,
  startAt: null,
  endAt: null,
  lastShownAt: null,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  ...over,
});

test("isServable honors status and the schedule window", () => {
  assert.equal(isServable(ad({ id: "a" }), NOW), true);
  assert.equal(isServable(ad({ id: "b", status: "paused" }), NOW), false);
  assert.equal(isServable(ad({ id: "c", startAt: new Date("2026-09-06T00:00:00Z") }), NOW), false);
  assert.equal(isServable(ad({ id: "d", endAt: new Date("2026-09-01T00:00:00Z") }), NOW), false);
  assert.equal(isServable(ad({ id: "e", startAt: new Date("2026-09-01T00:00:00Z"), endAt: new Date("2026-09-30T00:00:00Z") }), NOW), true);
  assert.equal(adState(ad({ id: "c", startAt: new Date("2026-09-06T00:00:00Z") }), NOW), "scheduled");
  assert.equal(adState(ad({ id: "d", endAt: new Date("2026-09-01T00:00:00Z") }), NOW), "ended");
  assert.equal(adState(ad({ id: "b", status: "paused" }), NOW), "paused");
});

test("pickNextAd rotates fairly by weight and never starves an ad", () => {
  const ads = [ad({ id: "one", weight: 1 }), ad({ id: "two", weight: 2 }), ad({ id: "paused", status: "paused" })];
  const served: string[] = [];
  for (let i = 0; i < 30; i++) {
    const next = pickNextAd(ads, NOW);
    assert.ok(next);
    if (!next) return;
    served.push(next.id);
    next.impressions += 1;
    next.lastShownAt = new Date(NOW.getTime() + i * 1000);
  }
  const count = (id: string) => served.filter((s) => s === id).length;
  assert.equal(count("paused"), 0);
  assert.equal(count("one"), 10);
  assert.equal(count("two"), 20);
  // Never two of the lighter ad in a row while the heavier one is owed impressions.
  for (let i = 1; i < served.length; i++) assert.ok(!(served[i] === "one" && served[i - 1] === "one"));
});

test("pickNextAd prefers the least recently shown on a tie and returns null with nothing servable", () => {
  const recent = ad({ id: "recent", impressions: 5, lastShownAt: new Date("2026-09-05T20:00:00Z") });
  const stale = ad({ id: "stale", impressions: 5, lastShownAt: new Date("2026-09-05T10:00:00Z") });
  assert.equal(pickNextAd([recent, stale], NOW)?.id, "stale");
  assert.equal(pickNextAd([], NOW), null);
  assert.equal(pickNextAd([ad({ id: "p", status: "paused" })], NOW), null);
});

test("validateAdInput validates the per-click value and treats null/blank as unset", () => {
  const full = { ...base, name: "n" };
  const ok = (over: Record<string, unknown>) => {
    const r = validateAdInput({ ...full, ...over });
    assert.ok(r.ok, JSON.stringify(over));
    return r.ok ? r.input.valueCents : -1;
  };
  const bad = (over: Record<string, unknown>) => {
    const r = validateAdInput({ ...full, ...over });
    assert.equal(r.ok, false, JSON.stringify(over));
    return r.ok ? "" : r.error;
  };
  assert.equal(ok({}), 250, "omitted → default $2.50");
  assert.equal(ok({ valueCents: null }), 250, "null → default, never silently $0");
  assert.equal(ok({ valueCents: "" }), 250);
  assert.equal(ok({ valueCents: 0 }), 0, "$0 is a legal value");
  assert.equal(ok({ valueCents: "300" }), 300, "string from a form is accepted");
  assert.equal(ok({ valueCents: 100_000 }), 100_000);
  assert.match(bad({ valueCents: -1 }), /Value per click/);
  assert.match(bad({ valueCents: 2.5 }), /Value per click/);
  assert.match(bad({ valueCents: 100_001 }), /Value per click/);
  assert.match(bad({ valueCents: "abc" }), /Value per click/);
});
