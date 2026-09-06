import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { checkSignupRateLimit, clientIp } from "@/lib/auth/rateLimit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { parseAdvertiserInquiry, sendAdvertiserInquiry } from "@/lib/forms/advertiserInquiry";
import { emailConfigured, hashIp, str, SUPPORT_EMAIL } from "@/lib/forms/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/advertiser-inquiry — receives inquiries from /advertise.
 *
 * The row is written before anything is handed to a third party, so a Resend
 * outage costs a notification rather than the lead. The visitor gets a success
 * card the moment the row is durable; sales is emailed in after().
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ip = clientIp(request);
  const limit = await checkSignupRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests from your network. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  const parsed = parseAdvertiserInquiry(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if ("honeypot" in parsed) return NextResponse.json({ ok: true });

  // Bot check after field validation: a Turnstile token is single-use, and a
  // rejection for a missing field must not also spend the token.
  const turnstile = await verifyTurnstile(str(body.turnstileToken, 4000) || undefined, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "We couldn't verify you're not a bot. Please try again.", code: "turnstile" }, { status: 403 });
  }

  let created;
  try {
    created = await prisma.advertiserInquiry.create({
      data: {
        ...parsed.data,
        emailStatus: emailConfigured() ? "pending" : "skipped",
        ipHash: hashIp(ip),
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[advertiser-inquiry] failed to record:", err);
    return NextResponse.json({ error: `We could not record your inquiry. Please email ${SUPPORT_EMAIL} directly so it is not lost.` }, { status: 500 });
  }

  if (emailConfigured()) {
    const record = created;
    after(async () => {
      try {
        await sendAdvertiserInquiry({ ...record, receivedAt: record.ts });
        await prisma.advertiserInquiry.update({ where: { id: record.id }, data: { emailStatus: "sent", emailSentAt: new Date(), emailError: null } });
      } catch (err) {
        console.error("[advertiser-inquiry] notification failed:", err);
        await prisma.advertiserInquiry.update({ where: { id: record.id }, data: { emailStatus: "failed", emailError: String(err).slice(0, 500) } }).catch(() => {});
      }
    });
  }

  return NextResponse.json({ ok: true });
}
