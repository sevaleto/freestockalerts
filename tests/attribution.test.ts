/** First-touch attribution parsing (browser URL → server columns). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { attributionFromUrl, parseAttribution } from "../lib/tracking/attribution";

test("attributionFromUrl reads UTM and fbclid and records the landing path and referrer host", () => {
  const a = attributionFromUrl(new URL("https://www.freestockalerts.ai/go/breakouts?utm_source=facebook&utm_medium=reels&utm_campaign=breakouts-sept&fbclid=IwAR123&x=1"), "https://l.facebook.com/l.php?u=x");
  assert.deepEqual(a, { utmSource: "facebook", utmMedium: "reels", utmCampaign: "breakouts-sept", fbclid: "IwAR123", landingPath: "/go/breakouts", referrer: "l.facebook.com" });
});

test("attributionFromUrl returns nothing for an untagged URL", () => {
  assert.deepEqual(attributionFromUrl(new URL("https://www.freestockalerts.ai/?ref=abc"), "https://google.com"), {});
});

test("parseAttribution accepts only known string keys and caps their length", () => {
  const long = "x".repeat(500);
  const parsed = parseAttribution({ utmSource: " facebook ", utmMedium: long, evil: "1", fbclid: 42 });
  assert.deepEqual(parsed, { utmSource: "facebook", utmMedium: "x".repeat(120) });
  assert.equal(parseAttribution("nope"), null);
  assert.equal(parseAttribution({}), null);
});
