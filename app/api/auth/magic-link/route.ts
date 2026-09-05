import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertUserForAuth, ensureOnAudience, toSignupSource } from "@/lib/auth/users";
import { safeNext } from "@/lib/auth/completeSignIn";
import { sendMagicLinkEmail } from "@/lib/email/sendMagicLinkEmail";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { checkSignupRateLimit, clientIp } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_COOLDOWN_SEC = 60;

/**
 * POST /api/auth/magic-link  { email, source, next? }
 *
 * The signup + login entry point. Replaces the browser-side
 * supabase.auth.signInWithOtp() call so that:
 *   - the lead is captured (Prisma User + Resend audience) the moment the
 *     form is submitted, not only after the link is clicked;
 *   - the email is a branded Resend send, not Supabase's default template;
 *   - the link is a token-hash link that works in ANY browser (no PKCE
 *     verifier needed), and the same email carries a one-time code.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const source = toSignupSource(body?.source);
  const next = safeNext(typeof body?.next === "string" ? body.next : null);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Per-IP rate limit (real client IP from Cloudflare), then the bot check.
  const ip = clientIp(request);
  const limit = await checkSignupRateLimit(ip);
  if (!limit.allowed) {
    console.warn("[magic-link] rate limited:", { ip, email });
    return NextResponse.json(
      { error: "Too many requests from your network. Please wait a minute and try again.", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  // Bot check (no-op until TURNSTILE_SECRET_KEY is configured)
  const turnstile = await verifyTurnstile(typeof body?.turnstileToken === "string" ? body.turnstileToken : undefined, ip);
  if (!turnstile.ok) {
    console.warn("[magic-link] turnstile rejected:", { email, ip, errors: turnstile.errors });
    return NextResponse.json(
      { error: "We couldn't verify you're not a bot. Please try again.", code: "turnstile" },
      { status: 403 }
    );
  }

  const now = new Date();

  try {
    // Rate limit: one link per address per 60s
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { lastLinkSentAt: true },
    });
    if (existing?.lastLinkSentAt) {
      const elapsed = (now.getTime() - existing.lastLinkSentAt.getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SEC) {
        const retryAfterSec = Math.ceil(RESEND_COOLDOWN_SEC - elapsed);
        return NextResponse.json(
          { error: "We just sent you a link. Give it a minute before requesting another.", retryAfterSec },
          { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
      }
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const admin = createAdminClient();

    // Mint the token. Creates the auth user if this is their first time.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/api/auth/callback` },
    });

    if (error || !data?.user || !data.properties?.hashed_token) {
      console.error("[magic-link] generateLink failed:", { email, code: error?.code, message: error?.message });
      return NextResponse.json(
        { error: "We couldn't create your login link. Please try again in a moment." },
        { status: 502 }
      );
    }

    const { hashed_token, email_otp, verification_type } = data.properties;
    const isNewUser = !data.user.last_sign_in_at;

    // Capture the lead NOW.
    const abVariant = (await cookies()).get("ab_hero_headline")?.value ?? null;
    const { user } = await upsertUserForAuth({
      authUser: data.user,
      abVariant,
      source,
      lastLinkSentAt: now,
    });
    await ensureOnAudience(user);

    // Send the branded email.
    const link = new URL("/api/auth/callback", origin);
    link.searchParams.set("token_hash", hashed_token);
    link.searchParams.set("type", verification_type || "magiclink");
    if (next !== "/dashboard") link.searchParams.set("next", next);

    const { error: sendError } = await sendMagicLinkEmail({
      to: email,
      link: link.toString(),
      code: email_otp,
      isNewUser,
      appUrl: origin,
    });

    if (sendError) {
      console.error("[magic-link] Resend rejected email:", { email, sendError });
      return NextResponse.json(
        { error: "We couldn't deliver the email. Check the address and try again." },
        { status: 502 }
      );
    }

    console.log(`[magic-link] sent to ${email} (source=${source}, new=${isNewUser})`);
    return NextResponse.json({ ok: true, isNewUser });
  } catch (err) {
    console.error("[magic-link] error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
