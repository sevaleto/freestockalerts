/**
 * Facebook-ad landing pages. One entry per ad angle; each maps to an
 * AlertTemplate whose alerts are shown as proof and auto-activated after
 * signup. Adding a page = adding an entry here (no other code).
 *
 * Pure data — imported by server pages and by the auth source whitelist.
 */

export type LpSlug = "breakouts" | "radar" | "turnarounds" | "oversold" | "sectors" | "insiders" | "upgrades";

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
    templateSlug: "quality-breakout-radar",
    source: "lp:breakouts",
    metaContentName: "lp_breakouts",
    badge: BADGE,
    headline: "Breakouts backed by business strength—not just hype.",
    subheadline:
      "Free alerts when financially sound companies within 5% of a 52-week high print a new one. Screened for positive free cash flow, growth and manageable debt. Every alert shows volume versus average.",
    logicLine:
      "A new high from a company that generates cash, is growing and is not over-levered is a shorter, more useful list than every stock making a new high. The alert tells you the day it happens.",
    bullets: [
      "10 screened companies near their highs, above both moving averages",
      "Alert fires on the fresh 52-week high, with volume vs. average in the email",
      "Plain-English context with every alert: what happened, what investors watch next",
    ],
    ctaLabel: "Send me the free alerts",
    proofTitle: "Here's exactly what you'll be watching",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "NVDA",
      subject: "NVDA hit a new 52-week high — volume 1.6x average",
      volumeMultiple: 1.6,
      badge: "New 52-week high",
      alertType: "Quality breakout",
      priceLabel: "High price",
      price: "$142.60",
      change: "+4.12%",
      time: "10:05 AM ET",
      volume: "48.3M (1.6x avg)",
      marketCap: "$3.5T",
      whyTitle: "Why it triggered",
      why: "New high on above-average volume",
      context: "NVDA printed a fresh 52-week high on 1.6x its 30-day average volume, above both its 50- and 200-day averages. Investors often watch whether a breakout holds into the close and over the next few sessions.",
    },
    afterSignupNote: AFTER,
    ogTitle: "Breakouts backed by business strength",
    ogDescription: "Free 52-week-high alerts on companies screened for positive free cash flow, growth and manageable debt. Volume context in every email.",
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
      "Find strength before the names become familiar. This list is screened from market data for profitability, liquidity and trend, and rebuilt monthly.",
    bullets: [
      "10 profitable mid-caps ($2–20B) already in uptrends, screened from live data",
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
      alertType: "Mid-cap breakout",
      priceLabel: "High price",
      price: "$10.24",
      change: "+6.14%",
      time: "10:25 AM ET",
      volume: "3.21M (2.4x avg)",
      marketCap: "$5.7B",
      whyTitle: "Why it triggered",
      why: "New 52-week high on 2.4x average volume",
      context: "CHYM printed a fresh 52-week high on 2.4x its 30-day average volume, above both its 50- and 200-day averages. Investors often watch whether a breakout holds into the close and over the next few sessions.",
    },
    afterSignupNote: AFTER,
    ogTitle: "10 breakout stocks. One clear morning watchlist.",
    ogDescription: "Free alerts on screened mid-cap stocks breaking to new 52-week highs, with the price level and a plain-English rationale.",
  },
  turnarounds: {
    slug: "turnarounds",
    templateSlug: "200-day-comeback-watchlist",
    source: "lp:turnarounds",
    metaContentName: "lp_turnarounds",
    badge: BADGE,
    headline: "Get alerted when a former leader begins its comeback.",
    subheadline:
      "Free alerts when established companies that have spent months below their 200-day average cross back above it, the trend line many investors use to define an uptrend.",
    logicLine:
      "A stock that closed below its 200-day average on most of the last 60 sessions and crosses back above it is a visible change in character. These 10 names are screened weekly for a sound balance sheet and improving price behavior.",
    bullets: [
      "10 liquid large caps at least 20% off their highs, below their 200-day for months",
      "Alert fires only on the actual cross back above, not before",
      "Volume vs. average and distance from the 50-day in every email",
    ],
    ctaLabel: "Send me the free alerts",
    proofTitle: "The 10 comebacks we're watching for",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "BA",
      subject: "BA reclaimed its 200-day average — here's what moved it",
      volumeMultiple: 1.3,
      badge: "Reclaimed 200-day",
      alertType: "Comeback signal",
      priceLabel: "Price",
      price: "$218.40",
      change: "+2.87%",
      time: "11:40 AM ET",
      volume: "6.8M (1.3x avg)",
      marketCap: "$172B",
      whyTitle: "Why it triggered",
      why: "Closed below its 200-day yesterday, crossed above it today",
      context: "BA crossed back above its 200-day moving average after closing below it on most of the last 60 sessions. The 200-day is a level many investors use to define the trend; a first cross is often watched for several sessions to see whether it holds.",
    },
    afterSignupNote: AFTER,
    ogTitle: "Get alerted when a former leader begins its comeback",
    ogDescription: "Free alerts on the first cross back above the 200-day moving average for established companies that spent months below it.",
  },
  oversold: {
    slug: "oversold",
    templateSlug: "leader-pullback-and-reclaim",
    source: "lp:oversold",
    metaContentName: "lp_oversold",
    badge: BADGE,
    headline: "Don’t catch the falling knife. Wait for buyers to return.",
    subheadline:
      "Free alerts on large, trending companies 8–20% off their highs with a cooled RSI, sent only when the price reclaims its 50-day average.",
    logicLine:
      "An oversold reading alone says a stock fell fast; it can keep falling. Requiring the price to cross back above its 50-day average asks a better question: have buyers stepped in? These 10 leaders are screened weekly.",
    bullets: [
      "10 companies over $50B, still above their 200-day, 8–20% off their highs",
      "Alert fires on the reclaim of the 50-day average, not on the low RSI reading",
      "One email per reclaim, never a flood",
    ],
    ctaLabel: "Send me the free alerts",
    proofTitle: "The 10 leaders you'll be watching",
    eyebrow: EYEBROW,
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "AMD",
      subject: "AMD reclaimed its 50-day average — here's what moved it",
      volumeMultiple: 1.5,
      badge: "Reclaimed 50-day",
      alertType: "Pullback and reclaim",
      priceLabel: "Price",
      price: "$128.15",
      change: "+2.60%",
      time: "1:05 PM ET",
      volume: "61.2M (1.5x avg)",
      marketCap: "$208B",
      whyTitle: "Why it triggered",
      why: "Closed below its 50-day yesterday, crossed above it today",
      context: "AMD crossed back above its 50-day moving average on 1.5x average volume. It is 12% below its 52-week high and above its 200-day average; RSI was 41 when the list was built. Investors often watch whether the reclaim holds for several sessions.",
    },
    afterSignupNote: AFTER,
    ogTitle: "Don’t catch the falling knife. Wait for buyers to return.",
    ogDescription: "Free alerts when large, trending companies in a pullback reclaim their 50-day moving average.",
  },
  sectors: {
    slug: "sectors",
    templateSlug: "sector-leadership-radar",
    source: "lp:sectors",
    metaContentName: "lp_sectors",
    badge: BADGE,
    headline: "See where market strength is moving.",
    subheadline:
      "Free alerts when any of the 11 S&P sectors crosses above its 50-day average, with its 200-day position and last month's performance against SPY in every email.",
    logicLine:
      "Sector performance rotates. A sector ETF crossing above its 50-day average is a simple, widely followed marker of a short-term trend change; the context in the email tells you whether it looks like improving leadership or a bounce within a downtrend.",
    bullets: [
      "All 11 SPDR sector ETFs, from tech to utilities",
      "Alert fires on the cross above the 50-day moving average",
      "Above or below the 200-day, and 21-session return vs. SPY, in the email",
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
      alertType: "Sector leadership",
      priceLabel: "Price",
      price: "$92.30",
      change: "+1.65%",
      time: "9:50 AM ET",
      volume: "14.1M (1.2x avg)",
      marketCap: "$36B AUM",
      whyTitle: "Why it triggered",
      why: "Crossed above its 50-day average after six weeks below it",
      context: "XLE crossed above its 50-day moving average. It is above its 200-day average and has outperformed SPY by 3.1 points over the last 21 sessions, so this reads as improving leadership rather than a bounce within a downtrend.",
    },
    afterSignupNote: AFTER,
    ogTitle: "See where market strength is moving",
    ogDescription: "Free alerts when any of the 11 S&P sector ETFs crosses above its 50-day average, with trend and relative-strength context.",
  },
  insiders: {
    slug: "insiders",
    templateSlug: "insider-purchase-confirmation",
    source: "lp:insiders",
    metaContentName: "lp_insiders",
    badge: BADGE,
    headline: "When insiders buy—and the stock confirms—we pay attention.",
    subheadline:
      "Get free alerts when senior executives and directors make meaningful purchases of their own company’s stock and improving price action confirms the signal.",
    logicLine:
      "Insider buying alone is not enough. This strategy filters out grants, option exercises, gifts, and routine transactions, then waits for price and volume confirmation before sending an alert.",
    bullets: [
      "Open-market purchases (SEC code P) of $100,000 or more by directors and senior officers",
      "Alert only when the price clears the post-purchase high above its 50-day average, or sits within 3% of it on 1.5x volume",
      "Every email carries the insider, shares, price, total value, and the Form 4 link",
    ],
    ctaLabel: "Send me insider purchase alerts",
    proofTitle: "What a confirmed insider purchase looks like",
    eyebrow: "Follow the people who know the business",
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ: insider purchase confirmed (2 insiders, $640,000)",
      volumeMultiple: 1.7,
      badge: "Insider purchase confirmed",
      alertType: "Insider purchase",
      priceLabel: "Price",
      price: "$48.20",
      change: "+3.1%",
      time: "4:40 PM ET",
      volume: "2.6M (1.7x avg)",
      marketCap: "$4.1B",
      whyTitle: "Why it triggered",
      why: "CEO bought $500,000 of stock; price broke the post-purchase high",
      context:
        "Jane Doe, Chief Executive Officer, purchased approximately 10,400 shares worth $500,000 on Aug 22, one of 2 insiders buying in the last 30 days. The stock is now above its 50-day average and is breaking above its post-purchase high on stronger-than-normal volume. Form 4 link included.",
    },
    afterSignupNote: "You get one email per confirmed signal after the daily scan. No setup.",
    ogTitle: "When insiders buy and the stock confirms",
    ogDescription: "Free alerts on $100,000+ open-market insider purchases confirmed by a break above the post-purchase high. Grants and option exercises excluded.",
  },
  upgrades: {
    slug: "upgrades",
    templateSlug: "analyst-upgrade-clusters",
    source: "lp:upgrades",
    metaContentName: "lp_upgrades",
    badge: BADGE,
    headline: "One upgrade is an opinion. A cluster can become a catalyst.",
    subheadline:
      "Get free alerts when several independent analysts turn more positive on the same stock and the market begins confirming their view.",
    logicLine:
      "This strategy looks beyond isolated price targets. It finds concentrated positive analyst actions, removes duplicates and conflicting signals, and waits for supporting price momentum.",
    bullets: [
      "Two or more independent firms upgrading or initiating at Buy within 14 days",
      "Repeat records from one firm count once; a conflicting downgrade blocks the signal",
      "Alert only on a 20-day-high breakout or 1.5x volume, above the 50-day average",
    ],
    ctaLabel: "Send me analyst upgrade alerts",
    proofTitle: "What an upgrade cluster looks like",
    eyebrow: "When Wall Street starts agreeing",
    googleLabel: GOOGLE,
    disclosure: DISCLOSURE,
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ: 3 positive analyst actions, price confirming",
      volumeMultiple: 1.6,
      badge: "Upgrade cluster",
      alertType: "Analyst cluster",
      priceLabel: "Price",
      price: "$112.40",
      change: "+2.4%",
      time: "4:40 PM ET",
      volume: "4.9M (1.6x avg)",
      marketCap: "$18B",
      whyTitle: "Why it triggered",
      why: "3 firms upgraded within 6 days; price broke its 20-day high",
      context:
        "XYZ received 3 positive analyst actions from independent firms during the past 6 days, including at least one outright upgrade. Shares are now above their 50-day average and breaking a 20-day high on elevated volume. Firms, dates and rating changes are listed in the email.",
    },
    afterSignupNote: "You get one email per confirmed signal after the daily scan. No setup.",
    ogTitle: "One upgrade is an opinion. A cluster can become a catalyst.",
    ogDescription: "Free alerts when two or more independent analysts turn positive on a stock within 14 days and price or volume confirms.",
  },
};

export const LP_SLUGS = Object.keys(LANDING_PAGES) as LpSlug[];
export const isLpSlug = (value: string): value is LpSlug => value in LANDING_PAGES;
export const getLandingPage = (slug: string): LandingPage | null =>
  isLpSlug(slug) ? LANDING_PAGES[slug] : null;
