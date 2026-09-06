/**
 * Everything about the AI-written context paragraph in one place: model,
 * length targets, and what gets fed to it. Change the model here and every
 * email follows.
 */
export const AI_CONTEXT = {
  /** Anthropic model id. Haiku 4.5 was chosen for cost; Sonnet 5 ("claude-sonnet-5") is the quality step up. */
  model: "claude-haiku-4-5",
  maxTokens: 700,
  temperature: 0.4,
  /** Target length of the two paragraphs together. */
  minWords: 120,
  maxWords: 180,
  /** Below this the model output is discarded for the deterministic fallback. */
  fallbackBelowWords: 60,
  /** Headlines passed to the model. */
  newsLimit: 3,
  /** Headlines older than this are left out; stale news misleads more than it helps. */
  newsMaxAgeDays: 10,
  /** List prices, $ per 1M tokens, for the cost line in logs and the preview script. */
  priceInputPerM: 1.0,
  priceOutputPerM: 5.0,
} as const;

export const anthropicConfigured = () => !!process.env.ANTHROPIC_API_KEY;
