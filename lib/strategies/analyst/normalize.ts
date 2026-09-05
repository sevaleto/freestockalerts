/**
 * Analyst-action normalization. Research firms use different words for the
 * same view; map them to one tier scale, keep the original wording, and derive
 * the direction from the tiers rather than trusting the provider's "action"
 * word, which is noisy in the cross-symbol feed.
 *
 * Never feed FMP's internally calculated financial rating (ratings-snapshot,
 * rating letters like "B") through here: that is not an analyst action.
 */

export type RatingTier = "STRONG_SELL" | "SELL" | "HOLD" | "BUY" | "STRONG_BUY";
export type Direction = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

const TIER_RANK: Record<RatingTier, number> = { STRONG_SELL: 0, SELL: 1, HOLD: 2, BUY: 3, STRONG_BUY: 4 };

const TIERS: Array<[RegExp, RatingTier]> = [
  [/strong sell|conviction sell/i, "STRONG_SELL"],
  [/strong buy|conviction buy|top pick|speculative buy/i, "STRONG_BUY"],
  [/^(sell|reduce|underweight|underperform|negative|cautious|sector underperform|market underperform|trim)\b/i, "SELL"],
  [/^(buy|outperform|overweight|positive|accumulate|add|market outperform|sector outperform|moderate buy|long-term buy)\b/i, "BUY"],
  [/^(hold|neutral|market perform|sector perform|peer perform|perform|equal[- ]weight|sector weight|in[- ]line|mixed|fair value|market weight)\b/i, "HOLD"],
];

export function normalizeGrade(grade: string | null | undefined): RatingTier | null {
  if (!grade) return null;
  const g = grade.trim();
  if (!g) return null;
  for (const [re, tier] of TIERS) if (re.test(g)) return tier;
  return null;
}

export interface RawAnalystAction {
  symbol?: string;
  date?: string;
  publishedDate?: string;
  gradingCompany?: string;
  previousGrade?: string | null;
  newGrade?: string | null;
  action?: string | null;
  newsURL?: string;
  newsTitle?: string;
  priceWhenPosted?: number;
  [key: string]: unknown;
}

export interface NormalizedAnalystAction {
  symbol: string;
  dedupKey: string;
  firm: string;
  actionDate: string; // YYYY-MM-DD
  previousGrade: string | null;
  newGrade: string | null;
  action: string | null;
  previousTier: RatingTier | null;
  newTier: RatingTier | null;
  direction: Direction;
  /** Previous tier known and the new tier is higher. A reiteration is never a true upgrade. */
  isTrueUpgrade: boolean;
  /** Coverage started with a BUY-or-better rating. */
  isPositiveInitiation: boolean;
  /** Counts toward a cluster: a true upgrade or a positive initiation. */
  isPositiveAction: boolean;
  /** Left buy territory, or fell two tiers or more. Blocks a cluster. */
  isMajorDowngrade: boolean;
  /** Fell one tier but stayed in buy territory (e.g. Strong Buy → Buy). Lowers the score. */
  isMinorDowngrade: boolean;
  sourceUrl: string | null;
  raw: RawAnalystAction;
}

const normalizeActionWord = (a: string | null | undefined) => {
  const s = (a ?? "").toLowerCase();
  if (s.startsWith("init")) return "initiate";
  if (s.startsWith("upgrade")) return "upgrade";
  if (s.startsWith("downgrade")) return "downgrade";
  if (s.startsWith("maintain") || s === "hold" || s.startsWith("reiterat")) return "maintain";
  return s || null;
};

export function normalizeFirm(firm: string | null | undefined): string {
  return (firm ?? "")
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .replace(/\b(llc|inc|co|corp|securities|capital markets|research)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeAnalystAction(raw: RawAnalystAction): NormalizedAnalystAction | null {
  const symbol = (raw.symbol ?? "").trim().toUpperCase();
  const firmRaw = (raw.gradingCompany ?? "").trim();
  const dateSrc = raw.date ?? raw.publishedDate;
  const actionDate = typeof dateSrc === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateSrc) ? dateSrc.slice(0, 10) : null;
  if (!symbol || !firmRaw || !actionDate) return null;

  const previousGrade = raw.previousGrade?.trim() || null;
  const newGrade = raw.newGrade?.trim() || null;
  const previousTier = normalizeGrade(previousGrade);
  const newTier = normalizeGrade(newGrade);
  const action = normalizeActionWord(raw.action);

  const prevRank = previousTier ? TIER_RANK[previousTier] : null;
  const newRank = newTier ? TIER_RANK[newTier] : null;

  const isTrueUpgrade = prevRank !== null && newRank !== null && newRank > prevRank;
  const tierDowngrade = prevRank !== null && newRank !== null && newRank < prevRank;
  const isPositiveInitiation = action === "initiate" && newRank !== null && newRank >= TIER_RANK.BUY && !tierDowngrade;
  const isMajorDowngrade = tierDowngrade && (newRank! <= TIER_RANK.HOLD || prevRank! - newRank! >= 2);
  const isMinorDowngrade = tierDowngrade && !isMajorDowngrade;

  let direction: Direction = "NEUTRAL";
  if (isTrueUpgrade || isPositiveInitiation) direction = "POSITIVE";
  else if (tierDowngrade) direction = "NEGATIVE";
  else if (prevRank === null && newRank === null) {
    // No usable grades at all: fall back to the provider's word.
    if (action === "upgrade") direction = "POSITIVE";
    else if (action === "downgrade") direction = "NEGATIVE";
  }

  const firm = normalizeFirm(firmRaw);
  return {
    symbol,
    dedupKey: [symbol, firm, actionDate, previousGrade ?? "", newGrade ?? ""].join("|"),
    firm: firmRaw,
    actionDate,
    previousGrade,
    newGrade,
    action,
    previousTier,
    newTier,
    direction,
    isTrueUpgrade,
    isPositiveInitiation,
    isPositiveAction: isTrueUpgrade || isPositiveInitiation,
    isMajorDowngrade,
    isMinorDowngrade,
    sourceUrl: typeof raw.newsURL === "string" && raw.newsURL ? raw.newsURL : null,
    raw,
  };
}

/** Same firm under slightly different spellings collapses to one key. */
export const firmKey = (a: Pick<NormalizedAnalystAction, "firm">) => normalizeFirm(a.firm);

export const tierLabel = (t: RatingTier | null) =>
  t === null ? "n/a" : { STRONG_SELL: "Strong Sell", SELL: "Sell", HOLD: "Hold", BUY: "Buy", STRONG_BUY: "Strong Buy" }[t];
