/**
 * Two-proportion z-test for "is variant B's conversion rate different from A's?".
 * Pure arithmetic; the admin page turns the result into a plain-English label.
 */

export interface ProportionTest {
  /** Conversion rates. */
  rateA: number;
  rateB: number;
  /** Relative lift of B over A (0.1 = +10%); null when A has no conversions. */
  lift: number | null;
  z: number | null;
  /** Two-sided p-value. */
  p: number | null;
  /** 1 - p, as a percentage 0..100; null when there is not enough data. */
  confidence: number | null;
  label: "not enough data" | "no clear difference" | "likely better" | "likely worse" | "significant";
}

/** Minimum conversions per side before the test says anything. */
export const MIN_CONVERSIONS = 30;

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

export function twoProportionZ(convA: number, nA: number, convB: number, nB: number): ProportionTest {
  const rateA = nA > 0 ? convA / nA : 0;
  const rateB = nB > 0 ? convB / nB : 0;
  const lift = rateA > 0 ? rateB / rateA - 1 : null;
  const base: Omit<ProportionTest, "label"> = { rateA, rateB, lift, z: null, p: null, confidence: null };
  if (convA < MIN_CONVERSIONS || convB < MIN_CONVERSIONS || nA === 0 || nB === 0) return { ...base, label: "not enough data" };
  const pooled = (convA + convB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) return { ...base, label: "no clear difference" };
  const z = (rateB - rateA) / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const confidence = Math.max(0, Math.min(100, (1 - p) * 100));
  let label: ProportionTest["label"] = "no clear difference";
  if (p < 0.05) label = "significant";
  else if (p < 0.2) label = z > 0 ? "likely better" : "likely worse";
  return { ...base, z, p, confidence, label };
}
