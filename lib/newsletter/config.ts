/**
 * Everything tunable about the daily newsletter drafts in one place: model,
 * length targets, dedup windows, schedule assumptions, list prices.
 */
import { anthropicConfigured } from "@/lib/ai/config";
import { beehiivConfigured } from "@/lib/beehiiv/config";

export const NEWSLETTER = {
  /** Anthropic model id. Manny chose Sonnet 5 for the articles (2026-09-06). */
  model: "claude-sonnet-5",
  /** Sonnet 5 rejects `temperature`; thinking is adaptive and effort is set per call. */
  effort: "medium" as const,
  pickerMaxTokens: 2500,
  writerMaxTokens: 6000,
  /** Server-side web searches the writer may run per article. */
  webSearchMaxUses: 6,
  /** How many times a `pause_turn` is resumed before giving up. */
  pauseTurnResumes: 3,

  /** Article length, body only. */
  minWords: 300,
  maxWords: 550,
  targetWords: "350 to 500",
  maxSentencesPerParagraph: 3,
  maxHeadlineChars: 90,
  maxSubjectChars: 70,
  maxPreviewChars: 120,
  minSources: 2,

  /** A ticker covered in this window is not picked again (hard filter). */
  tickerCooldownDays: 14,
  /** Event summaries from this window are shown to the picker as "already covered". */
  eventLookbackDays: 60,
  /** Headlines older than this are not candidates. Monday looks back over the weekend. */
  newsLookbackHours: 30,
  mondayNewsLookbackHours: 72,
  /** How many FMP headlines to pull and how many tickers to show the picker. */
  newsFetchLimit: 250,
  candidateLimit: 14,

  timezone: "America/Los_Angeles",
  slots: [1, 2] as const,

  /** List prices for the cost line: $ per 1M tokens, $ per web search. */
  priceInputPerM: 2.0,
  priceOutputPerM: 10.0,
  pricePerSearch: 0.01,
} as const;

export type Slot = (typeof NEWSLETTER.slots)[number];

export const NEWSLETTER_PAUSED_KEY = "newsletterBuildPaused";

/** Everything the cron needs: Beehiiv (read + write), Anthropic, FMP. */
export const newsletterConfigured = () => beehiivConfigured() && anthropicConfigured() && !!process.env.FMP_API_KEY;

/** Who gets the run report. */
export const reportRecipients = (): string[] =>
  (process.env.NEWSLETTER_REPORT_TO ?? "sevaleto@gmail.com,manuel@tradingtips.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
