/**
 * The strategy catalog: one entry per alert template, with everything the
 * index, the strategy pages, the seed and the tests need. Static content lives
 * here; the constituent lists of the data-driven strategies come from
 * lib/templates/screened.json (built by scripts/refresh-strategies.ts) and the
 * qualification rules from lib/templates/screens.ts, so the numbers on the page
 * and the numbers in the screen are the same numbers.
 *
 * Content rules (see README "Strategy catalog"): describe what the alert
 * watches and why investors look at the setup; never promise returns, never
 * cite a success rate, never claim institutional flow without ownership data.
 */
import type { SampleAlert } from "@/lib/lp/pages";
import { SCREENS, isScreenedSlug, type ScreenedSlug } from "./screens";
import { getScreened, type ScreenedStrategy } from "./screened";
import { ANALYST, ANALYST_SLUG, INSIDER, INSIDER_SLUG, UNIVERSE } from "@/lib/strategies/config";

export type StrategySection = "IDEA_DISCOVERY" | "ENTRY_TIMING" | "MARKET_MONITORING";
export type TemplateCategory = "EARNINGS" | "VALUE_INVESTING" | "MOMENTUM" | "DIVIDEND" | "MACRO" | "AI_PICKS";

export type SupportedAlertType =
  | "PRICE_ABOVE"
  | "PRICE_BELOW"
  | "PERCENT_CHANGE_DAY"
  | "VOLUME_SPIKE"
  | "RSI_OVERBOUGHT"
  | "RSI_OVERSOLD"
  | "SMA_CROSS_ABOVE"
  | "SMA_CROSS_BELOW"
  | "FIFTY_TWO_WEEK_HIGH"
  | "FIFTY_TWO_WEEK_LOW"
  | "EARNINGS_REMINDER";

/** Every trigger the alert engine evaluates (lib/alerts/evaluator.ts). Templates may use nothing else. */
export const SUPPORTED_ALERT_TYPES: readonly SupportedAlertType[] = [
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "PERCENT_CHANGE_DAY",
  "VOLUME_SPIKE",
  "RSI_OVERBOUGHT",
  "RSI_OVERSOLD",
  "SMA_CROSS_ABOVE",
  "SMA_CROSS_BELOW",
  "FIFTY_TWO_WEEK_HIGH",
  "FIFTY_TWO_WEEK_LOW",
  "EARNINGS_REMINDER",
];

export interface TemplateItem {
  ticker: string;
  companyName?: string;
  alertType: SupportedAlertType;
  triggerDirection: "ABOVE" | "BELOW" | "BOTH";
  triggerValue: number;
  rationale?: string;
  sortOrder: number;
}

export interface SectionInfo {
  id: StrategySection;
  label: string;
  /** One line under the section heading on the index. */
  blurb: string;
  sortOrder: number;
}

export const SECTIONS: Record<StrategySection, SectionInfo> = {
  IDEA_DISCOVERY: {
    id: "IDEA_DISCOVERY",
    label: "Idea Discovery",
    blurb: "Screened lists that surface research candidates showing several confirming signals at once.",
    sortOrder: 1,
  },
  ENTRY_TIMING: {
    id: "ENTRY_TIMING",
    label: "Entry Timing",
    blurb: "Companies that already pass a quality screen, watched for a price event that says the pullback may be ending.",
    sortOrder: 2,
  },
  MARKET_MONITORING: {
    id: "MARKET_MONITORING",
    label: "Market and Portfolio Monitoring",
    blurb: "Context on the market environment and the calendar, not stock selection.",
    sortOrder: 3,
  },
};

export const SECTION_ORDER: StrategySection[] = ["IDEA_DISCOVERY", "ENTRY_TIMING", "MARKET_MONITORING"];

export interface StrategyLanding {
  eyebrow: string;
  headline: string;
  description: string;
  cta: string;
}

/**
 * watchlist: activation creates the template's alerts on the user's account, evaluated by the 5-minute cron.
 * signal: a daily server-side scan confirms events and emails subscribers; there is no fixed list.
 */
export type StrategyKind = "watchlist" | "signal";

export interface StrategyDefinition {
  /** Stable id, independent of the database row id. */
  id: string;
  slug: string;
  name: string;
  kind: StrategyKind;
  section: StrategySection;
  /** Older topical tag stored in AlertTemplate.category. */
  category: TemplateCategory;
  status: "active";
  version: number;
  isFeatured: boolean;
  sortOrder: number;
  /** lucide-react icon name; see lib/templates/icons.ts. */
  icon: string;
  /** One sentence on the card and at the top of the page. */
  valueProposition: string;
  /** Short description used on cards and in the database. */
  description: string;
  landing: StrategyLanding;
  universe: string;
  qualificationRules: string[];
  triggerRules: string[];
  /** Very short trigger line for cards, e.g. "Fresh 52-week high". */
  triggerSummary: string;
  disqualifiers: string[];
  refreshCadence: string;
  /** Used to flag an overdue list on the page. */
  refreshIntervalDays: number;
  /** ISO date the list was last rebuilt (screened) or reviewed (fixed). */
  lastRefreshedAt: string;
  watches: string;
  whyInvestorsWatch: string;
  whenItFails: string[];
  methodology: string;
  /** What the data provider cannot supply, stated plainly. */
  dataLimitations: string[];
  riskSummary: string;
  sampleAlert: SampleAlert;
  related: string[];
  seo: { title: string; description: string };
  items: TemplateItem[];
  /** Present for the data-driven lists. */
  screened: Pick<ScreenedStrategy, "universeSize" | "qualifiedCount" | "refreshedAt"> | null;
}

/* ------------------------------ helpers ---------------------------------- */

/** Date this catalog's fixed lists and copy were last reviewed. */
const REVIEWED_AT = "2026-09-05T16:00:00Z";

const DISCLAIMER_LINE = "Educational information only. Not investment advice.";

function screenedItems(slug: ScreenedSlug): { items: TemplateItem[]; screened: StrategyDefinition["screened"]; lastRefreshedAt: string } {
  const data = getScreened(slug);
  if (!data) return { items: [], screened: null, lastRefreshedAt: "" };
  return {
    items: data.constituents.map((c) => ({
      ticker: c.ticker,
      companyName: c.companyName,
      alertType: c.alertType,
      triggerDirection: c.triggerDirection,
      triggerValue: c.triggerValue,
      rationale: c.rationale,
      sortOrder: c.sortOrder,
    })),
    screened: { universeSize: data.universeSize, qualifiedCount: data.qualifiedCount, refreshedAt: data.refreshedAt },
    lastRefreshedAt: data.refreshedAt,
  };
}

const rulesFor = (slug: ScreenedSlug) => SCREENS[slug].rules.map((r) => r.label);
const universeFor = (slug: ScreenedSlug) => SCREENS[slug].universe.label;

const SCREEN_METHOD =
  "The list is rebuilt by a script against Financial Modeling Prep data: it pulls the universe from the company screener, applies the price rules to each quote, fetches fundamentals only for the names that survive, keeps the ones that pass every rule, ranks them, and stores the top 10 with the data it saw. The page and the alerts come from that stored list, so what you see is what was screened, as of the refresh date.";

const NO_GUIDANCE = "Company guidance (raised, maintained, cut) is not available from the data provider, so it is not part of the screen. The most recent EPS surprise is used as a limited proxy for obvious impairment where noted.";

/* ------------------------------- catalog --------------------------------- */

type Static = Omit<StrategyDefinition, "items" | "screened" | "lastRefreshedAt" | "universe" | "qualificationRules" | "kind"> &
  Partial<Pick<StrategyDefinition, "items" | "universe" | "qualificationRules" | "lastRefreshedAt" | "kind">>;

function screenedStrategy(def: Static & { slug: ScreenedSlug }): StrategyDefinition {
  const { items, screened, lastRefreshedAt } = screenedItems(def.slug);
  return {
    ...def,
    kind: "watchlist",
    universe: universeFor(def.slug),
    qualificationRules: rulesFor(def.slug),
    items,
    screened,
    lastRefreshedAt,
  };
}

function fixedStrategy(def: Static & { items: TemplateItem[]; universe: string; qualificationRules: string[] }): StrategyDefinition {
  return { ...def, kind: "watchlist", screened: null, lastRefreshedAt: def.lastRefreshedAt ?? REVIEWED_AT };
}

/** Event-driven: no constituents; the daily scan produces the alerts. */
function signalStrategy(def: Static & { universe: string; qualificationRules: string[] }): StrategyDefinition {
  return { ...def, kind: "signal", items: [], screened: null, lastRefreshedAt: def.lastRefreshedAt ?? REVIEWED_AT };
}

