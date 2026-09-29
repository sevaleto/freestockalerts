/**
 * Resend allows only a few requests per second per account. When several
 * alerts fire in the same five-minute check they are sent concurrently, and the
 * overflow comes back as { error: { name: "rate_limit_exceeded" } } rather than
 * a throw. Without a retry those emails were lost while the alert was still
 * marked as triggered (2026-09-11: RTX and COST in a burst of 12).
 */
type SendResult = { data: unknown; error: { name?: string; message?: string } | null };

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendWithRateLimitRetry<T extends SendResult>(
  send: () => Promise<T>,
  delays: number[] = RETRY_DELAYS_MS
): Promise<T> {
  let result = await send();
  for (const delay of delays) {
    if (result.error?.name !== "rate_limit_exceeded") return result;
    // Jitter spreads a burst of concurrent retries across the window.
    await sleep(delay + Math.floor(Math.random() * delay));
    result = await send();
  }
  return result;
}
