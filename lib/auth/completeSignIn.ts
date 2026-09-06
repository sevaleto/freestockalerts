import type { User as AuthUser } from "@supabase/supabase-js";
import { upsertUserForAuth, type SignupSource } from "@/lib/auth/users";
import type { Attribution } from "@/lib/tracking/attribution";
import { ensureOnAudience, markEmailConfirmed } from "@/lib/email/verification";
import { sendCAPIEvent, extractFbCookies, generateEventId } from "@/lib/tracking/meta-capi";
import { marketingAllowed } from "@/lib/cookies/serverConsent";

interface CompleteSignInInput {
  user: AuthUser;
  request: Request;
  origin: string;
  abVariant?: string | null;
  /** Attribution override, e.g. "lp:radar" carried through Google OAuth via cookie. */
  sourceOverride?: SignupSource;
  attribution?: Attribution | null;
}

/**
 * Everything that must happen once a user has a verified session, regardless
 * of how they got it (magic link, one-time code, Google OAuth):
 *   1. Prisma User row exists and is marked emailVerified (emailStatus VALID)
 *   2. user is on the Resend audience
 *   3. Meta CAPI CompleteRegistration fires (server side), unless the visitor
 *      has opted out of marketing (explicit choice, GPC, or opt-in region
 *      without consent; see lib/cookies/serverConsent.ts)
 * Returns the CAPI event id so the browser pixel can dedupe against it.
 */
export async function completeSignIn({ user, request, origin, abVariant, sourceOverride, attribution }: CompleteSignInInput) {
  const provider = user.app_metadata?.provider;
  const source: SignupSource =
    sourceOverride && sourceOverride !== "unknown"
      ? sourceOverride
      : provider === "google"
        ? "google"
        : "unknown";

  let createdNow = false;
  try {
    const { user: row, created } = await upsertUserForAuth({
      attribution,
      authUser: user,
      abVariant,
      source,
      emailVerified: true,
    });
    createdNow = created;
    const confirmed = await markEmailConfirmed(row.id, provider === "google" ? "google" : "magic-link");
    await ensureOnAudience(confirmed ?? row);
  } catch (e) {
    console.error("[auth] completeSignIn: failed to upsert user record:", e);
  }

  const eventId = generateEventId();
  const consent = marketingAllowed(request);
  if (!consent.allowed) {
    console.log(`[CAPI] skipped on sign-in (${consent.reason})`);
    return eventId;
  }
  const cookieHeader = request.headers.get("cookie");
  const { fbc, fbp } = extractFbCookies(cookieHeader);
  const userData = {
    email: user.email || undefined,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "",
    userAgent: request.headers.get("user-agent") || "",
    fbc,
    fbp,
  };

  // Google signups never fired a browser Lead (the click only sends a custom
  // InitiateSignup). Fire the real Lead here, server-side, with the verified
  // email, only when this is a brand-new account.
  if (provider === "google" && createdNow) {
    sendCAPIEvent({
      eventName: "Lead",
      eventId: generateEventId(),
      eventSourceUrl: `${origin}/api/auth/callback`,
      userData,
      customData: { content_name: leadContentName(source), method: "google" },
    }).catch((err) => console.error("[CAPI] Lead (google) error:", err));
  }

  // Fire async — never block the redirect on Meta
  sendCAPIEvent({
    eventName: "CompleteRegistration",
    eventId,
    eventSourceUrl: `${origin}/api/auth/callback`,
    userData,
    customData: { content_name: "dashboard", method: provider ?? "email" },
  }).catch((err) => console.error("[CAPI] CompleteRegistration error:", err));

  return eventId;
}

/** Meta content_name for a signup source, matching what the browser pixel sends on email submits. */
export function leadContentName(source: SignupSource): string {
  if (source.startsWith("lp:")) return `lp_${source.slice(3)}`;
  const map: Record<string, string> = {
    hero: "home_hero",
    "final-cta": "home_final_cta",
    "inline-cta": "home_inline_cta",
    "template-preview": "home_templates",
    login: "login",
  };
  return map[source] ?? "signup";
}

export { safeNext } from "@/lib/auth/safeNext";