const SECTOR_ETFS: Array<[string, string, string]> = [
  ["XLK", "Technology Select Sector SPDR", "software, semiconductors and hardware"],
  ["XLF", "Financial Select Sector SPDR", "banks, insurers, asset managers and payment networks"],
  ["XLE", "Energy Select Sector SPDR", "oil and gas producers, refiners and services"],
  ["XLV", "Health Care Select Sector SPDR", "pharma, biotech, devices and health insurers"],
  ["XLI", "Industrial Select Sector SPDR", "aerospace, machinery, transport and construction"],
  ["XLY", "Consumer Discretionary Select Sector SPDR", "retail, autos, travel and leisure"],
  ["XLP", "Consumer Staples Select Sector SPDR", "food, beverages, household goods and grocers"],
  ["XLU", "Utilities Select Sector SPDR", "electric, gas and water utilities"],
  ["XLB", "Materials Select Sector SPDR", "chemicals, metals, mining and packaging"],
  ["XLRE", "Real Estate Select Sector SPDR", "REITs and real-estate services"],
  ["XLC", "Communication Services Select Sector SPDR", "media, telecom and interactive platforms"],
];

const EARNINGS_NAMES: Array<[string, string]> = [
  ["AAPL", "Apple"],
  ["NVDA", "NVIDIA"],
  ["TSLA", "Tesla"],
  ["META", "Meta Platforms"],
  ["AMZN", "Amazon"],
  ["MSFT", "Microsoft"],
  ["GOOGL", "Alphabet"],
];

