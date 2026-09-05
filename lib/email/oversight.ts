import type { EmailStatus } from "@prisma/client";

/**
 * Email Oversight real-time validation.
 * Docs: https://emailoversight.com/docs-api/
 *
 * POST https://api.emailoversight.com/api/emailvalidation
 *   header ApiToken: <token>   body {"ListId": <id>, "Email": "<email>"}
 *   → {"ListId":25,"Email":"joe@x.com","ResultId":1,"Result":"Verified"}
 *
 * Note: Email Oversight whitelists callers by public IP. Vercel functions do
 * not have a fixed egress IP, so the whitelist must be disabled (or set to
 * allow all) on the Email Oversight account, otherwise every call returns
 * ResultId 12 "Unauthorized" and addresses stay PENDING.
 */

const ENDPOINT = "https://api.emailoversight.com/api/emailvalidation";
const TIMEOUT_MS = 12_000;

export interface OversightVerdict {
  resultId: number;
  result: string;
}

export function oversightEnabled(): boolean {
  return !!(process.env.EMAIL_OVERSIGHT_API_TOKEN && process.env.EMAIL_OVERSIGHT_LIST_ID);
}

/** Returns null when not configured, on network failure, or on a malformed reply. */
export async function validateWithOversight(email: string): Promise<OversightVerdict | null> {
  if (!oversightEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ApiToken: process.env.EMAIL_OVERSIGHT_API_TOKEN! },
      body: JSON.stringify({ ListId: Number(process.env.EMAIL_OVERSIGHT_LIST_ID), Email: email }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[oversight] HTTP", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { ResultId?: unknown; Result?: unknown };
    if (typeof data?.ResultId !== "number") {
      console.error("[oversight] unexpected reply:", JSON.stringify(data).slice(0, 200));
      return null;
    }
    return { resultId: data.ResultId, result: String(data.Result ?? "") };
  } catch (err) {
    console.error("[oversight] request failed:", (err as Error)?.message ?? err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map an Email Oversight ResultId to our status.
 * `retry: true` means the verdict is not final (Retry / Unknown / Unauthorized).
 */
export function statusFromOversight(resultId: number): { status: EmailStatus; retry: boolean } {
  switch (resultId) {
    case 1: return { status: "VALID", retry: false };          // Verified
    case 3: return { status: "ACCEPT_ALL", retry: false };     // Catch All
    case 4: return { status: "RISKY", retry: false };          // Role
    case 2:                                                     // Undeliverable
    case 5:                                                     // Malformed
    case 9:                                                     // Bot
    case 13: return { status: "INVALID", retry: false };       // Disposable
    case 6:                                                     // SpamTrap
    case 7:                                                     // Complainer
    case 10:                                                    // Seed Account
    case 20: return { status: "SUPPRESSED", retry: false };    // Suppressed
    case 12:                                                    // Unauthorized (IP whitelist / quota): config problem
      console.error("[oversight] ResultId 12 Unauthorized: check IP whitelist and quota on the Email Oversight account");
      return { status: "PENDING", retry: true };
    case 0:                                                     // Retry
    case 11:                                                    // Unknown
    default:
      return { status: "PENDING", retry: true };
  }
}
