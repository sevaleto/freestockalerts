/**
 * Qualification screens for the data-driven strategies.
 *
 * One source of truth for the numbers: `scripts/refresh-strategies.ts` applies
 * these rules to live FMP data to build each strategy's constituent list, the
 * strategy pages render the same rules as "How companies qualify", and the
 * tests re-check every stored constituent against them using the point-in-time
 * snapshot saved with it. Change a threshold here and all three move together.
 *
 * Every rule is explicit about missing data: `fail` keeps a name out of the list
 * when the field is unavailable (conservative), `skip` leaves the rule unapplied
 * (used only where the metric is meaningless, e.g. net debt / EBITDA for banks).
 */

export type ScreenedSlug =
  | "post-earnings-strength-radar"
  | "quality-breakout-radar"
  | "under-the-radar-breakouts"
  | "quality-compounders-on-pullback"
  | "leader-pullback-and-reclaim"
  | "200-day-comeback-watchlist"
  | "dividend-growth-buy-zones";

export interface Fundamentals {
  /** Trailing free-cash-flow yield (FCF / market cap). > 0 means positive FCF. */
  fcfYield?: number | null;
  /** Latest fiscal-year revenue growth, fraction. */
  revenueGrowth?: number | null;
  /** Latest fiscal-year net-income growth, fraction. */
  netIncomeGrowth?: number | null;
  /** Fiscal year the growth figures refer to. */
  growthFiscalYear?: string | null;
  /** Net debt / EBITDA (TTM). Negative = net cash. */
  netDebtToEbitda?: number | null;
  netProfitMargin?: number | null;
  currentRatio?: number | null;
  interestCoverage?: number | null;
  /** Fiscal years (of the last three) with positive net income. */
  positiveNetIncomeYears?: number | null;
  /** Dividend payout ratio on earnings (TTM), fraction. */
  payoutRatio?: number | null;
}

export interface EarningsSnapshot {
  /** Report date, YYYY-MM-DD. */
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  /** Session whose move is treated as the reaction (the report date, or the next session for after-close reports). */
  reactionDate: string;
  /** Close-to-close move on the reaction day, fraction. */
  reactionPct: number;
  /** Reaction-day volume / average of the 30 prior sessions. */
  reactionVolumeRatio: number;
  /** Intraday high of the reaction day. */
  reactionHigh: number;
  /** Close of the session before the reaction day. */
  preReportClose: number;
}

export interface DividendSnapshot {
  /** Latest regular payment × payments per year. */
  forwardAnnual: number;
  paymentsPerYear: number;
  /** forwardAnnual / current price, fraction. */
  yieldNow: number;
  /** 80th percentile of the yield at each ex-date over the last five years, fraction. */
  yieldP80: number;
  /** Consecutive calendar years (ending last year) in which the annual payout rose. */
  growthYears: number;
  /** True when the streak reached the start of the available history (so the real streak may be longer). */
  growthYearsCapped?: boolean;
  /** Latest payment lower than the payment one year earlier. */
  recentCut: boolean;
  /** Dividends paid / free cash flow, latest fiscal year, fraction. */
  fcfPayout?: number | null;
  /** Price at which the forward yield equals yieldP80. */
  buyZonePrice: number;
}

/** Everything a rule can look at, captured when the list was built. */
export interface Snapshot {
  symbol: string;
  companyName: string;
  sector?: string | null;
  marketCap: number;
  avgVolume: number;
  price: number;
  sma50?: number | null;
  sma200?: number | null;
  yearHigh: number;
  yearLow: number;
  rsi?: number | null;
  /** Sessions (of the last 60) that closed below the 200-day average. */
  sessionsBelow200Of60?: number | null;
  /** Latest reported quarter: (epsActual - epsEstimated) / |epsEstimated|. */
  lastQuarterEpsSurprise?: number | null;
  fundamentals?: Fundamentals | null;
  earnings?: EarningsSnapshot | null;
  dividend?: DividendSnapshot | null;
}

export type RuleResult = true | false | "n/a";

export interface ScreenRule {
  id: string;
  /** Plain-English rule, shown on the strategy page. */
  label: string;
  whenUnavailable: "fail" | "skip";
  test: (s: Snapshot) => RuleResult;
}

export interface TriggerSpec {
  alertType: "PRICE_ABOVE" | "PRICE_BELOW" | "FIFTY_TWO_WEEK_HIGH" | "SMA_CROSS_ABOVE";
  triggerValue: number;
  triggerDirection: "ABOVE" | "BELOW";
}