export const STRATEGIES: StrategyDefinition[] = [
  /* ============================ IDEA DISCOVERY ============================ */
  screenedStrategy({
    id: "strategy:post-earnings-strength-radar",
    slug: "post-earnings-strength-radar",
    name: "Post-Earnings Strength Radar",
    section: "IDEA_DISCOVERY",
    category: "EARNINGS",
    status: "active",
    version: 1,
    isFeatured: true,
    sortOrder: 1,
    icon: "Radar",
    valueProposition: "Companies that beat estimates, rose on the news, and held the gain, watched for a break above the earnings-day high.",
    description:
      "Screened companies that reported better-than-expected results, rose on above-average volume, and are still holding the move. Alerts fire on a break above the earnings-day high or a fresh 52-week high.",
    landing: {
      eyebrow: "Post-earnings momentum",
      headline: "The earnings report is over. The opportunity may not be.",
      description: "Track companies that delivered encouraging results, held their gains, and are approaching a post-earnings breakout.",
      cta: "Activate Post-Earnings Strength Alerts",
    },
    triggerRules: [
      "If the stock is still below its earnings-day high: a price alert set at that high, so you hear about the break the day it happens.",
      "If the stock has already cleared the earnings-day high: a fresh 52-week high.",
      "Each alert fires once, then pauses. The email includes volume versus the 30-day average and the stock's position against its 50- and 200-day averages.",
    ],
    triggerSummary: "Break above the earnings-day high, or a fresh 52-week high",
    disqualifiers: [
      "Missed on either EPS or revenue, or the estimate was not available.",
      "Fell, or rose less than 3%, on the reaction day.",
      "Reaction-day volume under 1.5× the prior average.",
      "Gave the move back: trading below the pre-report close.",
      "Below either the 50-day or the 200-day moving average.",
    ],
    refreshCadence: "Weekly during earnings season, at least every two weeks otherwise",
    refreshIntervalDays: 14,
    watches:
      "Recently reported companies whose numbers came in ahead of estimates and whose shares responded with a strong, high-volume session that has held. The alert is the next step in that sequence: the price clearing the high set on the reaction day, or a new 52-week high.",
    whyInvestorsWatch:
      "A report that beats and holds tells you two things at once: the business did better than the consensus expected, and buyers were willing to pay more for it on heavy volume. Many investors treat the earnings-day high as the line that separates a one-day pop from follow-through, and use a break above it as the moment to start research rather than the moment to act.",
    whenItFails: [
      "A beat can be low quality: one-time items, a lowered bar, or a favorable comparison can lift EPS without improving the business.",
      "Post-earnings gaps are often retested. A stock can break the earnings-day high and reverse the same week.",
      "Guidance is not in the data, so a company that beat the quarter but cut its outlook could still qualify.",
      "Broad-market selling can pull a strong report back below its pre-report close regardless of the results.",
    ],
    methodology: `${SCREEN_METHOD} Reports are pulled from the earnings calendar for the last 45 days; the reaction day is the report date or the following session, whichever carried more volume, so after-the-close reporters are measured on the right day.`,
    dataLimitations: [
      NO_GUIDANCE,
      "EPS and revenue estimates are consensus figures from the provider; companies without an estimate on file cannot qualify.",
    ],
    riskSummary:
      "A positive report can still reverse, and the earnings-day high is a reference level, not a forecast. Treat an alert as a prompt to read the report and the reaction, not as a signal to buy.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ broke above its earnings-day high — here's what moved it",
      volumeMultiple: 1.8,
      badge: "Above earnings-day high",
      alertType: "Post-earnings breakout",
      priceLabel: "Price",
      price: "$84.20",
      change: "+3.9%",
      time: "10:40 AM ET",
      volume: "4.1M (1.8x avg)",
      marketCap: "$12B",
      whyTitle: "Why it triggered",
      why: "Cleared the $83.50 high set on the reaction day",
      context:
        "XYZ reported on Aug 6, beat on EPS and revenue, and rose 7.2% on 2.6x volume. It has now traded above the $83.50 earnings-day high on 1.8x average volume, above both its 50- and 200-day averages. Investors often watch whether a break like this holds into the close and over the next few sessions.",
    },
    related: ["quality-breakout-radar", "earnings-calendar-alerts", "under-the-radar-breakouts"],
    seo: {
      title: "Post-Earnings Strength Radar: Alerts on Beats That Held",
      description:
        "Free alerts on companies that beat estimates, rose on heavy volume, and held the move. Get notified on a break above the earnings-day high or a new 52-week high.",
    },
  }),

  screenedStrategy({
    id: "strategy:quality-breakout-radar",
    slug: "quality-breakout-radar",
    name: "Quality Breakout Radar",
    section: "IDEA_DISCOVERY",
    category: "MOMENTUM",
    status: "active",
    version: 1,
    isFeatured: true,
    sortOrder: 2,
    icon: "TrendingUp",
    valueProposition: "Financially sound companies within 5% of a 52-week high, alerted the day they print a new one.",
    description:
      "Momentum with a quality filter: positive free cash flow, growth in the latest fiscal year, manageable debt, and a price within 5% of its 52-week high. Alerts fire on the fresh high, with volume context in the email.",
    landing: {
      eyebrow: "Quality + momentum",
      headline: "Breakouts backed by business strength—not just hype.",
      description: "Track financially sound companies approaching new highs, then get alerted when the breakout happens.",
      cta: "Activate Quality Breakout Alerts",
    },
    triggerRules: [
      "A fresh 52-week high.",
      "The email shows volume against the 30-day average; a breakout on 1.5× or more is called out so you can see whether the move had participation.",
      "One email per breakout, then the alert pauses.",
    ],
    triggerSummary: "Fresh 52-week high, with volume vs. average in the email",
    disqualifiers: [
      "Negative trailing free cash flow.",
      "Revenue and net income both shrank in the latest fiscal year.",
      "Net debt above 3× EBITDA (banks and insurers are not measured on this ratio).",
      "More than 5% below the 52-week high, or below either moving average.",
    ],
    refreshCadence: "Monthly, sooner if a constituent reports materially different fundamentals",
    refreshIntervalDays: 31,
    watches:
      "Large and mid-sized companies that pass a basic business-quality screen and are already trading near the top of their 52-week range, above both moving averages. The alert is the new high itself.",
    whyInvestorsWatch:
      "A new high on its own says nothing about the business; a new high from a company that generates cash, is growing, and is not over-levered narrows the list to breakouts worth reading about. Many investors also look at volume on the breakout day, because a new high on thin volume is easier to reverse than one with broad participation.",
    whenItFails: [
      "New highs cluster in strong markets and can reverse quickly when the market turns, regardless of company quality.",
      "Trailing fundamentals lag. A business can deteriorate for a quarter or two before the screen notices.",
      "The 52-week high can be printed by a single tick and fade the same day; the alert cannot wait for the close.",
      "Quality filters are coarse. Positive cash flow and growth do not make a stock cheap.",
    ],
    methodology: `${SCREEN_METHOD} Fundamentals come from trailing-twelve-month key metrics and ratios plus the latest fiscal-year growth figures.`,
    dataLimitations: [
      "Growth is measured on the latest fiscal year, which can be up to a year old. Quarterly trends are not part of the screen.",
      "Net debt / EBITDA is not meaningful for banks and insurers, so the leverage rule is not applied to them.",
      "The alert engine evaluates one condition per alert; the 1.5× volume figure is reported in the email rather than required to trigger.",
    ],
    riskSummary:
      "Stocks near highs can be extended and volatile. A breakout is a starting point for research on a company that has been doing well; it is not a prediction that it will keep rising.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ hit a new 52-week high — volume 1.9x average",
      volumeMultiple: 1.9,
      badge: "New 52-week high",
      alertType: "Quality breakout",
      priceLabel: "High price",
      price: "$142.60",
      change: "+2.8%",
      time: "10:05 AM ET",
      volume: "6.2M (1.9x avg)",
      marketCap: "$38B",
      whyTitle: "Why it triggered",
      why: "New 52-week high on above-average volume",
      context:
        "XYZ printed a fresh 52-week high on 1.9x its 30-day average volume. It is above both its 50- and 200-day averages. On the list for positive free cash flow, revenue growth of 11% last fiscal year and net cash. Investors often watch whether a breakout holds into the close and over the next few sessions.",
    },
    related: ["under-the-radar-breakouts", "post-earnings-strength-radar", "sector-leadership-radar"],
    seo: {
      title: "Quality Breakout Radar: New-High Alerts With a Quality Screen",
      description:
        "Free 52-week-high alerts on companies with positive free cash flow, growth and manageable debt. Screened monthly, with volume context in every email.",
    },
  }),

  screenedStrategy({
    id: "strategy:under-the-radar-breakouts",
    slug: "under-the-radar-breakouts",
    name: "Under-the-Radar Breakouts",
    section: "IDEA_DISCOVERY",
    category: "MOMENTUM",
    status: "active",
    version: 2,
    isFeatured: true,
    sortOrder: 3,
    icon: "Telescope",
    valueProposition: "Profitable, liquid mid-caps already in uptrends, alerted when one prints a fresh 52-week high.",
    description:
      "A screened list of $2–20B companies trading near their highs, above both moving averages, with positive free cash flow and margins. Each alert fires when one reaches a new 52-week high. Rebuilt monthly.",
    landing: {
      eyebrow: "Mid-cap momentum",
      headline: "Find strength before the names become familiar.",
      description: "Track liquid mid-cap companies already showing positive trends and get alerted when one reaches a fresh 52-week high.",
      cta: "Activate the Mid-Cap Breakout Watchlist",
    },
    triggerRules: [
      "A fresh 52-week high.",
      "The email includes volume versus the 30-day average and the position against the 50- and 200-day averages.",
      "One email per breakout, then the alert pauses.",
    ],
    triggerSummary: "Fresh 52-week high",
    disqualifiers: [
      "Market cap outside $2–20 billion, or average volume under 1.5 million shares.",
      "More than 8% below the 52-week high, or below either moving average.",
      "Less than 30% above the 52-week low.",
      "Negative trailing free cash flow or a negative net margin.",
      "Net debt above 3× EBITDA (not applied to banks and insurers).",
    ],
    refreshCadence: "Monthly",
    refreshIntervalDays: 31,
    watches:
      "Mid-sized companies with real trading liquidity that are already in an uptrend and close to the top of their range, filtered for profitability so a rising share price alone is not enough. The alert is the new 52-week high.",
    whyInvestorsWatch:
      "Mid-caps get less coverage than the largest companies, so a strong trend in one can go unnoticed for a while. A new high from a profitable, liquid mid-cap that is already above its moving averages gives investors a short, specific list to research rather than a market-wide scan.",
    whenItFails: [
      "Mid-caps are more volatile than large caps; a new high can be followed by a sharp drop on modest news.",
      "The screen rewards what has already gone up, so it will hold names late in a move as well as early.",
      "Profitability filters use trailing data and can keep a company whose latest quarter turned.",
      "Sector-wide rallies can lift every name in a group; the list may cluster in one industry after a strong month.",
    ],
    methodology: `${SCREEN_METHOD} Names that already appear in the Quality Breakout Radar are left out so the two lists do not overlap.`,
    dataLimitations: [
      "No ownership or fund-flow data is used; nothing on this list is described as accumulated by institutions because that is not measured.",
      "Net debt / EBITDA is not applied to banks and insurers.",
    ],
    riskSummary:
      "Smaller companies carry more risk than large ones: wider swings, thinner coverage, and less margin for error. The list is research input, not a set of recommendations.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ hit a new 52-week high — here's what moved it",
      volumeMultiple: 2.4,
      badge: "New 52-week high",
      alertType: "Mid-cap breakout",
      priceLabel: "High price",
      price: "$61.40",
      change: "+4.6%",
      time: "10:25 AM ET",
      volume: "3.2M (2.4x avg)",
      marketCap: "$6.8B",
      whyTitle: "Why it triggered",
      why: "New 52-week high on 2.4x average volume",
      context:
        "XYZ printed a fresh 52-week high on 2.4x its 30-day average volume, above both its 50- and 200-day averages. On the list for positive free cash flow and a 14% net margin. Investors often watch whether a breakout holds into the close and over the next few sessions.",
    },
    related: ["quality-breakout-radar", "post-earnings-strength-radar", "leader-pullback-and-reclaim"],
    seo: {
      title: "Under-the-Radar Breakouts: Screened Mid-Cap 52-Week-High Alerts",
      description:
        "Free alerts when profitable, liquid mid-cap stocks already in uptrends reach a fresh 52-week high. Screened from market data and rebuilt monthly.",
    },
  }),

  signalStrategy({
    id: "strategy:insider-purchase-confirmation",
    slug: INSIDER_SLUG,
    name: "Insider Purchase Confirmation",
    section: "IDEA_DISCOVERY",
    category: "AI_PICKS",
    status: "active",
    version: 1,
    isFeatured: false,
    sortOrder: 11,
    icon: "UserCheck",
    valueProposition: "Meaningful open-market purchases by executives and directors, alerted only after the price action confirms them.",
    description:
      "Insider buying alone is not enough. This strategy filters out grants, option exercises, gifts, and routine transactions, then waits for price and volume confirmation before sending an alert.",
    landing: {
      eyebrow: "Follow the people who know the business",
      headline: "When insiders buy—and the stock confirms—we pay attention.",
      description: "Get free alerts when senior executives and directors make meaningful purchases of their own company’s stock and improving price action confirms the signal.",
      cta: "Send me insider purchase alerts",
    },
    universe: `Every open-market insider purchase reported to the SEC (Form 4, transaction code P) in the last ${INSIDER.lookbackDays} days, at companies with a market cap above $${UNIVERSE.marketCapMin / 1e9} billion and average volume above ${UNIVERSE.avgVolumeMin / 1e6} million shares.`,
    qualificationRules: [
      "Genuine purchase: SEC transaction code P only. Awards, grants, option exercises, gifts, conversions, sales and zero-price transactions are excluded.",
      "Common stock or ordinary shares; preferred shares, warrants, units and derivatives are excluded.",
      "Relevant insider: a director, or an officer with a senior title (CEO, CFO, COO, president, chair, founder, or another chief-officer role). A 10% owner with no role is not enough.",
      `Purchase value (shares × price) of at least $${INSIDER.minPurchaseValue.toLocaleString()}.`,
      "Price above its 50-day moving average.",
      `Confirmation: price breaking above the highest close since the purchase, or within ${INSIDER.nearHighPct * 100}% of it with volume at least ${INSIDER.volumeMultiple}× the ${UNIVERSE.avgVolumeSessions}-day average.`,
    ],
    triggerRules: [
      "The daily scan runs after the close. A symbol produces one alert when every rule above holds; the same purchase can never alert twice.",
      `Higher score when two or more different insiders bought within ${INSIDER.lookbackDays} days, when the buyer is the CEO, CFO, founder, president or chair, when the purchase is $${(INSIDER.score.largePurchaseValue / 1000).toFixed(0)}k or more, and when it is at least ${INSIDER.bigRelativeToHoldings * 100}% of the insider's prior holding (when ownership is reported).`,
      `One alert per company per ${INSIDER.cooldownDays} days. Each email carries the insider's name and title, purchase date, shares, price, total value, the confirmation, and the SEC filing link.`,
    ],
    triggerSummary: "Insider purchase of $100k+, then a break above the post-purchase high",
    disqualifiers: [
      "Any transaction code other than P, including option exercises (M), awards (A), gifts (G) and conversions (C).",
      "Sales and other dispositions.",
      "Zero or missing price or share count.",
      `Purchase value under $${INSIDER.minPurchaseValue.toLocaleString()}.`,
      "Buyer is not a director or senior officer.",
      "Price below the 50-day average, or no completed session since the purchase yet.",
      "Price still below the post-purchase high without a volume push.",
    ],
    refreshCadence: "Scanned daily after the close",
    refreshIntervalDays: 4,
    watches:
      "Form 4 filings for open-market purchases by the people who run the company, and whether the market has started to agree with them. A purchase gets the stock onto the watch; a break above the highest close since that purchase, above the 50-day average, is what sends the email.",
    whyInvestorsWatch:
      "Executives and directors buy with their own money and usually know the business better than anyone outside it. Many investors read a large, voluntary purchase as a statement of confidence, but a purchase alone says nothing about timing. Waiting for the price to clear the post-purchase high is one way to separate a buy that the market is responding to from one it is ignoring.",
    whenItFails: [
      "Insiders are early. A stock can drift for months after a purchase before anything happens, or keep falling.",
      "Some purchases are required or symbolic: ownership guidelines, a new director establishing a position, or a small buy timed for optics.",
      "The post-purchase high can be printed by a single tick and reverse; the scan sees the close-to-close breakout, not what follows.",
      "Form 4 data arrives with a lag and occasional amendments; a filing can be corrected after it has been counted.",
    ],
    methodology:
      "Purchases are pulled from the provider's SEC Form 4 feed (transaction code P), normalized, and deduplicated by accession number plus transaction details. Each qualifying purchase is stored with its original filing URL. For every symbol with a qualifying purchase the scan fetches the quote, the 50-day average and daily bars back to the purchase, computes the highest close since the purchase and the 20-day average volume, and creates a signal only when the confirmation rule holds. Signals are keyed on the filing, so a re-run never duplicates one.",
    dataLimitations: [
      "Insider titles come from the filing's free-text 'relationship' field; unusual titles may be classified as non-senior.",
      "Shares owned after the transaction are reported on most filings but not all; the ownership-size bonus is skipped when missing, and nothing is rejected for it.",
      "Transactions filed with no transaction code are not counted, even if they look like purchases.",
    ],
    riskSummary:
      "An insider purchase is a fact about one person's decision, not a forecast. Confirmation reduces false starts; it does not remove the possibility that the stock falls afterward.",
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
    related: ["analyst-upgrade-clusters", "quality-breakout-radar", "post-earnings-strength-radar"],
    seo: {
      title: "Insider Purchase Confirmation: Alerts on Confirmed Insider Buying",
      description:
        "Free alerts when executives and directors buy $100,000+ of their own stock and the price then breaks the post-purchase high. Grants and option exercises excluded.",
    },
  }),

  signalStrategy({
    id: "strategy:analyst-upgrade-clusters",
    slug: ANALYST_SLUG,
    name: "Analyst Upgrade Clusters",
    section: "IDEA_DISCOVERY",
    category: "AI_PICKS",
    status: "active",
    version: 1,
    isFeatured: false,
    sortOrder: 12,
    icon: "Users",
    valueProposition: "Two or more independent analyst upgrades or positive initiations in two weeks, alerted once price or volume confirms.",
    description:
      "This strategy looks beyond isolated price targets. It finds concentrated positive analyst actions, removes duplicates and conflicting signals, and waits for supporting price momentum.",
    landing: {
      eyebrow: "When Wall Street starts agreeing",
      headline: "One upgrade is an opinion. A cluster can become a catalyst.",
      description: "Get free alerts when several independent analysts turn more positive on the same stock and the market begins confirming their view.",
      cta: "Send me analyst upgrade alerts",
    },
    universe: `Every analyst rating change published in the last ${ANALYST.lookbackDays} days, at companies with a market cap above $${UNIVERSE.marketCapMin / 1e9} billion and average volume above ${UNIVERSE.avgVolumeMin / 1e6} million shares.`,
    qualificationRules: [
      `At least ${ANALYST.minFirms} positive actions from different research firms within ${ANALYST.lookbackDays} days. A positive action is an outright upgrade or a new initiation at Buy or better.`,
      "Repeated records from one firm count once. Reiterations of an unchanged rating are not positive actions.",
      "No firm cut the stock out of buy territory (or by two notches) in the same window.",
      "Price above its 50-day moving average.",
      `Confirmation: price breaking its ${ANALYST.highLookbackSessions}-day high, or volume at least ${ANALYST.volumeMultiple}× the ${UNIVERSE.avgVolumeSessions}-day average on an up day.`,
    ],
    triggerRules: [
      "The daily scan runs after the close. A symbol produces one alert when every rule above holds; the same set of actions can never alert twice.",
      `Higher score for three or more firms, for all actions falling within ${ANALYST.tightWindowDays} days, for at least one outright upgrade, for a ${ANALYST.highLookbackSessions}-day-high breakout, and for ${ANALYST.volumeMultiple}× volume. A firm trimming a rating while staying positive lowers the score.`,
      `One alert per company per ${ANALYST.cooldownDays} days. Each email lists the firms, dates, previous and new ratings, and the confirmation.`,
    ],
    triggerSummary: "2+ independent upgrades in 14 days, then a 20-day high or 1.5× volume",
    disqualifiers: [
      "Only one firm turned positive, or the second record is the same firm again.",
      "A reiteration (Buy → Buy) counted as the second action: it is not an upgrade.",
      "A conflicting downgrade out of buy territory in the same window.",
      "Price below the 50-day average.",
      "No price or volume confirmation: the cluster alone does not alert.",
      "FMP's calculated financial rating (a letter grade) is not an analyst action and is never counted.",
    ],
    refreshCadence: "Scanned daily after the close",
    refreshIntervalDays: 4,
    watches:
      "The flow of analyst rating changes across the market, grouped by company, with each firm's words translated to one scale (Strong Buy, Buy, Hold, Sell, Strong Sell) while the original wording is kept. A cluster of independent positive actions puts a stock on watch; a 20-day-high breakout or elevated volume above the 50-day average sends the email.",
    whyInvestorsWatch:
      "A single upgrade often moves a stock for a day. Several firms turning positive within days of each other can reflect new information they are all responding to, and the coverage itself can bring new buyers. Many investors treat a cluster as a reason to look at what changed, and use price and volume to judge whether the market agrees.",
    whenItFails: [
      "Analysts often upgrade after a move, not before it; a cluster can mark the end of a run as easily as the start.",
      "Firms respond to the same event, so three upgrades may be one piece of news counted three times.",
      "Rating words differ by firm; the normalization is a best effort and an unusual scale can be mapped as Hold.",
      "Confirmation on one day says little about the next; a 20-day high can fail within the week.",
    ],
    methodology:
      "Rating changes come from the provider's cross-market analyst feed and, for each candidate, its per-symbol rating history. Each record is normalized (firm, date, previous and new grade, a tier for each grade, and a direction derived from the tiers rather than the feed's action word) and deduplicated on symbol, firm, date, previous and new grade. Symbols with two or more independent positive actions are checked against the quote, the 50-day average, the 20-day high and the 20-day average volume. Signals are keyed on the exact set of actions, so a re-run never duplicates one.",
    dataLimitations: [
      "Price-target changes without a rating change are not analyst actions here.",
      "The feed sometimes labels an unchanged rating as a downgrade; the tiers, not the label, decide direction.",
      "Initiations with no previous grade count as positive only when the new rating is Buy or better.",
    ],
    riskSummary:
      "Analyst ratings are opinions with a mixed record, and clusters can follow news the market has already priced. Treat an alert as a prompt to read the research and the reaction, not as a recommendation.",
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
    related: ["insider-purchase-confirmation", "post-earnings-strength-radar", "quality-breakout-radar"],
    seo: {
      title: "Analyst Upgrade Clusters: Alerts When Several Firms Turn Positive",
      description:
        "Free alerts when two or more independent analysts upgrade a stock within 14 days and the price then breaks a 20-day high or trades on elevated volume above its 50-day average.",
    },
  }),

  /* ============================= ENTRY TIMING ============================= */
  screenedStrategy({
    id: "strategy:quality-compounders-on-pullback",
    slug: "quality-compounders-on-pullback",
    name: "Quality Compounders on Pullback",
    section: "ENTRY_TIMING",
    category: "VALUE_INVESTING",
    status: "active",
    version: 1,
    isFeatured: false,
    sortOrder: 4,
    icon: "Gem",
    valueProposition: "Durable, cash-generating large caps 12–30% off their highs, alerted when the price reclaims its 50-day average.",
    description:
      "Large companies with positive free cash flow, three straight profitable years and manageable debt, currently in a meaningful pullback. Instead of a fixed price, the alert fires when the stock reclaims its 50-day moving average.",
    landing: {
      eyebrow: "Quality on pullback",
      headline: "Better companies. More disciplined entry points.",
      description: "Track financially strong businesses during corrections and get alerted when the price begins to recover.",
      cta: "Activate the Compounder Watchlist",
    },
    triggerRules: [
      "The price crosses back above its 50-day moving average (the prior session closed below it, and the price is now above it).",
      "No fixed dollar targets; the level moves with the stock, so the list does not go stale between refreshes.",
      "One email per reclaim, then the alert pauses.",
    ],
    triggerSummary: "Reclaims the 50-day moving average",
    disqualifiers: [
      "Negative free cash flow, a loss in any of the last three fiscal years, or falling revenue.",
      "Net debt above 3× EBITDA (not applied to banks and insurers).",
      "Less than 12% or more than 30% below the 52-week high.",
      "More than 8% below the 200-day average, which suggests the longer trend has broken.",
      "Already above the 50-day average (the reclaim has happened).",
      "Missed the latest EPS estimate by more than 10%.",
    ],
    refreshCadence: "Monthly, and after each constituent reports earnings",
    refreshIntervalDays: 31,
    watches:
      "Large, consistently profitable businesses that have pulled back meaningfully but not collapsed, still within reach of their 200-day average. The alert is the first sign the short-term trend is turning: a cross back above the 50-day average.",
    whyInvestorsWatch:
      "Buying a good business during a correction is a common long-term approach, but a falling price gives no sign of when the selling is done. Waiting for the price to reclaim a moving average trades some of the discount for evidence that buyers have returned, which many investors prefer to picking a bottom.",
    whenItFails: [
      "A reclaim of the 50-day average can fail within days; whipsaws are common in choppy markets.",
      "The pullback may be justified. Trailing fundamentals do not show a competitive problem that is only starting.",
      "Guidance cuts are not in the data. The EPS-surprise proxy only catches an outright miss.",
      "Large caps can trade sideways for years; a reclaim says nothing about how long a recovery takes.",
    ],
    methodology: `${SCREEN_METHOD} Profitability is checked across the last three annual income statements; leverage and cash flow use trailing-twelve-month figures.`,
    dataLimitations: [
      NO_GUIDANCE,
      "No valuation model is applied. The trigger is technical (the 50-day reclaim) because reliable point-in-time valuation history is not available from the provider.",
    ],
    riskSummary:
      "A strong balance sheet does not prevent a stock from falling further. The alert marks a change in price behavior, not a valuation judgment, and a reclaim can reverse.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ reclaimed its 50-day average — here's what moved it",
      volumeMultiple: 1.3,
      badge: "Reclaimed 50-day",
      alertType: "Pullback recovery",
      priceLabel: "Price",
      price: "$188.40",
      change: "+2.1%",
      time: "11:15 AM ET",
      volume: "5.4M (1.3x avg)",
      marketCap: "$96B",
      whyTitle: "Why it triggered",
      why: "Closed below its 50-day yesterday, crossed above it today",
      context:
        "XYZ crossed back above its 50-day moving average ($186.90) after six weeks below it. It remains 17% below its 52-week high and above its 200-day average. On the list for positive free cash flow, three straight profitable years and net debt under 1x EBITDA. Investors often watch whether the reclaim holds for several sessions.",
    },
    related: ["leader-pullback-and-reclaim", "dividend-growth-buy-zones", "200-day-comeback-watchlist"],
    seo: {
      title: "Quality Compounders on Pullback: 50-Day Reclaim Alerts",
      description:
        "Free alerts when financially strong large caps in a 12–30% pullback reclaim their 50-day moving average. No fixed prices; the list is screened monthly.",
    },
  }),

  screenedStrategy({
    id: "strategy:leader-pullback-and-reclaim",
    slug: "leader-pullback-and-reclaim",
    name: "Leader Pullback and Reclaim",
    section: "ENTRY_TIMING",
    category: "MOMENTUM",
    status: "active",
    version: 1,
    isFeatured: false,
    sortOrder: 5,
    icon: "Activity",
    valueProposition: "Large, trending companies 8–20% off their highs with a cooled RSI, alerted only when the price reclaims its 50-day average.",
    description:
      "Established leaders that are still above their 200-day average but have pulled back 8–20% with RSI in the 35–45 area. The alert waits for the reclaim of the 50-day moving average rather than firing on the low reading itself.",
    landing: {
      eyebrow: "Pullback confirmation",
      headline: "Don’t catch the falling knife. Wait for buyers to return.",
      description: "Track strong companies during a correction and get alerted only when the price begins to reclaim its trend.",
      cta: "Activate Pullback and Reclaim Alerts",
    },
    triggerRules: [
      "The price crosses back above its 50-day moving average.",
      "The email includes volume against the 30-day average so you can see whether the reclaim had participation.",
      "One email per reclaim, then the alert pauses.",
    ],
    triggerSummary: "Reclaims the 50-day moving average",
    disqualifiers: [
      "Market cap under $50 billion or average volume under 2 million shares.",
      "Below the 200-day average (the medium-term trend has broken).",
      "Less than 8% or more than 20% below the 52-week high.",
      "RSI outside 35–45: either not cooled off yet, or washed out.",
      "Already above the 50-day average.",
      "Missed the latest EPS estimate by more than 10%.",
    ],
    refreshCadence: "Weekly",
    refreshIntervalDays: 7,
    watches:
      "The largest, most liquid companies whose longer trend is intact but whose shares have pulled back into a range that many traders consider a normal correction, with momentum cooled but not exhausted. The alert is the reclaim of the 50-day average.",
    whyInvestorsWatch:
      "An oversold reading alone says only that a stock has fallen fast; it can keep falling. Requiring the price to cross back above a moving average shifts the question from 'how low is it?' to 'have buyers stepped in?', which is the evidence many investors want before looking closer at a pullback.",
    whenItFails: [
      "Reclaims fail. A stock can cross the 50-day average and roll over within a session or two.",
      "The pullback may be the start of a larger decline that the 200-day rule has not caught yet.",
      "RSI in the 35–45 band can persist for weeks; the list will hold names that never reclaim before the next refresh.",
      "Broad-market moves drive most large-cap reclaims; the signal can say more about the index than the company.",
    ],
    methodology: `${SCREEN_METHOD} RSI is the 14-day daily reading from the provider's technical-indicator feed, fetched only for names that pass the price rules.`,
    dataLimitations: [NO_GUIDANCE],
    riskSummary:
      "A correction in a leader can turn into a longer decline. The reclaim is a change in price behavior that investors monitor, not a signal that the low is in.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ reclaimed its 50-day average — here's what moved it",
      volumeMultiple: 1.5,
      badge: "Reclaimed 50-day",
      alertType: "Pullback and reclaim",
      priceLabel: "Price",
      price: "$412.80",
      change: "+2.6%",
      time: "1:05 PM ET",
      volume: "9.8M (1.5x avg)",
      marketCap: "$310B",
      whyTitle: "Why it triggered",
      why: "Closed below its 50-day yesterday, crossed above it today",
      context:
        "XYZ crossed back above its 50-day moving average ($409.20) on 1.5x average volume. It is 11% below its 52-week high and above its 200-day average; RSI was 41 when the list was built. Investors often watch whether the reclaim holds for several sessions before treating the pullback as finished.",
    },
    related: ["quality-compounders-on-pullback", "200-day-comeback-watchlist", "quality-breakout-radar"],
    seo: {
      title: "Leader Pullback and Reclaim: 50-Day Reclaim Alerts on Large Caps",
      description:
        "Free alerts when large, trending companies 8–20% off their highs with a cooled RSI reclaim the 50-day moving average. Screened weekly.",
    },
  }),

  screenedStrategy({
    id: "strategy:200-day-comeback-watchlist",
    slug: "200-day-comeback-watchlist",
    name: "200-Day Comeback Watchlist",
    section: "ENTRY_TIMING",
    category: "MOMENTUM",
    status: "active",
    version: 1,
    isFeatured: false,
    sortOrder: 6,
    icon: "RotateCcw",
    valueProposition: "Established companies that have spent months below their 200-day average and are improving, alerted on the first confirmed cross back above it.",
    description:
      "Liquid large caps at least 20% off their highs that closed below the 200-day average on most of the last 60 sessions, with a sound balance sheet and price behavior already improving. The alert is the first confirmed cross back above the 200-day average.",
    landing: {
      eyebrow: "Trend reversal",
      headline: "Get alerted when a former leader begins its comeback.",
      description: "Watch established companies recovering from major corrections and get notified on the first confirmed reclaim of the 200-day trend.",
      cta: "Activate Comeback Alerts",
    },
    triggerRules: [
      "The price crosses above its 200-day moving average after the prior session closed below it.",
      "The email shows volume against the 30-day average and the distance from the 50-day average.",
      "One email per cross, then the alert pauses.",
    ],
    triggerSummary: "First confirmed cross above the 200-day moving average",
    disqualifiers: [
      "More than 20% below the 200-day average (too far from the trigger to be a near-term event).",
      "Fewer than 40 of the last 60 sessions closed below the 200-day average (not a sustained downtrend).",
      "Less than 20% below the 52-week high.",
      "Net debt above 4× EBITDA (not applied to banks and insurers).",
      "Below the 50-day average, or within 8% of the 52-week low (no improvement yet).",
    ],
    refreshCadence: "Weekly",
    refreshIntervalDays: 7,
    watches:
      "Well-known companies that have been in a genuine downtrend for months, not days, whose balance sheets look sound and whose shares have already started to firm up. The alert is the cross back above the 200-day average, a level many investors use to define whether a stock is in an uptrend.",
    whyInvestorsWatch:
      "The 200-day moving average is one of the most widely followed trend lines, and a stock that spent months below it and crosses back above is a visible change in character. Investors often use the cross to start looking at a former leader again rather than trying to guess where the decline ends.",
    whenItFails: [
      "First crosses frequently fail; a stock can cross the 200-day average several times before a trend is established.",
      "A cheap balance-sheet screen does not catch a deteriorating business. Some declines are deserved and continue.",
      "The alert fires on an intraday cross, not a closing cross, so a reversal later in the session is possible.",
      "In a falling market the 200-day average itself is falling, which makes crosses easier and less meaningful.",
    ],
    methodology: `${SCREEN_METHOD} Time below the 200-day average is counted from the provider's daily SMA series (closes below the average over the last 60 sessions).`,
    dataLimitations: ["Net debt / EBITDA is not applied to banks and insurers.", "No earnings or guidance data is used in this screen."],
    riskSummary:
      "Stocks in long downtrends are there for a reason, and a cross above an average does not repair a business. Use the alert as a reason to re-read the story, not as confirmation that it has changed.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ crossed above its 200-day average — here's what moved it",
      volumeMultiple: 1.4,
      badge: "Crossed 200-day",
      alertType: "Comeback signal",
      priceLabel: "Price",
      price: "$218.40",
      change: "+2.9%",
      time: "11:40 AM ET",
      volume: "6.8M (1.4x avg)",
      marketCap: "$160B",
      whyTitle: "Why it triggered",
      why: "Closed below its 200-day yesterday, crossed above it today",
      context:
        "XYZ crossed above its 200-day moving average ($215.10) after closing below it on 52 of the last 60 sessions. It is 24% below its 52-week high and above its 50-day average. Investors often watch whether a first cross holds for several sessions before treating the downtrend as over.",
    },
    related: ["leader-pullback-and-reclaim", "quality-compounders-on-pullback", "market-stress-alerts"],
    seo: {
      title: "200-Day Comeback Watchlist: Reclaim Alerts on Beaten-Down Large Caps",
      description:
        "Free alerts on the first cross back above the 200-day moving average for established companies that spent months below it. Screened weekly from market data.",
    },
  }),

  screenedStrategy({
    id: "strategy:dividend-growth-buy-zones",
    slug: "dividend-growth-buy-zones",
    name: "Dividend Growth Buy Zones",
    section: "ENTRY_TIMING",
    category: "DIVIDEND",
    status: "active",
    version: 1,
    isFeatured: false,
    sortOrder: 7,
    icon: "Coins",
    valueProposition: "Companies with five-plus years of dividend growth and a covered payout, alerted when the yield reaches the top of its own five-year range.",
    description:
      "Dividend growers with a covered payout and manageable debt. For each one the alert price is calculated from its own yield history: the level where the forward yield reaches the top fifth of the last five years. Names already there are watched for a 200-day reclaim instead.",
    landing: {
      eyebrow: "Dividend growth",
      headline: "A higher yield is useful only when the dividend is built to last.",
      description: "Track financially sound dividend growers and get alerted when their yields move into more attractive territory.",
      cta: "Activate Dividend Buy-Zone Alerts",
    },
    triggerRules: [
      "A price alert at the buy-zone level: forward annual dividend ÷ the 80th-percentile yield of the last five years' ex-dividend dates. The level is recalculated at every refresh.",
      "If the yield is already in the zone, the alert is the reclaim of the 200-day moving average instead, so the decline that created the yield has to show signs of ending.",
      "One email per event, then the alert pauses.",
    ],
    triggerSummary: "Price reaches the calculated buy-zone yield, or reclaims the 200-day average",
    disqualifiers: [
      "Fewer than five consecutive years of annual dividend growth.",
      "Latest payment below the payment a year earlier (a cut).",
      "Payout not covered: earnings payout 75% or higher and free-cash-flow payout 90% or higher.",
      "Net debt above 3.5× EBITDA (not applied to banks and insurers).",
      "Yield already in the zone and price already above the 200-day average (nothing pending to alert on).",
    ],
    refreshCadence: "Monthly, and after a dividend change or earnings report",
    refreshIntervalDays: 31,
    watches:
      "Dividend payers whose record and coverage suggest the payment can keep growing, watched for the price at which their own yield becomes high by their own standards, not by comparison with other stocks. A stock is never on the list only because its price fell.",
    whyInvestorsWatch:
      "Yield rises when price falls, and a rising yield on a stable dividend is one way income investors look for entry points. Comparing today's yield with the company's own history avoids chasing a high yield that is high because the dividend is at risk. The coverage and growth rules are there to keep those names off the list.",
    whenItFails: [
      "Dividend history is backward-looking. A company can have a ten-year growth record and cut next quarter.",
      "A yield at the top of its range can go higher. The buy-zone price is a reference level, not a floor.",
      "Payout coverage uses trailing earnings and free cash flow; a sharp profit drop changes both quickly.",
      "Rate moves affect the whole group: dividend stocks can fall together when yields on bonds rise, regardless of company results.",
    ],
    methodology: `${SCREEN_METHOD} Dividend growth is measured on calendar-year totals of adjusted dividends; the yield range uses the yield recorded at each ex-dividend date over the last five years; coverage uses the trailing earnings payout ratio and the latest fiscal year's dividends paid versus free cash flow.`,
    dataLimitations: [
      "Special dividends are included in the calendar-year totals and can affect the growth count.",
      "Forward annual dividend is the latest regular payment annualized; announced-but-unpaid increases are not reflected until they pay.",
      "The comparison is with the company's own yield history only; sector or market yields are not used.",
    ],
    riskSummary:
      "Dividends are not guaranteed and can be reduced or suspended. A higher yield reflects a lower price, and the reasons for that price may be sound. Nothing here is a recommendation to buy for income.",
    sampleAlert: {
      ticker: "XYZ",
      companyName: "Example Co.",
      subject: "XYZ reached its dividend buy zone — here's what moved it",
      volumeMultiple: 1.2,
      badge: "Price below $58.20",
      alertType: "Dividend buy zone",
      priceLabel: "Price",
      price: "$57.95",
      change: "-1.8%",
      time: "2:20 PM ET",
      volume: "8.1M (1.2x avg)",
      marketCap: "$74B",
      whyTitle: "Why it triggered",
      why: "Forward yield reached 3.4%, the top fifth of its five-year range",
      context:
        "XYZ traded below $58.20, the level where its forward yield of $1.98 per share reaches 3.4%, a yield it has offered only about a fifth of the time over the last five years. Nine straight years of dividend growth; earnings payout 61%. Investors often check the reason for the decline before treating a higher yield as an opportunity.",
    },
    related: ["quality-compounders-on-pullback", "market-stress-alerts", "sector-leadership-radar"],
    seo: {
      title: "Dividend Growth Buy Zones: Yield-Based Alerts on Dividend Growers",
      description:
        "Free alerts when covered, growing dividends reach the top of their own five-year yield range. Buy-zone prices are calculated from each company's history and refreshed monthly.",
    },
  }),

  /* ====================== MARKET AND PORTFOLIO MONITORING ================= */
  fixedStrategy({
    id: "strategy:sector-leadership-radar",
    slug: "sector-leadership-radar",
    name: "Sector Leadership Radar",
    section: "MARKET_MONITORING",
    category: "MACRO",
    status: "active",
    version: 2,
    isFeatured: false,
    sortOrder: 8,
    icon: "Compass",
    valueProposition: "All 11 S&P sector ETFs, alerted when one crosses above its 50-day average, with trend and relative-strength context in the email.",
    description:
      "One alert per sector ETF, firing on a cross above the 50-day moving average. Each email says whether the sector is above or below its 50- and 200-day averages and how it has done against the S&P 500 over the last month, so you can tell an improving trend from a short bounce.",
    landing: {
      eyebrow: "Sector leadership",
      headline: "See where market strength is moving.",
      description: "Track all 11 major sectors and get alerted when a sector’s trend begins to improve.",
      cta: "Activate Sector Leadership Alerts",
    },
    universe: "The 11 Select Sector SPDR ETFs that divide the S&P 500 by GICS sector.",
    qualificationRules: [
      "All 11 sectors are always on the list; there is no screen.",
      "Each alert re-arms itself for the next cross when you edit it or turn it back on.",
    ],
    triggerRules: [
      "The ETF crosses above its 50-day moving average after the prior session closed below it.",
      "The email states: above or below the 50- and 200-day averages; the ETF's 21-session return versus SPY; and whether the cross came with above-average volume.",
      "A cross with the ETF still below its 200-day average and lagging SPY is labeled as a bounce within a downtrend, not as improving leadership.",
    ],
    triggerSummary: "Cross above the 50-day moving average",
    disqualifiers: ["None. All 11 sectors are monitored continuously."],
    refreshCadence: "Fixed list; copy reviewed quarterly",
    refreshIntervalDays: 92,
    watches:
      "Whether each sector's price is turning up relative to its recent average, and how that compares with the broad market. The alert is the cross itself; the context in the email is what tells you whether it looks like a change in leadership or a short-term bounce.",
    whyInvestorsWatch:
      "Sector performance rotates, and many investors track relative strength between sectors to understand what the market is rewarding. A cross above the 50-day average is a simple, widely used marker of a short-term trend change; combined with the 200-day position and performance against SPY, it gives a quick read on whether a sector is leading or just recovering.",
    whenItFails: [
      "Sector ETFs cross their 50-day averages often; in choppy markets most crosses reverse.",
      "A cross tells you about price, not about money flows. It does not show who is buying.",
      "One or two large holdings can move a sector ETF; the signal may reflect a single company.",
      "Relative performance over 21 sessions is short; it can flip the week after an alert.",
    ],
    methodology:
      "Each alert uses the alert engine's SMA-cross evaluation on the daily 50-day average. When an alert fires, the engine adds the ETF's position versus its 50- and 200-day averages, its 21-session return against SPY, and its volume versus the 30-day average to the email. No forecast is made.",
    dataLimitations: [
      "A moving-average cross measures price, not who is buying or selling; no fund-flow or ownership data is used, and none is claimed.",
      "Relative performance is computed from daily closes and is approximate on the alert day.",
    ],
    riskSummary:
      "A sector's trend can improve for reasons that do not last. The alert describes what happened to the price and how it compares with the index; it is not a rotation recommendation.",
    sampleAlert: {
      ticker: "XLE",
      companyName: "Energy Select Sector SPDR",
      subject: "Energy (XLE) crossed above its 50-day — trend and relative strength",
      volumeMultiple: 1.2,
      badge: "Crossed 50-day",
      alertType: "Sector leadership",
      priceLabel: "Price",
      price: "$92.30",
      change: "+1.7%",
      time: "9:50 AM ET",
      volume: "14.1M (1.2x avg)",
      marketCap: "$36B AUM",
      whyTitle: "Why it triggered",
      why: "Crossed above its 50-day average after six weeks below it",
      context:
        "XLE crossed above its 50-day moving average. It is above its 200-day average and has outperformed SPY by 3.1 points over the last 21 sessions, so this reads as improving leadership rather than a bounce within a downtrend. Volume is 1.2x average. Investors often watch whether the ETF holds above the average for several sessions.",
    },
    related: ["market-stress-alerts", "quality-breakout-radar", "200-day-comeback-watchlist"],
    seo: {
      title: "Sector Leadership Radar: 50-Day Cross Alerts on All 11 Sectors",
      description:
        "Free alerts when any of the 11 S&P sector ETFs crosses above its 50-day average, with 200-day position and performance versus SPY in every email.",
    },
    items: SECTOR_ETFS.map(([ticker, name, holds], i) => ({
      ticker,
      companyName: name,
      alertType: "SMA_CROSS_ABOVE",
      triggerDirection: "ABOVE",
      triggerValue: 50,
      rationale: `${name}: ${holds}. Alert on a cross above the 50-day average, with 200-day position and performance vs. SPY in the email.`,
      sortOrder: i + 1,
    })),
  }),

  fixedStrategy({
    id: "strategy:market-stress-alerts",
    slug: "market-stress-alerts",
    name: "Market Stress Alerts",
    section: "MARKET_MONITORING",
    category: "MACRO",
    status: "active",
    version: 2,
    isFeatured: false,
    sortOrder: 9,
    icon: "Gauge",
    valueProposition: "Volatility thresholds, large index moves, and 200-day trend breaks on the S&P 500, Nasdaq-100, small caps, Treasuries and credit, described plainly.",
    description:
      "Market context, not stock selection: VIX crossing 25 and 35 (and falling below 13), 2% days on SPY, 3% days on QQQ, SPY and IWM crossing their 200-day averages, and 2% moves in long-term Treasuries or 1.5% in high-yield credit.",
    landing: {
      eyebrow: "Market conditions",
      headline: "Know when the market environment changes.",
      description: "Monitor volatility, broad-market trend breaks, and unusually large index moves without watching the market all day.",
      cta: "Activate Market Stress Alerts",
    },
    universe: "The CBOE Volatility Index and five broad ETFs: SPY (S&P 500), QQQ (Nasdaq-100), IWM (Russell 2000), TLT (20+ year Treasuries) and HYG (high-yield corporate bonds).",
    qualificationRules: [
      "Fixed set of instruments; there is no screen.",
      "Thresholds are fixed and stated on every alert so you can judge them yourself.",
    ],
    triggerRules: [
      "VIX above 25, VIX above 35, VIX below 13.",
      "SPY moves 2% or more in a session; QQQ moves 3% or more (either direction, at most one email per day).",
      "SPY crosses below its 200-day average; SPY crosses back above it; IWM crosses below its 200-day average.",
      "TLT moves 2% or more in a session; HYG moves 1.5% or more in a session.",
    ],
    triggerSummary: "VIX levels, 2–3% index days, 200-day crosses, bond and credit moves",
    disqualifiers: ["None. The instruments are fixed."],
    refreshCadence: "Fixed list; thresholds reviewed quarterly",
    refreshIntervalDays: 92,
    watches:
      "The handful of readings investors use to describe the market environment: implied volatility, the size of daily index moves, whether the major indexes are above their long-term averages, and stress in rates and credit. Each alert says exactly which threshold was crossed and where the instrument stands.",
    whyInvestorsWatch:
      "Most individual stocks move with the market on their worst days. Knowing that volatility has jumped, that the index has broken its 200-day average, or that credit is selling off gives context for what is happening in a portfolio and for how much of a stock's move is its own. Investors monitor these levels to decide when to pay closer attention, not because any one of them predicts what comes next.",
    whenItFails: [
      "Volatility thresholds are round numbers; VIX 25 in one market regime means something different in another.",
      "A 200-day cross on an index often reverses within days, especially in sideways markets.",
      "Large daily moves cluster. During a volatile stretch these alerts fire often and stop being informative.",
      "None of these readings has a fixed relationship with what the market does next, and no claim is made that they do.",
    ],
    methodology:
      "Each alert maps to one supported alert type: price thresholds on the VIX, daily percentage moves on the ETFs, and 200-day SMA crosses. The VIX is quoted from the provider under the symbol ^VIX. Daily-move alerts notify at most once per trading day; threshold and cross alerts fire once and pause until re-armed.",
    dataLimitations: [
      "No claim is made about what typically follows any of these readings. Calling a level an opportunity would require a documented study, and none is presented.",
      "The VIX quote has no volume, so the email omits the volume line for VIX alerts.",
    ],
    riskSummary:
      "These alerts describe conditions, not opportunities. Elevated volatility can persist, and a broken trend can stay broken. Use them as context for your own decisions.",
    sampleAlert: {
      ticker: "SPY",
      companyName: "SPDR S&P 500 ETF",
      subject: "SPY crossed below its 200-day average — what changed",
      volumeMultiple: 1.7,
      badge: "Crossed below 200-day",
      alertType: "Market stress",
      priceLabel: "Price",
      price: "$531.20",
      change: "-2.3%",
      time: "3:10 PM ET",
      volume: "112M (1.7x avg)",
      marketCap: "$540B AUM",
      whyTitle: "Why it triggered",
      why: "Closed above its 200-day yesterday, crossed below it today",
      context:
        "SPY crossed below its 200-day moving average ($538.40) on 1.7x average volume, down 2.3% on the day. The VIX is at 27. The 200-day average is a level many investors use to define the broad-market trend; a close below it is often watched for follow-through over the next sessions.",
    },
    related: ["sector-leadership-radar", "200-day-comeback-watchlist", "earnings-calendar-alerts"],
    seo: {
      title: "Market Stress Alerts: VIX, Index Moves and 200-Day Trend Breaks",
      description:
        "Free alerts for VIX thresholds, 2–3% days on SPY and QQQ, 200-day crosses on SPY and IWM, and large moves in Treasuries and high-yield credit. Context, not predictions.",
    },
    items: [
      { ticker: "^VIX", companyName: "CBOE Volatility Index", alertType: "PRICE_ABOVE", triggerDirection: "ABOVE", triggerValue: 25, rationale: "VIX above 25: options markets pricing elevated near-term volatility.", sortOrder: 1 },
      { ticker: "^VIX", companyName: "CBOE Volatility Index", alertType: "PRICE_ABOVE", triggerDirection: "ABOVE", triggerValue: 35, rationale: "VIX above 35: options markets pricing acute near-term volatility.", sortOrder: 2 },
      { ticker: "^VIX", companyName: "CBOE Volatility Index", alertType: "PRICE_BELOW", triggerDirection: "BELOW", triggerValue: 13, rationale: "VIX below 13: options markets pricing very low near-term volatility.", sortOrder: 3 },
      { ticker: "SPY", companyName: "SPDR S&P 500 ETF", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 2, rationale: "S&P 500 ETF moves 2% or more in a session, either direction.", sortOrder: 4 },
      { ticker: "QQQ", companyName: "Invesco QQQ (Nasdaq-100)", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 3, rationale: "Nasdaq-100 ETF moves 3% or more in a session, either direction.", sortOrder: 5 },
      { ticker: "SPY", companyName: "SPDR S&P 500 ETF", alertType: "SMA_CROSS_BELOW", triggerDirection: "BELOW", triggerValue: 200, rationale: "S&P 500 ETF crosses below its 200-day average, the long-term trend line many investors track.", sortOrder: 6 },
      { ticker: "SPY", companyName: "SPDR S&P 500 ETF", alertType: "SMA_CROSS_ABOVE", triggerDirection: "ABOVE", triggerValue: 200, rationale: "S&P 500 ETF crosses back above its 200-day average after trading below it.", sortOrder: 7 },
      { ticker: "IWM", companyName: "iShares Russell 2000 ETF", alertType: "SMA_CROSS_BELOW", triggerDirection: "BELOW", triggerValue: 200, rationale: "Small-cap index ETF crosses below its 200-day average.", sortOrder: 8 },
      { ticker: "TLT", companyName: "iShares 20+ Year Treasury Bond ETF", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 2, rationale: "Long-term Treasury ETF moves 2% or more in a session: a large move in long-term interest rates.", sortOrder: 9 },
      { ticker: "HYG", companyName: "iShares iBoxx High Yield Corporate Bond ETF", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 1.5, rationale: "High-yield bond ETF moves 1.5% or more in a session: a large move in credit conditions.", sortOrder: 10 },
    ],
  }),

  fixedStrategy({
    id: "strategy:earnings-calendar-alerts",
    slug: "earnings-calendar-alerts",
    name: "Earnings Calendar Alerts",
    section: "MARKET_MONITORING",
    category: "EARNINGS",
    status: "active",
    version: 2,
    isFeatured: false,
    sortOrder: 10,
    icon: "CalendarClock",
    valueProposition: "A reminder three days before seven of the most widely held companies report, plus an alert when Apple, NVIDIA or Tesla moves unusually far in a session.",
    description:
      "Portfolio monitoring, not idea discovery: reminders three days before Apple, NVIDIA, Tesla, Meta, Amazon, Microsoft and Alphabet report, and a same-day alert when AAPL moves 5% or NVDA and TSLA move 7% in a session.",
    landing: {
      eyebrow: "Earnings monitoring",
      headline: "Don’t let an earnings date catch you by surprise.",
      description: "Get a reminder before important companies report and a follow-up alert when the stock makes an unusually large move.",
      cta: "Activate Earnings Calendar Alerts",
    },
    universe: "Seven of the most widely held US companies: Apple, NVIDIA, Tesla, Meta, Amazon, Microsoft and Alphabet.",
    qualificationRules: ["Fixed list chosen for how widely the companies are held; there is no screen."],
    triggerRules: [
      "Reminder: fires when the next scheduled report date is within 3 days, once per report.",
      "Large move: AAPL moves 5% or more, NVDA or TSLA moves 7% or more in a session, either direction. These fire on any such day, earnings or not, at most once per day.",
    ],
    triggerSummary: "3-day earnings reminders, plus 5–7% single-day moves",
    disqualifiers: ["None. The list is fixed."],
    refreshCadence: "Fixed list; reviewed quarterly",
    refreshIntervalDays: 92,
    watches:
      "The earnings calendar for the companies most portfolios hold, and the size of daily moves in the three of them that tend to move the most. The reminder gives you time to review a position before a report; the move alert tells you when something large has happened.",
    whyInvestorsWatch:
      "Earnings reports are the scheduled events most likely to reprice a stock in a single session. Knowing the date in advance lets investors review positions, options exposure or cash needs on their own schedule, and a large-move alert is a prompt to read the news rather than discover it later.",
    whenItFails: [
      "Report dates change. The reminder uses the provider's calendar, which can be a projected date until the company confirms it.",
      "Large-move alerts fire on any 5–7% day, not only earnings; in a volatile market they can arrive often.",
      "A reminder is not a view on the report. Nothing here suggests what the results will be.",
    ],
    methodology:
      "Reminders use the alert engine's earnings-reminder type, which checks the next scheduled date from the provider's earnings calendar. Move alerts use the daily percentage-change type on the day's change from the previous close.",
    dataLimitations: ["Earnings dates for companies that have not yet confirmed a date can be estimates and may shift."],
    riskSummary:
      "Earnings reactions are unpredictable in size and direction. These alerts help you keep track of dates and moves; they do not indicate how a stock will react.",
    sampleAlert: {
      ticker: "AAPL",
      companyName: "Apple Inc.",
      subject: "AAPL reports in 3 days — reminder",
      badge: "Earnings in 3 days",
      alertType: "Earnings reminder",
      priceLabel: "Price",
      price: "$228.40",
      change: "+0.6%",
      time: "9:35 AM ET",
      volume: "41M",
      marketCap: "$3.5T",
      whyTitle: "Why it triggered",
      why: "Scheduled report date is within 3 days",
      context:
        "Apple is scheduled to report after the close on Thursday. The stock is 4% below its 52-week high and above both moving averages. Investors often review position size and any options exposure before a scheduled report.",
    },
    related: ["post-earnings-strength-radar", "market-stress-alerts", "quality-breakout-radar"],
    seo: {
      title: "Earnings Calendar Alerts: Reminders and Big-Move Alerts",
      description:
        "Free reminders three days before Apple, NVIDIA, Tesla, Meta, Amazon, Microsoft and Alphabet report, plus same-day alerts on unusually large moves in AAPL, NVDA and TSLA.",
    },
    items: [
      ...EARNINGS_NAMES.map(([ticker, name], i) => ({
        ticker,
        companyName: name,
        alertType: "EARNINGS_REMINDER" as const,
        triggerDirection: "BOTH" as const,
        triggerValue: 3,
        rationale: `${name}: reminder 3 days before the next scheduled report.`,
        sortOrder: i + 1,
      })),
      { ticker: "AAPL", companyName: "Apple", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 5, rationale: "Apple moves 5% or more in a session, either direction.", sortOrder: 8 },
      { ticker: "NVDA", companyName: "NVIDIA", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 7, rationale: "NVIDIA moves 7% or more in a session, either direction.", sortOrder: 9 },
      { ticker: "TSLA", companyName: "Tesla", alertType: "PERCENT_CHANGE_DAY", triggerDirection: "BOTH", triggerValue: 7, rationale: "Tesla moves 7% or more in a session, either direction.", sortOrder: 10 },
    ],
  }),
];

