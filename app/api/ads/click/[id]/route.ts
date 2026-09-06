import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { checkSignupRateLimit, clientIp } from "@/lib/auth/rateLimit";
import { hashIp } from "@/lib/forms/shared";
import { parseChannel, parseToken, recordClick } from "@/lib/subscribers/clicks";

export const dynamic = "force-dynamic";

/**
 * GET /api/ads/click/<id>?c=<channel>&s=<token>: the tracked link behind
 * every ad CTA. Redirects to the advertiser's URL and logs the click
 * afterwards, so the reader is never held up by the write. The token
 * identifies the subscriber (see lib/subscribers/clicks.ts); link scanners
 * and repeat clicks within a day are logged but not counted.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await prisma.emailAd.findUnique({ where: { id }, select: { id: true, ctaUrl: true, valueCents: true } });
  const home = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.freestockalerts.ai";
  if (!ad) return NextResponse.redirect(home, 302);

  const url = new URL(request.url);
  const channel = parseChannel(url.searchParams.get("c"));
  const token = parseToken(url.searchParams.get("s"));
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const ip = clientIp(request);
  const ipHash = hashIp(ip);

  after(async () => {
    try {
      // The redirect is never throttled; only the logging is, so a flood from one address cannot fill the click log.
      const limit = await checkSignupRateLimit(ip);
      if (!limit.allowed) return;
      await recordClick(prisma, { adId: ad.id, adValueCents: ad.valueCents, channel, token, ipHash, userAgent });
    } catch (err) {
      console.error("[ads] click log failed:", err instanceof Error ? err.message : err);
    }
  });

  return NextResponse.redirect(ad.ctaUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
