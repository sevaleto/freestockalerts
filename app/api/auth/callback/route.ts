import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeSignIn, safeNext } from "@/lib/auth/completeSignIn";
import { toSignupSource } from "@/lib/auth/users";
import { parseAttribution } from "@/lib/tracking/attribution";
import { marketingAllowed } from "@/lib/cookies/serverConsent";
import { VARIANT_COOKIE } from "@/lib/cookies/bucket";

const HANDOFF_COOKIES = ["fsa_next", "fsa_src", "fsa_attr"] as const;

/** Clear the short-lived OAuth hand-off cookies on whatever response we return. */
function clearHandoff(res: NextResponse) {
  for (const name of HANDOFF_COOKIES) res.cookies.set({ name, value: "", path: "/", maxAge: 0 });
  return res;
}

export const dynamic = "force-dynamic";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "magiclink",
  "signup",
  "email",
  "recovery",
  "invite",
  "email_change",
];

function fail(origin: string, reason: string, description?: string | null) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth_failed");
  url.searchParams.set("reason", reason.slice(0, 64));
  if (description) url.searchParams.set("error_description", description.slice(0, 200));
  return clearHandoff(NextResponse.redirect(url.toString()));
}

/**
 * GET /api/auth/callback
 *
 * Two ways in:
 *   ?token_hash=…&type=magiclink   — links from our own magic-link emails.
 *       Verified server-side, so it works in ANY browser or device
 *       (no PKCE code verifier required).
 *   ?code=…                        — PKCE exchange. Google OAuth lands here,
 *       and so do any old-style Supabase emails still in flight.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const jar = await cookies();
  // Google OAuth can't carry query params through Supabase, so the button
  // stashes next/source in short-lived cookies before redirecting.
  const next = safeNext(searchParams.get("next") ?? jar.get("fsa_next")?.value ?? null);
  const sourceOverride = toSignupSource(jar.get("fsa_src")?.value);
  let attribution = null;
  try {
    attribution = parseAttribution(JSON.parse(jar.get("fsa_attr")?.value ?? "null"));
  } catch {
    attribution = null;
  }
  if (attribution?.fbclid && !marketingAllowed(request).allowed) delete attribution.fbclid;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  // Provider bounced back with an error (e.g. user cancelled Google)
  const providerError = searchParams.get("error");
  if (providerError) {
    console.error("[auth/callback] provider error", {
      error: providerError,
      code: searchParams.get("error_code"),
      description: searchParams.get("error_description"),
    });
    return fail(origin, searchParams.get("error_code") ?? providerError, searchParams.get("error_description"));
  }

  const supabase = await createServerSupabaseClient();
  let path: "token_hash" | "code";
  let result;

  if (tokenHash) {
    path = "token_hash";
    if (!EMAIL_OTP_TYPES.includes(type as EmailOtpType)) {
      return fail(origin, "invalid_type");
    }
    result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
  } else if (code) {
    path = "code";
    result = await supabase.auth.exchangeCodeForSession(code);
  } else {
    return fail(origin, "missing_token");
  }

  if (result.error || !result.data.user) {
    console.error("[auth/callback] verify failed", {
      path,
      code: result.error?.code,
      status: result.error?.status,
      message: result.error?.message,
      ua: request.headers.get("user-agent"),
    });
    return fail(origin, result.error?.code ?? "unknown");
  }

  const eventId = await completeSignIn({
    user: result.data.user,
    request,
    origin,
    abVariant: jar.get(VARIANT_COOKIE)?.value ?? null,
    sourceOverride,
    attribution,
  });

  const redirectUrl = new URL(next, origin);
  redirectUrl.searchParams.set("capi_eid", eventId);
  return clearHandoff(NextResponse.redirect(redirectUrl.toString()));
}
