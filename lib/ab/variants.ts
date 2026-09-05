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
    sub: "Set price, RSI, moving-average, volume, or earnings alerts. When one fires, you'll get the trigger, key market data, and plain-English context in your inbox.",
  },
  B: {
    line1: "Price alerts tell you what moved.",
    line2: "We tell you what it means.",
    sub: "Set price, RSI, moving-average, volume, or earnings alerts. When one fires, you'll get the trigger, key market data, and plain-English context in your inbox.",
  },
  // Category-first: names the product before the differentiator, for cold traffic.
  C: {
    line1: "Free stock alerts that",
    line2: "explain themselves.",
    sub: "Set price, RSI, moving-average, volume, or earnings alerts. When one fires, you'll get the trigger, key market data, and plain-English context in your inbox.",
  },
};
