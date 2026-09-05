/**
 * A/B Test Configuration
 *
 * Each test has an ID, variants, and a traffic split.
 * Variant assignment is stored in a cookie so users see
 * the same version on return visits.
 */

export interface ABTest {
  id: string;
  variants: string[];
  weights: number[]; // must sum to 1
}

export const ACTIVE_TESTS: Record<string, ABTest> = {
  hero_headline: {
    id: "hero_headline",
    variants: ["A", "B", "C"],
    weights: [0.34, 0.33, 0.33],
  },
};

export const HERO_HEADLINES: Record<string, { line1: string; line2: string; sub: string }> = {
  A: {
    line1: "Stop missing trades.",
    line2: "Start getting context.",
    sub: "Every alert tells you what happened and what pros watch next — not just a price ping. Set up in 60 seconds, free forever.",
  },
  B: {
    line1: "Price alerts tell you what moved.",
    line2: "We tell you what it means.",
    sub: "Every alert includes AI-powered context — what happened, why it matters, and what to watch next. Free forever.",
  },
  // Category-first: names the product before the differentiator, for cold traffic.
  C: {
    line1: "Free stock alerts that",
    line2: "explain themselves.",
    sub: "Set a price, RSI, or volume trigger on any ticker. When it fires, you get an email that tells you what happened and what traders typically watch next — not just a number. 12 alert types, 9 one-click templates, $0 forever.",
  },
};