export interface UniverseSpec {
  label: string;
  marketCapMin: number;
  marketCapMax?: number;
  avgVolumeMin: number;
  /** Only companies that pay a dividend. */
  requiresDividend?: boolean;
}

export interface ScreenDefinition {
  slug: ScreenedSlug;
  universe: UniverseSpec;
  rules: ScreenRule[];
  /** Data the refresh script must fetch beyond the quote. */
  needs: {
    fundamentals?: boolean;
    growth?: boolean;
    incomeHistory?: boolean;
    earnings?: boolean;
    lastQuarter?: boolean;
    dividends?: boolean;
    rsi?: boolean;
    sma200History?: boolean;
  };
  /** Higher first. */
  rank: (s: Snapshot) => number;
  /** Optional override of "take the top N" after ranking. */
  select?: (ranked: Snapshot[], pick: number) => Snapshot[];
  /** The alert to create for a qualifying name, or null to leave it out. */
  trigger: (s: Snapshot) => TriggerSpec | null;
  /** Fact-only sentence stored as the alert's note. */
  rationale: (s: Snapshot) => string;
  pick: number;
}

const FINANCIALS = new Set(["Financial Services"]);
const isFinancial = (s: Snapshot) => !!s.sector && FINANCIALS.has(s.sector);

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/* ----------------------------- shared rules ------------------------------ */

const aboveBothAverages: ScreenRule = {
  id: "above-50-200",
  label: "Price above both its 50-day and 200-day moving averages",
  whenUnavailable: "fail",
  test: (s) => (num(s.sma50) && num(s.sma200) ? s.price > s.sma50 && s.price > s.sma200 : "n/a"),
};

const positiveFcf: ScreenRule = {
  id: "positive-fcf",
  label: "Positive trailing free cash flow",
  whenUnavailable: "fail",
  test: (s) => (num(s.fundamentals?.fcfYield) ? s.fundamentals!.fcfYield! > 0 : "n/a"),
};

const manageableLeverage = (max: number): ScreenRule => ({
  id: "leverage",
  label: `Net debt under ${max}× EBITDA, or net cash (not applied to banks and insurers)`,
  whenUnavailable: "skip",
  test: (s) => {
    if (isFinancial(s)) return "n/a";
    return num(s.fundamentals?.netDebtToEbitda) ? s.fundamentals!.netDebtToEbitda! < max : "n/a";
  },
});

const noBigMissLastQuarter: ScreenRule = {
  id: "no-big-miss",
  label: "Most recent reported quarter did not miss the EPS estimate by more than 10% (a proxy for obvious impairment; guidance data is not available)",
  whenUnavailable: "fail",
  test: (s) => (num(s.lastQuarterEpsSurprise) ? s.lastQuarterEpsSurprise! >= -0.1 : "n/a"),
};

