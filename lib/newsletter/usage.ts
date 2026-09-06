/** Token and web-search accounting for one model call or a whole run. */
import { NEWSLETTER } from "./config";

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

export const EMPTY_USAGE: ModelUsage = { inputTokens: 0, outputTokens: 0, webSearches: 0 };

export const addUsage = (a: ModelUsage, b: ModelUsage): ModelUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  webSearches: a.webSearches + b.webSearches,
});

/** List price of a call, rounded to a millionth of a dollar. */
export const costUsd = (u: ModelUsage): number =>
  Math.round(((u.inputTokens * NEWSLETTER.priceInputPerM + u.outputTokens * NEWSLETTER.priceOutputPerM) / 1e6 + u.webSearches * NEWSLETTER.pricePerSearch) * 1e6) / 1e6;