/* ------------------------------- lookups --------------------------------- */

export const STRATEGY_SLUGS = STRATEGIES.map((s) => s.slug);

export const getStrategy = (slug: string): StrategyDefinition | null => STRATEGIES.find((s) => s.slug === slug) ?? null;

/** Featured first (in their own order), then the rest by sortOrder. */
export const orderedStrategies = (): StrategyDefinition[] =>
  [...STRATEGIES].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder);

export interface SectionGroup {
  section: SectionInfo;
  strategies: StrategyDefinition[];
}

/** The index layout: three sections in catalog order, strategies featured-first within each. */
export const groupedBySection = (): SectionGroup[] =>
  SECTION_ORDER.map((id) => ({
    section: SECTIONS[id],
    strategies: orderedStrategies().filter((s) => s.section === id),
  }));

export const isStrategyScreened = (s: StrategyDefinition) => isScreenedSlug(s.slug);

/** Days since the list was rebuilt, or null when never built. */
export function refreshAgeDays(s: StrategyDefinition, now = new Date()): number | null {
  if (!s.lastRefreshedAt) return null;
  const then = new Date(s.lastRefreshedAt).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export const isRefreshOverdue = (s: StrategyDefinition, now = new Date()) => {
  const age = refreshAgeDays(s, now);
  return age === null || age > s.refreshIntervalDays;
};

export const DISCLAIMER = DISCLAIMER_LINE;
