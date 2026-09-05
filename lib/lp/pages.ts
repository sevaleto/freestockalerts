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
  /** Small caps line above the headline, e.g. "FREE FOREVER • SET UP IN 60 SECONDS". */
  eyebrow: string;
  headline: string;
  subheadline: string;
  /** One-sentence "why this works" line under the subheadline. */
  logicLine: string;
  bullets: string[];
  ctaLabel: string;
  googleLabel: string;
  /** Legal line under the reassurance row. */
  disclosure: string;
  /** Illustrative alert shown in the hero. Static sample data, labeled as such on the page. */
  sampleAlert: SampleAlert;
  proofTitle: string;
  afterSignupNote: string;
  ogTitle?: string;
  ogDescription?: string;
}

export interface SampleAlert {
  ticker: string;
  companyName?: string;
  /** Email subject line shown in the card's header strip. */
  subject?: string;
  /** Volume vs. 30-day average, e.g. 1.6. Drives the bar in the card. */
  volumeMultiple?: number;
  badge: string;
  alertType: string;
  priceLabel: string;
  price: string;
  change: string;
  time: string;
  volume: string;
  marketCap: string;
  whyTitle: string;
  why: string;
  context: string;
}

const BADGE = "Free forever. Set up in 60 seconds.";
const EYEBROW = "Free forever • Set up in 60 seconds";
const GOOGLE = "Continue with Google";
const DISCLOSURE = "Educational information only. Not investment advice.";
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
      "Plain-English context with every alert: what happened, what to watch next",
    ],
    ctaLabel: "Send me the free alerts",
    proofTitle: "Here's exactly what you'll be watching",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "NVDA",
      subject: "NVDA hit a new 52-week high — here's what moved it",
      volumeMultiple: 1.6,
      badge: "New 52-week high",
      alertType: "Momentum Breakout",
      priceLabel: "High price",
      price: "$142.60",
      change: "+4.12%",
      time: "10:05 AM ET",
      volume: "48.3M",
      marketCap: "$3.5T",
      whyTitle: "Why it triggered",
      why: "New high on above-average volume",
      context: "NVDA printed a fresh 52-week high on volume well above its 30-day average. Price is extended above its 50-day average; traders typically watch whether the breakout holds into the close.",
    },
    afterSignupNote: AFTER,
    ogDescription: "Free momentum alerts with plain-English context. New highs, volume surges, oversold bounces.",
  },
  radar: {
    slug: "radar",
    templateSlug: "under-the-radar-breakouts",
    source: "lp:radar",
    metaContentName: "lp_radar",
    badge: BADGE,
    headline: "10 breakout stocks.\nOne clear morning\nwatchlist.",
    subheadline:
      "Get free email alerts when screened mid-cap stocks hit new 52-week highs, plus the price level and a plain-English rationale behind each alert.",
    logicLine:
      "Find mid-caps already showing strength before they become familiar names. This list is screened from market data and refreshed quarterly.",
    bullets: [
      "10 mid-caps ($2–20B) already in uptrends, screened from live data",
      "Alert fires the day one prints a fresh 52-week high",
      "Names you've probably never looked at: that's the point",
    ],
    ctaLabel: "Send me the free watchlist",
    proofTitle: "The 10 stocks on the radar right now",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "CHYM",
      subject: "CHYM hit a new 52-week high — here's what moved it",
      volumeMultiple: 2.4,
      badge: "New 52-week high",
      alertType: "Momentum Breakout",
      priceLabel: "High price",
      price: "$10.24",
      change: "+6.14%",
      time: "10:25 AM ET",
      volume: "3.21M",
      marketCap: "$567M",
      whyTitle: "Why it triggered",
      why: "Relative strength + expanding volume",
      context: "CHYM just hit a new 52-week high on strong relative volume. Price is above key moving averages with expanding momentum. Watch for continuation.",
    },
    afterSignupNote: AFTER,
    ogTitle: "10 breakout stocks. One clear morning watchlist.",
    ogDescription: "Free alerts on screened mid-cap stocks breaking to new 52-week highs, with the price level and a plain-English rationale.",
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
    ctaLabel: "Send me the free alerts",
    proofTitle: "The 10 turnarounds we're watching for",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "BA",
      subject: "BA reclaimed its 200-day average — here's what moved it",
      volumeMultiple: 1.3,
      badge: "Reclaimed 200-day",
      alertType: "Turnaround Signal",
      priceLabel: "Price",
      price: "$218.40",
      change: "+2.87%",
      time: "11:40 AM ET",
      volume: "6.8M",
      marketCap: "$172B",
      whyTitle: "Why it triggered",
      why: "Closed below yesterday, crossed above today",
      context: "BA crossed back above its 200-day moving average after several weeks below it. Historically this is the level institutions use to call a trend change; watch whether it holds for a few sessions.",
    },
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
    ctaLabel: "Send me the free alerts",
    proofTitle: "The 10 leaders you'll be watching",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "AMD",
      subject: "AMD is oversold (RSI 27) — here's what happened",
      volumeMultiple: 2.1,
      badge: "RSI oversold",
      alertType: "Oversold Bounce",
      priceLabel: "Price",
      price: "$128.15",
      change: "-3.40%",
      time: "2:15 PM ET",
      volume: "61.2M",
      marketCap: "$208B",
      whyTitle: "Why it triggered",
      why: "14-day RSI dropped below 30",
      context: "AMD's 14-day RSI fell under 30 after a week of heavy selling. Readings this low on a market leader have historically marked washouts rather than breakdowns, though nothing guarantees a bounce.",
    },
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
    ctaLabel: "Send me the free alerts",
    proofTitle: "The 11 sectors on your radar",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "XLE",
      subject: "Energy (XLE) crossed above its 50-day — what it means",
      volumeMultiple: 1.2,
      badge: "Crossed 50-day",
      alertType: "Sector Rotation",
      priceLabel: "Price",
      price: "$92.30",
      change: "+1.65%",
      time: "9:50 AM ET",
      volume: "14.1M",
      marketCap: "$36B AUM",
      whyTitle: "Why it triggered",
      why: "Price crossed above its 50-day average",
      context: "The energy sector ETF crossed above its 50-day moving average for the first time in six weeks. Rotation into energy often shows up here before it reaches the headlines.",
    },
    afterSignupNote: AFTER,
    ogDescription: "Free sector rotation alerts on all 11 S&P sector ETFs.",
  },
};

export const LP_SLUGS = Object.keys(LANDING_PAGES) as LpSlug[];
export const isLpSlug = (value: string): value is LpSlug => value in LANDING_PAGES;
export const getLandingPage = (slug: string): LandingPage | null =>
  isLpSlug(slug) ? LANDING_PAGES[slug] : null;
