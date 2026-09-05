/**
 * Every threshold the event-driven strategies use, in one place. The strategy
 * pages render these numbers, the scan applies them, and the tests exercise
 * them, so a change here moves all three together.
 */

/** Liquidity and size floor shared with the screened watchlists (see lib/templates/screens.ts). */
export const UNIVERSE = {
  marketCapMin: 2e9,
  avgVolumeMin: 1e6,
  /** Sessions used for the "average volume" in confirmations. */
  avgVolumeSessions: 20,
} as const;

export const INSIDER = {
  /** Purchases older than this are ignored. */
  lookbackDays: 30,
  /** shares × price must reach this. */
  minPurchaseValue: 100_000,
  /** "Large relative to existing ownership": shares bought ÷ shares held before ≥ this. */
  bigRelativeToHoldings: 0.1,
  /** Confirmation: within this fraction of the post-purchase high counts when volume is elevated. */
  nearHighPct: 0.03,
  volumeMultiple: 1.5,
  /** One signal per symbol per this many days. */
  cooldownDays: 14,
  /** Signals below this score are not created (0 = every confirmed purchase). */
  minScore: 0,
  /** SEC transaction codes that are genuine open-market purchases. */
  purchaseCodes: ["P"],
  /** Titles that count as senior for scoring. Matched case-insensitively against the officer title. */
  seniorTitlePatterns: [
    /chief executive/i,
    /\bceo\b/i,
    /chief financial/i,
    /\bcfo\b/i,
    /founder/i,
    /president/i,
    /chair/i,
  ],
  /** Officer titles that make an officer a relevant insider (directors always are). */
  relevantOfficerPatterns: [/chief .* officer/i, /\bc[efo]o\b/i, /president/i, /chair/i, /founder/i, /principal (financial|accounting|executive)/i],
  score: {
    breakout: 2,
    nearHighWithVolume: 1,
    multipleInsiders: 2,
    seniorInsider: 2,
    largePurchase: 1,
    largePurchaseValue: 500_000,
    bigRelativeToHoldings: 1,
  },
} as const;

export const ANALYST = {
  lookbackDays: 14,
  /** Independent firms with a positive action required. */
  minFirms: 2,
  /** Actions all inside this many days score higher. */
  tightWindowDays: 7,
  /** Sessions for the "recent high" the price should break. */
  highLookbackSessions: 20,
  nearHighPct: 0.03,
  volumeMultiple: 1.5,
  cooldownDays: 14,
  minScore: 0,
  score: {
    base: 1,
    threeOrMoreFirms: 1,
    tightWindow: 1,
    trueUpgrade: 1,
    breakout: 1,
    volume: 1,
    minorDowngradePenalty: -1,
  },
} as const;

export const INSIDER_SLUG = "insider-purchase-confirmation";
export const ANALYST_SLUG = "analyst-upgrade-clusters";

export const MAX_SCORE = {
  insider: INSIDER.score.breakout + INSIDER.score.multipleInsiders + INSIDER.score.seniorInsider + INSIDER.score.largePurchase + INSIDER.score.bigRelativeToHoldings,
  analyst: ANALYST.score.base + ANALYST.score.threeOrMoreFirms + ANALYST.score.tightWindow + ANALYST.score.trueUpgrade + ANALYST.score.breakout + ANALYST.score.volume,
} as const;
