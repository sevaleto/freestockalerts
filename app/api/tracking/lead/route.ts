import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  sendCAPIEvent,
  extractFbCookies,
} from "@/lib/tracking/meta-capi";

/**
 * POST /api/tracking/lead
 *
 * Client-side Lead events proxy through here to fire server-side CAPI.
 * The browser pixel fires Lead simultaneously (deduped via event_id).
 *
 * Body: { event_id: string, email?: string, method: "google" | "email" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_id, email, method } = body;

    if (!event_id) {
      return NextResponse.json({ error: "event_id required" }, { status: 400 });
    }

    const headersList = headers();
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
        content_name: "signup",
        method,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/tracking/lead] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
