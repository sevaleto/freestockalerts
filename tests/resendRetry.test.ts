// Regression: ISSUE-001 — concurrent alert emails hit Resend's rate limit and were lost
// Found by /qa on 2026-09-28
// Report: .gstack/qa-reports/qa-report-freestockalerts-ai-2026-09-28.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { sendWithRateLimitRetry } from "../lib/email/resendRetry";

const limited = { data: null, error: { name: "rate_limit_exceeded", message: "Too many requests" } };
const ok = { data: { id: "email_1" }, error: null };

test("retries a rate-limited send until it succeeds", async () => {
  const replies = [limited, limited, ok];
  let calls = 0;
  const result = await sendWithRateLimitRetry(async () => replies[calls++], [1, 1, 1]);
  assert.equal(calls, 3);
  assert.deepEqual(result, ok);
});

test("returns other errors at once, without retrying", async () => {
  const invalid = { data: null, error: { name: "validation_error", message: "Invalid to" } };
  let calls = 0;
  const result = await sendWithRateLimitRetry(async () => (calls++, invalid), [1, 1]);
  assert.equal(calls, 1);
  assert.deepEqual(result, invalid);
});

test("gives up after the last delay and reports the rate limit", async () => {
  let calls = 0;
  const result = await sendWithRateLimitRetry(async () => (calls++, limited), [1, 1]);
  assert.equal(calls, 3, "one send plus one retry per delay");
  assert.equal(result.error?.name, "rate_limit_exceeded");
});