const pct = (f: number, digits = 1) => `${f >= 0 ? "+" : "−"}${Math.abs(f * 100).toFixed(digits)}%`;
const pctAbs = (f: number, digits = 1) => `${Math.abs(f * 100).toFixed(digits)}%`;
const usd = (v: number) => (v < 0 ? `−$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`);
const mult = (v: number) => `${v.toFixed(1)}×`;
const shortDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`;
};

const offHigh = (s: Snapshot) => 1 - s.price / s.yearHigh;
const cap = (v: number) => (v >= 1e12 ? `$${(v / 1e12).toFixed(1)}T` : `$${(v / 1e9).toFixed(v >= 1e11 ? 0 : 1)}B`);
const sectorWord = (s: Snapshot) => (s.sector ? `${s.sector.toLowerCase().replace("financial services", "financial-services")} company` : "company");

/* ------------------------------ definitions ------------------------------ */

export const SCREENS: Record<ScreenedSlug, ScreenDefinition> = {
  "post-earnings-strength-radar": {
    slug: "post-earnings-strength-radar",
    universe: {
      label: "US-listed common stocks on the NYSE or Nasdaq with a market cap above $2 billion and average volume above 1 million shares",
      marketCapMin: 2e9,
      avgVolumeMin: 1e6,
    },
    needs: { earnings: true },
    rules: [
      {
        id: "reported-recently",
        label: "Reported quarterly results within the last 45 days",
        whenUnavailable: "fail",
        test: (s) => (s.earnings ? true : "n/a"),
      },
      {
        id: "beat-both",
        label: "Reported EPS and revenue both above the consensus estimate",
        whenUnavailable: "fail",
        test: (s) => {
          const e = s.earnings;
          if (!e || !num(e.epsActual) || !num(e.epsEstimated) || !num(e.revenueActual) || !num(e.revenueEstimated)) return "n/a";
          return e.epsActual > e.epsEstimated && e.revenueActual > e.revenueEstimated;
        },
      },
      {
        id: "positive-reaction",
        label: "Rose at least 3% on the reaction day",
        whenUnavailable: "fail",
        test: (s) => (s.earnings ? s.earnings.reactionPct >= 0.03 : "n/a"),
      },
      {
        id: "reaction-volume",
        label: "Reaction-day volume at least 1.5× the prior 30-session average",
        whenUnavailable: "fail",
        test: (s) => (s.earnings ? s.earnings.reactionVolumeRatio >= 1.5 : "n/a"),
      },
      {
        id: "held-gains",
        label: "Still trading above its pre-report close",
        whenUnavailable: "fail",
        test: (s) => (s.earnings ? s.price > s.earnings.preReportClose : "n/a"),
      },
      aboveBothAverages,
    ],
    rank: (s) => s.earnings?.reactionPct ?? 0,
    trigger: (s) => {
      if (!s.earnings) return null;
      // Nearest pending event: the earnings-day high if still below it, otherwise a fresh 52-week high.
      if (s.price < s.earnings.reactionHigh) {
        return { alertType: "PRICE_ABOVE", triggerValue: round2(s.earnings.reactionHigh), triggerDirection: "ABOVE" };
      }
      return { alertType: "FIFTY_TWO_WEEK_HIGH", triggerValue: 0, triggerDirection: "ABOVE" };
    },
    rationale: (s) => {
      const e = s.earnings!;
      const eps = num(e.epsActual) && num(e.epsEstimated) ? `EPS ${usd(e.epsActual)} vs ${usd(e.epsEstimated)} estimate` : "beat on EPS";
      const rev = num(e.revenueActual) && num(e.revenueEstimated) ? `revenue ${pct(e.revenueActual / e.revenueEstimated - 1)} vs estimate` : "beat on revenue";
      return `Reported ${shortDate(e.date)}: ${eps}, ${rev}. ${pct(e.reactionPct)} on ${mult(e.reactionVolumeRatio)} volume on the reaction day; earnings-day high ${usd(e.reactionHigh)}.`;
    },
    pick: 10,
  },

  "quality-breakout-radar": {
    slug: "quality-breakout-radar",
    universe: {
      label: "US-listed common stocks with a market cap above $5 billion and average volume above 1 million shares",
      marketCapMin: 5e9,
      avgVolumeMin: 1e6,
    },
    needs: { fundamentals: true, growth: true },
    rules: [
      positiveFcf,
      {
        id: "growth",
        label: "Revenue or net income grew in the latest fiscal year",
        whenUnavailable: "fail",
        test: (s) => {
          const f = s.fundamentals;
          if (!f || (!num(f.revenueGrowth) && !num(f.netIncomeGrowth))) return "n/a";
          return (num(f.revenueGrowth) && f.revenueGrowth > 0) || (num(f.netIncomeGrowth) && f.netIncomeGrowth > 0);
        },
      },
      manageableLeverage(3),
      aboveBothAverages,
      {
        id: "near-high",
        label: "Within 5% of its 52-week high",
        whenUnavailable: "fail",
        test: (s) => (s.yearHigh > 0 ? s.price >= 0.95 * s.yearHigh : "n/a"),
      },
    ],
    rank: (s) => s.price / s.yearHigh,
    trigger: () => ({ alertType: "FIFTY_TWO_WEEK_HIGH", triggerValue: 0, triggerDirection: "ABOVE" }),
    rationale: (s) => {
      const f = s.fundamentals!;
      const growth = num(f.revenueGrowth) && f.revenueGrowth > 0 ? `revenue ${pct(f.revenueGrowth)}` : `net income ${pct(f.netIncomeGrowth ?? 0)}`;
      const lev = isFinancial(s) || !num(f.netDebtToEbitda) ? "" : f.netDebtToEbitda < 0 ? ", net cash" : `, net debt ${mult(f.netDebtToEbitda)} EBITDA`;
      return `${pctAbs(offHigh(s))} below its 52-week high and above both moving averages. FCF yield ${pctAbs(f.fcfYield!)}, ${growth} in FY${f.growthFiscalYear ?? ""}${lev}.`;
    },
    pick: 10,
  },

  "under-the-radar-breakouts": {
    slug: "under-the-radar-breakouts",
    universe: {
      label: "US-listed mid-caps ($2–20 billion) with average volume above 1.5 million shares",
      marketCapMin: 2e9,
      marketCapMax: 20e9,
      avgVolumeMin: 1.5e6,
    },
    needs: { fundamentals: true },
    rules: [
      aboveBothAverages,
      {
        id: "near-high",
        label: "Within 8% of its 52-week high",
        whenUnavailable: "fail",
        test: (s) => (s.yearHigh > 0 ? s.price >= 0.92 * s.yearHigh : "n/a"),
      },
      {
        id: "off-low",
        label: "At least 30% above its 52-week low (an established uptrend, not a one-day pop)",
        whenUnavailable: "fail",
        test: (s) => (s.yearLow > 0 ? s.price >= 1.3 * s.yearLow : "n/a"),
      },
      positiveFcf,
      {
        id: "profitable",
        label: "Positive trailing net profit margin",
        whenUnavailable: "fail",
        test: (s) => (num(s.fundamentals?.netProfitMargin) ? s.fundamentals!.netProfitMargin! > 0 : "n/a"),
      },
      manageableLeverage(3),
    ],
    rank: (s) => s.price / s.yearHigh,
    trigger: () => ({ alertType: "FIFTY_TWO_WEEK_HIGH", triggerValue: 0, triggerDirection: "ABOVE" }),
    rationale: (s) => {
      const f = s.fundamentals!;
      const lev = isFinancial(s) || !num(f.netDebtToEbitda) ? "" : f.netDebtToEbitda < 0 ? ", net cash" : `, net debt ${mult(f.netDebtToEbitda)} EBITDA`;
      return `${cap(s.marketCap)} ${sectorWord(s)}, ${pctAbs(offHigh(s))} below its 52-week high and ${pctAbs(s.price / s.yearLow - 1, 0)} above its low. FCF yield ${pctAbs(f.fcfYield!)}, net margin ${pctAbs(f.netProfitMargin!)}${lev}.`;
    },
    pick: 10,
  },

  "quality-compounders-on-pullback": {
    slug: "quality-compounders-on-pullback",
    universe: {
      label: "US-listed large caps ($20 billion and up) with average volume above 1 million shares",
      marketCapMin: 20e9,
      avgVolumeMin: 1e6,
    },
    needs: { fundamentals: true, growth: true, incomeHistory: true, lastQuarter: true },
    rules: [
      positiveFcf,
      {
        id: "durable-record",
        label: "Profitable in each of the last three fiscal years, with revenue growth in the latest",
        whenUnavailable: "fail",
        test: (s) => {
          const f = s.fundamentals;
          if (!f || !num(f.positiveNetIncomeYears) || !num(f.revenueGrowth)) return "n/a";
          return f.positiveNetIncomeYears >= 3 && f.revenueGrowth > 0;
        },
      },
      manageableLeverage(3),
      {
        id: "pullback",
        label: "12% to 30% below its 52-week high",
        whenUnavailable: "fail",
        test: (s) => (s.yearHigh > 0 ? offHigh(s) >= 0.12 && offHigh(s) <= 0.3 : "n/a"),
      },
      {
        id: "trend-intact",
        label: "Within 8% of, or above, its 200-day moving average",
        whenUnavailable: "fail",
        test: (s) => (num(s.sma200) ? s.price >= 0.92 * s.sma200 : "n/a"),
      },
      {
        id: "below-50",
        label: "Currently below its 50-day moving average, so the reclaim is still ahead",
        whenUnavailable: "fail",
        test: (s) => (num(s.sma50) ? s.price < s.sma50 : "n/a"),
      },
      noBigMissLastQuarter,
    ],
    rank: (s) => s.fundamentals?.fcfYield ?? 0,
    trigger: () => ({ alertType: "SMA_CROSS_ABOVE", triggerValue: 50, triggerDirection: "ABOVE" }),
    rationale: (s) => {
      const f = s.fundamentals!;
      const lev = isFinancial(s) || !num(f.netDebtToEbitda) ? "" : f.netDebtToEbitda < 0 ? ", net cash" : `, net debt ${mult(f.netDebtToEbitda)} EBITDA`;
      return `${pctAbs(offHigh(s))} below its 52-week high and ${pctAbs(1 - s.price / s.sma50!)} under its 50-day average. FCF yield ${pctAbs(f.fcfYield!)}, revenue ${pct(f.revenueGrowth!)} in FY${f.growthFiscalYear ?? ""}, profitable three straight years${lev}.`;
    },
    pick: 10,
  },

  "leader-pullback-and-reclaim": {
    slug: "leader-pullback-and-reclaim",
    universe: {
      label: "US-listed companies with a market cap above $50 billion and average volume above 2 million shares",
      marketCapMin: 50e9,
      avgVolumeMin: 2e6,
    },
    needs: { rsi: true, lastQuarter: true },
    rules: [
      {
        id: "above-200",
        label: "Price above its 200-day moving average (medium-term trend still up)",
        whenUnavailable: "fail",
        test: (s) => (num(s.sma200) ? s.price > s.sma200 : "n/a"),
      },
      {
        id: "pullback-8-20",
        label: "8% to 20% below its 52-week high",
        whenUnavailable: "fail",
        test: (s) => (s.yearHigh > 0 ? offHigh(s) >= 0.08 && offHigh(s) <= 0.2 : "n/a"),
      },
      {
        id: "below-50",
        label: "Currently below its 50-day moving average, so the reclaim is still ahead",
        whenUnavailable: "fail",
        test: (s) => (num(s.sma50) ? s.price < s.sma50 : "n/a"),
      },
      {
        id: "rsi-cooled",
        label: "14-day RSI between 35 and 45 (cooled off, not washed out)",
        whenUnavailable: "fail",
        test: (s) => (num(s.rsi) ? s.rsi >= 35 && s.rsi <= 45 : "n/a"),
      },
      noBigMissLastQuarter,
    ],
    rank: (s) => s.marketCap,
    trigger: () => ({ alertType: "SMA_CROSS_ABOVE", triggerValue: 50, triggerDirection: "ABOVE" }),
    rationale: (s) =>
      `${cap(s.marketCap)} ${sectorWord(s)}, ${pctAbs(offHigh(s))} below its 52-week high and still above its 200-day average; RSI ${s.rsi!.toFixed(0)}, ${pctAbs(1 - s.price / s.sma50!)} under its 50-day.`,
    pick: 10,
  },

  "200-day-comeback-watchlist": {
    slug: "200-day-comeback-watchlist",
    universe: {
      label: "US-listed companies with a market cap above $10 billion and average volume above 2 million shares",
      marketCapMin: 10e9,
      avgVolumeMin: 2e6,
    },
    needs: { fundamentals: true, sma200History: true },
    rules: [
      {
        id: "below-200",
        label: "Currently below its 200-day moving average, but within 20% of it",
        whenUnavailable: "fail",
        test: (s) => (num(s.sma200) ? s.price < s.sma200 && s.price >= 0.8 * s.sma200 : "n/a"),
      },
      {
        id: "time-below",
        label: "Closed below the 200-day average on at least 40 of the last 60 sessions",
        whenUnavailable: "fail",
        test: (s) => (num(s.sessionsBelow200Of60) ? s.sessionsBelow200Of60 >= 40 : "n/a"),
      },
      {
        id: "drawdown",
        label: "At least 20% below its 52-week high",
        whenUnavailable: "fail",
        test: (s) => (s.yearHigh > 0 ? offHigh(s) >= 0.2 : "n/a"),
      },
      {
        id: "balance-sheet",
        label: "Net debt under 4× EBITDA, or net cash (not applied to banks and insurers)",
        whenUnavailable: "skip",
        test: (s) => (isFinancial(s) ? "n/a" : num(s.fundamentals?.netDebtToEbitda) ? s.fundamentals!.netDebtToEbitda! < 4 : "n/a"),
      },
      {
        id: "improving",
        label: "Above its 50-day average and at least 8% off its 52-week low (price behavior improving before the trigger)",
        whenUnavailable: "fail",
        test: (s) => (num(s.sma50) && s.yearLow > 0 ? s.price > s.sma50 && s.price >= 1.08 * s.yearLow : "n/a"),
      },
    ],
    rank: (s) => s.price / (s.sma200 ?? Infinity),
    trigger: () => ({ alertType: "SMA_CROSS_ABOVE", triggerValue: 200, triggerDirection: "ABOVE" }),
    rationale: (s) =>
      `${pctAbs(1 - s.price / s.sma200!)} below its 200-day average after closing under it on ${s.sessionsBelow200Of60} of the last 60 sessions; ${pctAbs(offHigh(s))} off its 52-week high, back above its 50-day.`,
    pick: 10,
  },

  "dividend-growth-buy-zones": {
    slug: "dividend-growth-buy-zones",
    universe: {
      label: "US-listed dividend payers with a market cap above $10 billion and average volume above 1 million shares",
      marketCapMin: 10e9,
      avgVolumeMin: 1e6,
      requiresDividend: true,
    },
    needs: { fundamentals: true, dividends: true },
    rules: [
      {
        id: "growth-record",
        label: "Annual dividend increased in each of the last five calendar years",
        whenUnavailable: "fail",
        test: (s) => (s.dividend ? s.dividend.growthYears >= 5 : "n/a"),
      },
      {
        id: "no-cut",
        label: "Latest payment is not below the payment one year earlier",
        whenUnavailable: "fail",
        test: (s) => (s.dividend ? !s.dividend.recentCut : "n/a"),
      },
      {
        id: "covered",
        label: "Dividend covered: earnings payout under 75% or free-cash-flow payout under 90%",
        whenUnavailable: "fail",
        test: (s) => {
          const p = s.fundamentals?.payoutRatio;
          const f = s.dividend?.fcfPayout;
          if (!num(p) && !num(f)) return "n/a";
          return (num(p) && p > 0 && p < 0.75) || (num(f) && f > 0 && f < 0.9);
        },
      },
      manageableLeverage(3.5),
      {
        id: "min-yield",
        label: "Forward yield of at least 1.5%, so the list stays relevant to income investors",
        whenUnavailable: "fail",
        test: (s) => (s.dividend ? s.dividend.yieldNow >= 0.015 : "n/a"),
      },
      {
        id: "zone-pending",
        label: "Buy-zone yield (the top fifth of its own five-year yield range) is above today's yield, or the stock is below its 200-day average after reaching it",
        whenUnavailable: "fail",
        test: (s) => {
          const d = s.dividend;
          if (!d || !num(s.sma200)) return "n/a";
          return s.price > d.buyZonePrice || s.price < s.sma200;
        },
      },
    ],
    rank: (s) => (s.dividend ? s.dividend.yieldNow / s.dividend.yieldP80 : 0),
    // Mostly calculated price levels; at most three names that are already in the zone and waiting on the 200-day reclaim.
    select: (ranked, pick) => {
      const reclaim = ranked.filter((s) => s.dividend && s.price <= s.dividend.buyZonePrice).slice(0, 3);
      const pending = ranked.filter((s) => s.dividend && s.price > s.dividend.buyZonePrice);
      return [...pending.slice(0, pick - reclaim.length), ...reclaim].slice(0, pick);
    },
    trigger: (s) => {
      const d = s.dividend;
      if (!d || !num(s.sma200)) return null;
      if (s.price > d.buyZonePrice) return { alertType: "PRICE_BELOW", triggerValue: round2(d.buyZonePrice), triggerDirection: "BELOW" };
      if (s.price < s.sma200) return { alertType: "SMA_CROSS_ABOVE", triggerValue: 200, triggerDirection: "ABOVE" };
      return null;
    },
    rationale: (s) => {
      const d = s.dividend!;
      const p = s.fundamentals?.payoutRatio;
      const cov = num(p) && p > 0 && p < 0.75 ? `earnings payout ${pctAbs(p, 0)}` : `free-cash-flow payout ${pctAbs(d.fcfPayout ?? 0, 0)}`;
      const years = `${d.growthYears}${d.growthYearsCapped ? "+" : ""}`;
      if (s.price > d.buyZonePrice) {
        return `${years} straight years of dividend growth; ${cov}. Yields ${pctAbs(d.yieldNow, 2)} today; ${usd(d.buyZonePrice)} is where the yield reaches ${pctAbs(d.yieldP80, 2)}, the top fifth of its five-year range.`;
      }
      return `${years} straight years of dividend growth; ${cov}. Yield ${pctAbs(d.yieldNow, 2)} is already in the top fifth of its five-year range; watching for the price to reclaim its 200-day average.`;
    },
    pick: 10,
  },
};

export const SCREENED_SLUGS = Object.keys(SCREENS) as ScreenedSlug[];
export const isScreenedSlug = (slug: string): slug is ScreenedSlug => slug in SCREENS;

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Apply every rule; a candidate qualifies when no rule returns false and no `fail` rule is n/a. */
export function evaluateScreen(def: ScreenDefinition, s: Snapshot): { qualifies: boolean; failed: string[] } {
  const failed: string[] = [];
  for (const rule of def.rules) {
    const r = rule.test(s);
    if (r === false || (r === "n/a" && rule.whenUnavailable === "fail")) failed.push(rule.id);
  }
  return { qualifies: failed.length === 0, failed };
}
