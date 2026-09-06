/**
 * Everything tunable about the two daily issues in one place: kinds and their
 * windows, model settings, length targets, list prices.
 */
import { anthropicConfigured } from "@/lib/ai/config";
import { beehiivConfigured } from "@/lib/beehiiv/config";

export type Slot = 1 | 2;
export type IssueKind = "morning" | "closing";

/** Slot 1 goes out before the opening bell, slot 2 right after the close. */
export const SLOT_KIND: Record<Slot, IssueKind> = { 1: "morning", 2: "closing" };
export const KIND_LABEL: Record<IssueKind, string> = { morning: "Morning brief", closing: "Closing recap" };

/** Build windows in Eastern minutes since midnight; outside them a cron run does nothing (force overrides). */
export const KIND_WINDOW_ET: Record<IssueKind, { from: number; to: number }> = {
  morning: { from: 7 * 60, to: 9 * 60 + 25 },
  closing: { from: 16 * 60 + 5, to: 23 * 60 + 30 },
};

export const NEWSLETTER = {
  /** Anthropic model id. Manny chose Sonnet 5 for the articles (2026-09-06). */
  model: "claude-sonnet-5",
  /** Sonnet 5 rejects `temperature`; thinking is adaptive and effort is set per call. */
  effort: "medium" as const,
  /** Adaptive thinking counts against max_tokens, so this leaves room to think. */
  writerMaxTokens: 16000,
  /** Server-side web searches the writer may run per issue. */
  webSearchMaxUses: 6,
  /** How many times a `pause_turn` is resumed before giving up. */
  pauseTurnResumes: 3,

  morning: {
    /** Numbered items, like "top 10 things to watch". */
    minItems: 8,
    maxItems: 10,
    minItemWords: 20,
    maxItemWords: 120,
    /** Headlines from this many hours back feed the brief. */
    newsLookbackHours: 18,
  },
  closing: {
    minWords: 350,
    maxWords: 700,
    maxSentencesPerParagraph: 4,
    newsLookbackHours: 14,
  },
  maxHeadlineChars: 90,
  maxSubjectChars: 70,
  maxPreviewChars: 120,
  minSources: 3,
  /** Cited coverage older than this, judged from dates in the source URLs, is stale for a same-day issue. */
  maxSourceAgeDays: 2,

  /** Market-cap floor for movers and earnings names shown to the writer. */
  minMarketCap: 2e9,
  /** How many FMP headlines to pull (pages of 250) and how many tickers to show the writer. */
  newsFetchLimit: 250,
  newsFetchPages: 2,
  newsTickerLimit: 16,

  timezone: "America/Los_Angeles",
  marketTimezone: "America/New_York",
  slots: [1, 2] as const,

  /** List prices for the cost line: $ per 1M tokens, $ per web search. */
  priceInputPerM: 2.0,
  priceOutputPerM: 10.0,
  pricePerSearch: 0.01,
} as const;

/**
 * NYSE full-day closures. FMP's holidays-by-exchange feed only lists past
 * dates, so this static calendar is unioned with it. Extend each December.
 */
export const NYSE_HOLIDAYS_STATIC: string[] = [
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
];

export const NEWSLETTER_PAUSED_KEY = "newsletterBuildPaused";

/** Everything the cron needs: Beehiiv (read + write), Anthropic, FMP. */
export const newsletterConfigured = () => beehiivConfigured() && anthropicConfigured() && !!process.env.FMP_API_KEY;

/** Who gets the run report. */
export const reportRecipients = (): string[] =>
  (process.env.NEWSLETTER_REPORT_TO ?? "sevaleto@gmail.com,manuel@tradingtips.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
