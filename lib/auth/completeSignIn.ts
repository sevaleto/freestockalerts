import type { User as AuthUser } from "@supabase/supabase-js";
import { upsertUserForAuth, ensureOnAudience, type SignupSource } from "@/lib/auth/users";
import { sendCAPIEvent, extractFbCookies, generateEventId } from "@/lib/tracking/meta-capi";

interface CompleteSignInInput {
  user: AuthUser;
  request: Request;
  origin: string;
  abVariant?: string | null;
  /** Attribution override, e.g. "lp:radar" carried through Google OAuth via cookie. */
  sourceOverride?: SignupSource;
}

/**
 * Everything that must happen once a user has a verified session, regardless
 * of how they got it (magic link, one-time code, Google OAuth):
 *   1. Prisma User row exists and is marked emailVerified
 *   2. user is on the Resend audience
 *   3. Meta CAPI CompleteRegistration fires (server side)
 * Returns the CAPI event id so the browser pixel can dedupe against it.
 */
export async function completeSignIn({ user, request, origin, abVariant, sourceOverride }: CompleteSignInInput) {
  const provider = user.app_metadata?.provider;
  const source: SignupSource =
    sourceOverride && sourceOverride !== "unknown"
      ? sourceOverride
      : provider === "google"
        ? "google"
        : "unknown";

  try {
    const row = await upsertUserForAuth({
      authUser: user,
      abVariant,
      source,
      emailVerified: true,
    });
    await ensureOnAudience(row);
  } catch (e) {
    console.error("[auth] completeSignIn: failed to upsert user record:", e);
  }

  const eventId = generateEventId();
  const cookieHeader = request.headers.get("cookie");
  const { fbc, fbp } = extractFbCookies(cookieHeader);

  // Fire async — never block the redirect on Meta
  sendCAPIEvent({
    eventName: "CompleteRegistration",
    eventId,
    eventSourceUrl: `${origin}/api/auth/callback`,
    userData: {
      email: user.email || undefined,
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "",
      userAgent: request.headers.get("user-agent") || "",
      fbc,
      fbp,
    },
    customData: { content_name: "dashboard", method: provider ?? "email" },
  }).catch((err) => console.error("[CAPI] CompleteRegistration error:", err));

  return eventId;
}

export { safeNext } from "@/lib/auth/safeNext";
