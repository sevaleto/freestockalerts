import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_TEMPLATE_SLUGS, isLegacyTemplateSlug, resolveTemplateSlug } from "../lib/templates/redirects";

test("every retired template maps to its replacement", () => {
  assert.deepEqual(LEGACY_TEMPLATE_SLUGS, {
    "earnings-season-alerts": "earnings-calendar-alerts",
    "buffett-style-value-watchlist": "quality-compounders-on-pullback",
    "momentum-breakout-alerts": "quality-breakout-radar",
    "dividend-income-watchlist": "dividend-growth-buy-zones",
    "market-fear-greed-signals": "market-stress-alerts",
    "turnaround-signals": "200-day-comeback-watchlist",
    "oversold-bounce-leaders": "leader-pullback-and-reclaim",
    "sector-rotation-radar": "sector-leadership-radar",
  });
});

test("resolveTemplateSlug follows legacy slugs and leaves current ones alone", () => {
  assert.equal(resolveTemplateSlug("turnaround-signals"), "200-day-comeback-watchlist");
  assert.equal(resolveTemplateSlug("under-the-radar-breakouts"), "under-the-radar-breakouts");
  assert.equal(resolveTemplateSlug("does-not-exist"), "does-not-exist");
  assert.equal(isLegacyTemplateSlug("oversold-bounce-leaders"), true);
  assert.equal(isLegacyTemplateSlug("quality-breakout-radar"), false);
  // Prototype keys are not slugs.
  assert.equal(isLegacyTemplateSlug("constructor"), false);
});
