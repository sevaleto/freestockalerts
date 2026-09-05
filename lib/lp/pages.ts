/**
 * Facebook-ad landing pages. One entry per ad angle; each maps to an
 * AlertTemplate whose alerts are shown as proof and auto-activated after
 * signup. Adding a page = adding an entry here (no other code).
 *
 * Pure data — imported by server pages and by the auth source whitelist.
 */

export type LpSlug = "breakouts" | "radar" | "turnarounds" | "oversold" | "sectors";

export interface LandingPage {
  slug: LpSlug;
  templateSlug: string;
  /** Stored in User.signupSource for attribution. */
  source: `lp:${LpSlug}`;
  /** Meta pixel content_name for ViewContent / Lead. */
  metaContentName: string;
  badge: string;
  headline: string;
  subheadline: string;
  /** One-sentence "why this works" line under the subheadline. */
  logicLine: string;
  bullets: string[];
  ctaLabel: string;
  proofTitle: string;
  afterSignupNote: string;
  ogTitle?: string;
  ogDescription?: string;
}

const BADGE = "Free forever. Set up in 60 seconds.";
const AFTER = "Your alerts go live the moment you confirm your email. No setup.";

export const LANDING_PAGES: Record<LpSlug, LandingPage> = {
  breakouts: {
    slug: "breakouts",
    templateSlug: "momentum-breakout-alerts",
    source: "lp:breakouts",
    metaContentName: "lp_breakouts",
    badge: BADGE,
    headline: "Catch the breakout, not the headline about it.",
    subheadline:
      "Free alerts for new 52-week highs, volume surges, and oversold bounces on NVDA, META, NFLX, AMD, and more. Every alert explains why it fired.",
    logicLine:
      "Stocks making new highs on rising volume have historically kept running. The trick is hearing about it in minutes, not the next morning.",
    bullets: [
      "10 momentum alerts on the market's leaders, pre-set and ready",
      "52-week highs, 2x volume spikes, RSI oversold bounces",
      "AI context with every alert: what happened, what to watch next",
    ],
    ctaLabel: "Get My Breakout Alerts →",
    proofTitle: "Here's exactly what you'll be watching",
    afterSignupNote: AFTER,
    ogDescription: "Free momentum alerts with AI context. New highs, volume surges, oversold bounces.",
  },
  radar: {
    slug: "radar",
    templateSlug: "under-the-radar-breakouts",
    source: "lp:radar",
    metaContentName: "lp_radar",
    badge: BADGE,
    headline: "The breakouts nobody's talking about yet.",
    subheadline:
      "Free alerts on 10 screened mid-cap stocks breaking to new 52-week highs, the kind of names institutions buy before they hit the news.",
    logicLine:
      "Big moves start from new highs, and mid-caps get accumulated by funds long before retail hears the name. This list is screened from market data and refreshed quarterly.",
    bullets: [
      "10 mid-caps ($2–20B) already in uptrends, screened from live data",
      "Alert fires the day one prints a fresh 52-week high",
      "Names you've probably never looked at: that's the point",
    ],
    ctaLabel: "Get My Radar Alerts →",
    proofTitle: "The 10 stocks on the radar right now",
    afterSignupNote: AFTER,
    ogDescription: "Free alerts on screened mid-cap stocks breaking to new highs.",
  },
  turnarounds: {
    slug: "turnarounds",
    templateSlug: "turnaround-signals",
    source: "lp:turnarounds",
    metaContentName: "lp_turnarounds",
    badge: BADGE,
    headline: "Know the day a beaten-down stock turns the corner.",
    subheadline:
      "Free alerts when Broadcom, Boeing, Costco, Oracle, Netflix, and 5 more reclaim their 200-day average, the classic trend-change signal.",
    logicLine:
      "A stock crossing back above its 200-day moving average is the signal institutions use to call a new uptrend. These 10 quality names are below it right now.",
    bullets: [
      "10 large-cap leaders currently trading below their 200-day",
      "Alert fires only on the actual cross back above, not before",
      "Catch the turn before the analyst upgrades",
    ],
    ctaLabel: "Get My Turnaround Alerts →",
    proofTitle: "The 10 turnarounds we're watching for",
    afterSignupNote: AFTER,
    ogDescription: "Free alerts when quality stocks reclaim their 200-day moving average.",
  },
  oversold: {
    slug: "oversold",
    templateSlug: "oversold-bounce-leaders",
    source: "lp:oversold",
    metaContentName: "lp_oversold",
    badge: BADGE,
    headline: "Buy fear on the best stocks.",
    subheadline:
      "Free alerts when 10 market leaders drop into oversold territory (RSI under 30). Historically, that's where the bounces start.",
    logicLine:
      "The strongest stocks get sold hardest in a panic. An RSI reading under 30 on a leader like NVDA or TSLA has historically marked washouts, not breakdowns.",
    bullets: [
      "NVDA, TSLA, AMD, PLTR, META, NFLX, AVGO, AMZN, COIN, SHOP",
      "Alert fires when 14-day RSI drops below 30",
      "One email per washout, never a flood",
    ],
    ctaLabel: "Get My Oversold Alerts →",
    proofTitle: "The 10 leaders you'll be watching",
    afterSignupNote: AFTER,
    ogDescription: "Free alerts when market leaders hit oversold RSI levels.",
  },
  sectors: {
    slug: "sectors",
    templateSlug: "sector-rotation-radar",
    source: "lp:sectors",
    metaContentName: "lp_sectors",
    badge: BADGE,
    headline: "Follow the money into the next sector before the crowd.",
    subheadline:
      "Free alerts when any of the 11 S&P sectors crosses above its 50-day average. See where institutional money is moving.",
    logicLine:
      "Money rotates between sectors weeks before it shows up in headlines. A sector ETF crossing above its 50-day average is the simplest, most-watched tell.",
    bullets: [
      "All 11 SPDR sector ETFs, from tech to utilities",
      "Alert fires on the cross above the 50-day moving average",
      "Know which sector is catching a bid the day it happens",
    ],
    ctaLabel: "Get My Sector Alerts →",
    proofTitle: "The 11 sectors on your radar",
    afterSignupNote: AFTER,
    ogDescription: "Free sector rotation alerts on all 11 S&P sector ETFs.",
  },
};

export const LP_SLUGS = Object.keys(LANDING_PAGES) as LpSlug[];
export const isLpSlug = (value: string): value is LpSlug => value in LANDING_PAGES;
export const getLandingPage = (slug: string): LandingPage | null =>
  isLpSlug(slug) ? LANDING_PAGES[slug] : null;
