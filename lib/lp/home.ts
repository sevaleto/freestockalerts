/**
 * Homepage hero headline variants as first seeded (the former A/B/C test).
 * The admin edits the live copy in the LandingPage row with slug "home";
 * this list is the seed source and the fallback when that row is missing.
 * "\n" separates the navy first line from the teal second line.
 */
import type { PageRecord, VariantRecord } from "@/lib/lp/view";
import { HOME_SLUG } from "@/lib/lp/view";

const SUB =
  "Set price, RSI, moving-average, volume, or earnings alerts. When one fires, you'll get the trigger, key market data, and plain-English context in your inbox.";

export const HOME_VARIANTS: VariantRecord[] = [
  { key: "A", headline: "Stop missing trades.\nStart getting context.", subheadline: SUB, weight: 34, isActive: true, views: 0 },
  { key: "B", headline: "Price alerts tell you what moved.\nWe tell you what it means.", subheadline: SUB, weight: 33, isActive: true, views: 0 },
  // Category-first: names the product before the differentiator, for cold traffic.
  { key: "C", headline: "Free stock alerts that\nexplain themselves.", subheadline: SUB, weight: 33, isActive: true, views: 0 },
];

export const HOME_RECORD: PageRecord = {
  id: null,
  slug: HOME_SLUG,
  kind: "HOME",
  status: "LIVE",
  templateSlug: "",
  eyebrow: null,
  logicLine: null,
  bullets: [],
  ctaLabel: null,
  googleLabel: null,
  proofTitle: null,
  disclosure: null,
  afterSignupNote: null,
  sampleAlert: null,
  ogTitle: null,
  ogDescription: null,
  variants: HOME_VARIANTS,
};
