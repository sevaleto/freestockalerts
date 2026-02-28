/**
 * Meta Conversions API (CAPI) — Server-Side Event Tracking
 *
 * Sends events from the server directly to Meta for:
 * - Better attribution (bypasses ad blockers, iOS ATT)
 * - Higher match quality (hashed email + IP + user agent)
 * - Deduplication with browser pixel via shared event_id
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const API_VERSION = "v21.0";
const ENDPOINT = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

interface UserData {
  email?: string;
  ip?: string;
  userAgent?: string;
  fbc?: string; // _fbc cookie (click ID)
  fbp?: string; // _fbp cookie (browser ID)
}

interface CAPIEvent {
  eventName: string;
  eventId: string; // Must match browser pixel event_id for dedup
  eventSourceUrl: string;
  userData: UserData;
  customData?: Record<string, any>;
}

/** SHA-256 hash (Meta requires lowercase hex) */
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Send event to Meta Conversions API */
export async function sendCAPIEvent(event: CAPIEvent): Promise<boolean> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[CAPI] Missing PIXEL_ID or ACCESS_TOKEN — skipping");
    return false;
  }

  const userData: Record<string, any> = {};

  // Hash PII fields per Meta requirements
  if (event.userData.email) {
    userData.em = [sha256(event.userData.email)];
  }
  if (event.userData.ip) {
    userData.client_ip_address = event.userData.ip;
  }
  if (event.userData.userAgent) {
    userData.client_user_agent = event.userData.userAgent;
  }
  // fbc and fbp are NOT hashed
  if (event.userData.fbc) {
    userData.fbc = event.userData.fbc;
  }
  if (event.userData.fbp) {
    userData.fbp = event.userData.fbp;
  }

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        ...(event.customData ? { custom_data: event.customData } : {}),
      },
    ],
    access_token: ACCESS_TOKEN,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[CAPI] ${event.eventName} failed (${res.status}):`, body);
      return false;
    }

    const result = await res.json();
    console.log(
      `[CAPI] ${event.eventName} sent — events_received: ${result.events_received}`
    );
    return true;
  } catch (err) {
    console.error(`[CAPI] ${event.eventName} error:`, err);
    return false;
  }
}

/** Helper: extract fbc and fbp from cookie header string */
export function extractFbCookies(cookieHeader: string | null): {
  fbc?: string;
  fbp?: string;
} {
  if (!cookieHeader) return {};
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return {
    fbc: cookies["_fbc"] || undefined,
    fbp: cookies["_fbp"] || undefined,
  };
}

/** Generate a unique event ID for deduplication */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
