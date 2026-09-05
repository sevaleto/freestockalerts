"use client";

import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safeNext";

/** Browser-side guard for post-login destinations (same rules as the server). */
export const clientSafeNext = safeNext;

export type SendMagicLinkResult =
  | { ok: true; isNewUser: boolean }
  | { ok: false; message: string; retryAfterSec?: number };

/**
 * Ask the server to mint + email a magic link (and one-time code).
 * The server captures the lead immediately.
 */
export async function sendMagicLink(
  email: string,
  source: string,
  next?: string,
  turnstileToken?: string
): Promise<SendMagicLinkResult> {
  try {
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source, next, turnstileToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.ok) return { ok: true, isNewUser: !!body.isNewUser };
    if (res.status === 429) {
      return {
        ok: false,
        message: body?.error ?? "Please wait a moment before requesting another link.",
        retryAfterSec: Number(body?.retryAfterSec) || 60,
      };
    }
    return { ok: false, message: body?.error ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "Network error. Check your connection and try again." };
  }
}

export type VerifyCodeResult = { ok: true; redirectTo: string } | { ok: false; message: string };

/**
 * Verify the one-time code from the email in THIS browser, then run the
 * post-auth work and return where to send the user.
 */
export async function verifyCode(email: string, code: string, next?: string): Promise<VerifyCodeResult> {
  const token = code.replace(/\D/g, "");
  if (token.length < 6 || token.length > 8) return { ok: false, message: "Enter the code from the email." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.session) {
    // Supabase returns otp_expired for both a wrong code and a stale one.
    return {
      ok: false,
      message:
        error?.code === "otp_expired"
          ? "That code didn't match or has expired. Check the email and try again, or resend the link."
          : error?.message ?? "We couldn't verify that code. Try again.",
    };
  }

  const dest = new URL(clientSafeNext(next), window.location.origin);
  try {
    const res = await fetch("/api/auth/activated", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (body?.capiEventId) dest.searchParams.set("capi_eid", String(body.capiEventId));
  } catch {
    // Session exists regardless; the destination still works.
  }
  return { ok: true, redirectTo: dest.pathname + dest.search };
}
