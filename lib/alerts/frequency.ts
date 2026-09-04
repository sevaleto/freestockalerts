/**
 * Client-safe notification-frequency rules (no server imports).
 *
 * One-shot types describe a single event: the alert fires once, then pauses.
 * Editing the trigger re-arms it. Recurring types describe a condition that
 * can be true on many different days (a big daily move, a volume spike);
 * they notify at most once per trading day.
 */
export const ONE_SHOT_ALERT_TYPES = [
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "PRICE_RECOVERY",
  "FIFTY_TWO_WEEK_HIGH",
  "FIFTY_TWO_WEEK_LOW",
  "RSI_OVERBOUGHT",
  "RSI_OVERSOLD",
  "SMA_CROSS_ABOVE",
  "SMA_CROSS_BELOW",
  "EARNINGS_REMINDER",
] as const;

export const isOneShotAlertType = (alertType?: string | null) =>
  !!alertType &&
  (ONE_SHOT_ALERT_TYPES as readonly string[]).includes(alertType);

export const notificationFrequencyCopy = (alertType?: string | null) =>
  isOneShotAlertType(alertType)
    ? "You'll get one email when this triggers, then the alert pauses. Edit the trigger any time to re-arm it."
    : "You'll get at most one email per trading day while this condition holds.";
