import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { headers } from "next/headers";
import {
  sendCAPIEvent,
  extractFbCookies,
} from "@/lib/tracking/meta-capi";
import { marketingAllowed } from "@/lib/cookies/serverConsent";

/**
 * POST /api/tracking/lead
 *
 * Client-side Lead events proxy through here to fire server-side CAPI.
 * The browser pixel fires Lead simultaneously (deduped via event_id).
 *
 * Body: { event_id: string, email?: string, method: "google" | "email" }
 *
 * Respects the visitor's marketing consent (explicit choice, GPC signal, or
 * region default; see lib/cookies/serverConsent.ts). Declined → 200, no send.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_id, email, method } = body;
    const contentName =
      typeof body.content_name === "string" && body.content_name.trim()
        ? body.content_name.trim().slice(0, 64)
        : "signup";

    if (!event_id) {
      return NextResponse.json({ error: "event_id required" }, { status: 400 });
    }

    const consent = marketingAllowed(request);
    if (!consent.allowed) {
      console.log(`[/api/tracking/lead] CAPI skipped (${consent.reason})`);
      return NextResponse.json({ ok: true, skipped: consent.reason });
    }

    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "";
    const userAgent = headersList.get("user-agent") || "";
    const cookieHeader = headersList.get("cookie");
    const { fbc, fbp } = extractFbCookies(cookieHeader);
    const referer = headersList.get("referer") || "https://www.freestockalerts.ai";

    await sendCAPIEvent({
      eventName: "Lead",
      eventId: event_id,
      eventSourceUrl: referer,
      userData: {
        email: email || undefined,
        ip,
        userAgent,
        fbc,
        fbp,
      },
      customData: {
        content_name: contentName,
        method,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/tracking/lead] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
