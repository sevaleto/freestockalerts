import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { checkSignupRateLimit, clientIp } from "@/lib/auth/rateLimit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { parsePrivacyRequest, sendPrivacyRequestAlert } from "@/lib/forms/privacyRequest";
import { emailConfigured, hashIp, str, SUPPORT_EMAIL } from "@/lib/forms/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/privacy-request — receives "Do Not Sell or Share" requests from /do-not-sell.
 *
 * Must not silently swallow failures: a dropped rights request is a compliance
 * failure, so a write error returns 500 and the form tells the visitor to
 * email support instead. Staff are alerted in after(), and the outcome is
 * written back to the row so an unsent alert is visible.
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

  const parsed = parsePrivacyRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if ("honeypot" in parsed) return NextResponse.json({ ok: true });

  const turnstile = await verifyTurnstile(str(body.turnstileToken, 4000) || undefined, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "We couldn't verify you're not a bot. Please try again.", code: "turnstile" }, { status: 403 });
  }

  let created;
  try {
    created = await prisma.privacyRequest.create({
      data: {
        ...parsed.data,
        notifyStatus: emailConfigured() ? "pending" : "skipped",
        ipHash: hashIp(ip),
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[privacy-request] failed to record:", err);
    return NextResponse.json({ error: `We could not record your request. Please email ${SUPPORT_EMAIL} so it is not lost.` }, { status: 500 });
  }

  if (emailConfigured()) {
    const record = created;
    after(async () => {
      try {
        const result = await sendPrivacyRequestAlert({ ...record, requesterType: record.requesterType === "agent" ? "agent" : "consumer", receivedAt: record.ts });
        await prisma.privacyRequest.update({
          where: { id: record.id },
          data: result.ok ? { notifyStatus: "sent", notifiedAt: new Date(), notifyError: null } : { notifyStatus: "failed", notifyError: (result.error ?? "unknown").slice(0, 500) },
        });
      } catch (err) {
        console.error("[privacy-request] staff notification failed:", err);
        await prisma.privacyRequest.update({ where: { id: record.id }, data: { notifyStatus: "failed", notifyError: String(err).slice(0, 500) } }).catch(() => {});
      }
    });
  }

  return NextResponse.json({ ok: true });
}
