/**
 * Server-side Cloudflare Turnstile verification.
 *
 * Off until TURNSTILE_SECRET_KEY is set, so a deploy without keys keeps
 * working; once the key exists every signup must carry a valid token.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;

export interface TurnstileResult {
  ok: boolean;
  /** Cloudflare error codes when not ok, e.g. ["timeout-or-duplicate"]. */
  errors: string[];
}

export async function verifyTurnstile(token: string | undefined, ip: string | undefined): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, errors: [] };
  if (!token) return { ok: false, errors: ["missing-input-response"] };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return { ok: !!data.success, errors: data["error-codes"] ?? [] };
  } catch (err) {
    console.error("[turnstile] verify request failed:", err);
    // Fail closed: a broken verifier must not become an open door.
    return { ok: false, errors: ["verify-unreachable"] };
  }
}
