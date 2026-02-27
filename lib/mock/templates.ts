export type TemplateCategory =
  | "EARNINGS"
  | "VALUE_INVESTING"
  | "MOMENTUM"
  | "DIVIDEND"
  | "MACRO"
  | "AI_PICKS";

export interface TemplateItem {
  ticker: string;
  companyName?: string;
  alertType: string;
  triggerDirection: "ABOVE" | "BELOW" | "BOTH";
  triggerValue: number;
  rationale?: string;
  sortOrder: number;
}

export interface AlertTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  category: TemplateCategory;
  iconEmoji: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  items: TemplateItem[];
}

export const mockTemplates: AlertTemplate[] = [
  {
    id: "tmpl-earnings",
    name: "Earnings Season Alerts",
    slug: "earnings-season-alerts",
    description:
      "Get alerted before and during earnings for the market's most-watched stocks. Never get blindsided by an earnings surprise again.",
    longDescription:
      "Stay ahead of earnings volatility with reminders and intraday move alerts for the most-watched large-cap stocks.",
    category: "EARNINGS",
    iconEmoji: "🎯",
    isActive: true,
    isFeatured: true,
    sortOrder: 1,
    items: [
      {
        ticker: "AAPL",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before Apple earnings — review your position",
        sortOrder: 1,
      },
      {
        ticker: "NVDA",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before NVIDIA earnings — the most-watched AI stock",
        sortOrder: 2,
      },
      {
        ticker: "TSLA",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before Tesla earnings — expect volatility",
        sortOrder: 3,
      },
      {
        ticker: "META",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before Meta earnings — ad revenue is key metric",
        sortOrder: 4,
      },
      {
        ticker: "AMZN",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before Amazon earnings — watch AWS growth",
        sortOrder: 5,
      },
      {
        ticker: "MSFT",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before Microsoft earnings — Azure and AI focus",
        sortOrder: 6,
      },
      {
        ticker: "GOOGL",
        alertType: "EARNINGS_REMINDER",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "3 days before Alphabet earnings — search and cloud",
        sortOrder: 7,
      },
      {
        ticker: "AAPL",
        alertType: "PERCENT_CHANGE_DAY",
        triggerDirection: "BOTH",
        triggerValue: 5,
        rationale: "AAPL moves 5%+ on earnings day — big move alert",
        sortOrder: 8,
      },
      {
        ticker: "NVDA",
        alertType: "PERCENT_CHANGE_DAY",
        triggerDirection: "BOTH",
        triggerValue: 7,
        rationale: "NVDA moves 7%+ on earnings day — big move alert",
        sortOrder: 9,
      },
      {
        ticker: "TSLA",
        alertType: "PERCENT_CHANGE_DAY",
        triggerDirection: "BOTH",
        triggerValue: 7,
        rationale: "TSLA moves 7%+ on earnings day — big move alert",
        sortOrder: 10,
      },
    ],
  },
  {
    id: "tmpl-value",
    name: "Buffett-Style Value Watchlist",
    slug: "buffett-style-value-watchlist",
    description:
      "Alerts set at historically attractive entry points for high-quality blue chip companies. Inspired by Warren Buffett's value investing principles.",
    longDescription:
      "Value alerts for durable franchises with strong balance sheets. Built to surface potential long-term entry points.",
    category: "VALUE_INVESTING",
    iconEmoji: "💰",
    isActive: true,
    isFeatured: true,
    sortOrder: 2,
    items: [
      {
        ticker: "BRK-B",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 480,
        rationale: "Berkshire below $480 — historically attractive P/B ratio",
        sortOrder: 1,
      },
      {
        ticker: "AAPL",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 200,
        rationale: "Apple below $200 — potential value zone based on earnings yield",
        sortOrder: 2,
      },
      {
        ticker: "KO",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 58,
        rationale: "Coca-Cola below $58 — dividend yield crosses above 3.2%",
        sortOrder: 3,
      },
      {
        ticker: "JNJ",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 148,
        rationale: "J&J below $148 — quality healthcare at a discount",
        sortOrder: 4,
      },
      {
        ticker: "PG",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 160,
        rationale: "P&G below $160 — defensive staple at attractive yield",
        sortOrder: 5,
      },
      {
        ticker: "JPM",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 230,
        rationale: "JPMorgan below $230 — bank leader at value pricing",
        sortOrder: 6,
      },
      {
        ticker: "V",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 290,
        rationale: "Visa below $290 — payments duopoly at a reasonable multiple",
        sortOrder: 7,
      },
      {
        ticker: "OXY",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 48,
        rationale: "Occidental below $48 — Buffett's been buying aggressively",
        sortOrder: 8,
      },
      {
        ticker: "AMZN",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 190,
        rationale: "Amazon below $190 — AWS margin expansion story at a discount",
        sortOrder: 9,
      },
      {
        ticker: "BAC",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 38,
        rationale: "Bank of America below $38 — Buffett's largest bank position",
        sortOrder: 10,
      },
    ],
  },
  {
    id: "tmpl-momentum",
    name: "Momentum Breakout Alerts",
    slug: "momentum-breakout-alerts",
    description:
      "Catch stocks breaking to new highs with strong volume. Designed for swing traders who want to ride momentum.",
    longDescription:
      "Momentum signals that surface breakouts and volume accelerations for swing traders.",
    category: "MOMENTUM",
    iconEmoji: "🚀",
    isActive: true,
    isFeatured: true,
    sortOrder: 3,
    items: [
      {
        ticker: "NVDA",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "NVDA hits new 52-week high — AI momentum continues",
        sortOrder: 1,
      },
      {
        ticker: "META",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "META breaks out to new high — ad business firing",
        sortOrder: 2,
      },
      {
        ticker: "NFLX",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "Netflix at new highs — streaming dominance",
        sortOrder: 3,
      },
      {
        ticker: "AMZN",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "Amazon breaks out — watch for continuation",
        sortOrder: 4,
      },
      {
        ticker: "TSLA",
        alertType: "VOLUME_SPIKE",
        triggerDirection: "ABOVE",
        triggerValue: 2,
        rationale: "Tesla volume 2x+ average — something is happening",
        sortOrder: 5,
      },
      {
        ticker: "NVDA",
        alertType: "VOLUME_SPIKE",
        triggerDirection: "ABOVE",
        triggerValue: 2.5,
        rationale: "NVDA volume 2.5x+ average — institutional interest",
        sortOrder: 6,
      },
      {
        ticker: "AAPL",
        alertType: "RSI_OVERSOLD",
        triggerDirection: "BELOW",
        triggerValue: 30,
        rationale: "Apple RSI below 30 — oversold bounce opportunity",
        sortOrder: 7,
      },
      {
        ticker: "MSFT",
        alertType: "RSI_OVERSOLD",
        triggerDirection: "BELOW",
        triggerValue: 30,
        rationale: "Microsoft RSI below 30 — potential bottom",
        sortOrder: 8,
      },
      {
        ticker: "AMD",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "AMD new 52-week high — chip sector strength",
        sortOrder: 9,
      },
      {
        ticker: "AVGO",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "Broadcom breakout — AI infrastructure play",
        sortOrder: 10,
      },
    ],
  },
  {
    id: "tmpl-dividend",
    name: "Dividend Income Watchlist",
    slug: "dividend-income-watchlist",
    description:
      "Track high-quality dividend stocks. Get alerted when prices drop to levels where yield becomes extra attractive.",
    longDescription:
      "Income-focused alerts to surface yields that are historically attractive for blue-chip dividend payers.",
    category: "DIVIDEND",
    iconEmoji: "📈",
    isActive: true,
    isFeatured: false,
    sortOrder: 4,
    items: [
      {
        ticker: "O",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 52,
        rationale: "Realty Income below $52 — monthly dividend yield above 6%",
        sortOrder: 1,
      },
      {
        ticker: "VZ",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 38,
        rationale: "Verizon below $38 — yield crosses above 7%",
        sortOrder: 2,
      },
      {
        ticker: "T",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 22,
        rationale: "AT&T below $22 — yield above 5% after restructuring",
        sortOrder: 3,
      },
      {
        ticker: "ABBV",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 170,
        rationale: "AbbVie below $170 — pharma cash cow at attractive yield",
        sortOrder: 4,
      },
      {
        ticker: "XOM",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 105,
        rationale: "ExxonMobil below $105 — energy dividend champion",
        sortOrder: 5,
      },
      {
        ticker: "SCHD",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 26,
        rationale: "Schwab Dividend ETF below $26 — diversified income at a discount",
        sortOrder: 6,
      },
      {
        ticker: "PEP",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 155,
        rationale: "PepsiCo below $155 — 51-year dividend growth streak",
        sortOrder: 7,
      },
      {
        ticker: "MO",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 52,
        rationale: "Altria below $52 — high yield defensive stock",
        sortOrder: 8,
      },
      {
        ticker: "KO",
        alertType: "SMA_CROSS_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 50,
        rationale: "Coca-Cola drops below 50-day SMA — potential buying opportunity",
        sortOrder: 9,
      },
      {
        ticker: "JNJ",
        alertType: "SMA_CROSS_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 200,
        rationale: "J&J below 200-day SMA — rare long-term entry signal",
        sortOrder: 10,
      },
    ],
  },
  {
    id: "tmpl-macro",
    name: "Market Fear & Greed Signals",
    slug: "market-fear-greed-signals",
    description:
      "Macro-level alerts that tell you when something big is happening in the market. Essential for any investor.",
    longDescription:
      "Macro alerts for volatility, index moves, and major trend signals.",
    category: "MACRO",
    iconEmoji: "🌡️",
    isActive: true,
    isFeatured: false,
    sortOrder: 5,
    items: [
      {
        ticker: "VIX",
        alertType: "PRICE_ABOVE",
        triggerDirection: "ABOVE",
        triggerValue: 25,
        rationale: "VIX above 25 — fear is elevated, markets are nervous",
        sortOrder: 1,
      },
      {
        ticker: "VIX",
        alertType: "PRICE_ABOVE",
        triggerDirection: "ABOVE",
        triggerValue: 35,
        rationale: "VIX above 35 — extreme fear, historically a buying opportunity",
        sortOrder: 2,
      },
      {
        ticker: "VIX",
        alertType: "PRICE_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 13,
        rationale: "VIX below 13 — extreme complacency, consider hedging",
        sortOrder: 3,
      },
      {
        ticker: "SPY",
        alertType: "PERCENT_CHANGE_DAY",
        triggerDirection: "BOTH",
        triggerValue: 2,
        rationale: "S&P 500 moves 2%+ in a day — significant market event",
        sortOrder: 4,
      },
      {
        ticker: "QQQ",
        alertType: "PERCENT_CHANGE_DAY",
        triggerDirection: "BOTH",
        triggerValue: 3,
        rationale: "Nasdaq moves 3%+ in a day — tech sector volatility",
        sortOrder: 5,
      },
      {
        ticker: "TLT",
        alertType: "PERCENT_CHANGE_DAY",
        triggerDirection: "BOTH",
        triggerValue: 2,
        rationale: "Long-term bonds move 2%+ — interest rate shock",
        sortOrder: 6,
      },
      {
        ticker: "GLD",
        alertType: "FIFTY_TWO_WEEK_HIGH",
        triggerDirection: "ABOVE",
        triggerValue: 0,
        rationale: "Gold hits new 52-week high — flight to safety signal",
        sortOrder: 7,
      },
      {
        ticker: "DXY",
        alertType: "PRICE_ABOVE",
        triggerDirection: "ABOVE",
        triggerValue: 110,
        rationale: "Dollar index above 110 — strong dollar stress",
        sortOrder: 8,
      },
      {
        ticker: "IWM",
        alertType: "SMA_CROSS_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 200,
        rationale: "Russell 2000 below 200-day SMA — small caps in trouble",
        sortOrder: 9,
      },
      {
        ticker: "SPY",
        alertType: "SMA_CROSS_BELOW",
        triggerDirection: "BELOW",
        triggerValue: 200,
        rationale: "S&P 500 below 200-day SMA — major bearish signal",
        sortOrder: 10,
      },
    ],
  },
];
