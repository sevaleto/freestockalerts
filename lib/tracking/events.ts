/**
 * Pixel event helpers — Meta (browser + CAPI) & TikTok
 *
 * Safe to call anywhere: no-ops when pixels aren't loaded or consent not given.
 * Events only fire client-side when the respective pixel global exists.
 *
 * Lead events also send to /api/tracking/lead for server-side CAPI dedup.
 * CompleteRegistration CAPI fires from /api/auth/callback (server-side).
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: { track: (...args: any[]) => void; page: () => void };
  }
}

/** Generate a unique event ID for Meta pixel ↔ CAPI deduplication */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function fb(event: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params);
  }
}

/** Fire Meta event with event_id for CAPI dedup */
function fbWithId(event: string, eventId: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params, { eventID: eventId });
  }
}

function tt(event: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && window.ttq && typeof window.ttq.track === "function") {
    window.ttq.track(event, params);
  }
}

// ─── Standard Events ────────────────────────────────────────────

/**
 * User clicked "Continue with Google". This is intent, not a lead: the real
 * Lead fires server-side from the auth callback once Google hands back a
 * verified email. Sent as a custom event so it never trains Meta's Lead model.
 */
export function trackInitiateSignup(contentName: string = "signup") {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", "InitiateSignup", { content_name: contentName, method: "google" });
  }
  tt("ClickButton", { content_name: contentName, method: "google" });
}

/** User submitted the email form (a captured lead) */
export function trackLead(
  method: "google" | "email" = "google",
  email?: string,
  contentName: string = "signup"
) {
  const eventId = generateEventId();

  // Capture A/B variant for attribution
  const abVariant = typeof document !== "undefined"
    ? document.cookie.split("; ").find((c) => c.startsWith("ab_hero_headline="))?.split("=")[1] ?? null
    : null;

  // Browser pixel (with event_id for dedup)
  fbWithId("Lead", eventId, { content_name: contentName, method });
  tt("SubmitForm", { content_name: contentName, method });

  // Server-side CAPI (async, fire-and-forget)
  if (typeof window !== "undefined") {
    fetch("/api/tracking/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, email, method, ab_variant: abVariant, content_name: contentName }),
      keepalive: true, // survives page navigation (OAuth redirect)
    }).catch(() => {}); // silent fail
  }
}

/**
 * User successfully authenticated and lands on dashboard.
 * Accepts optional event_id from CAPI (passed via URL param capi_eid).
 */
export function trackCompleteRegistration(capiEventId?: string) {
  const eventId = capiEventId || generateEventId();

  // Browser pixel — uses same event_id as CAPI for dedup
  fbWithId("CompleteRegistration", eventId, { content_name: "dashboard" });
  tt("CompleteRegistration", { content_name: "dashboard" });
}

/** User views a template detail page */
export function trackViewContent(
  templateName: string,
  templateSlug: string,
  contentType: string = "template"
) {
  fb("ViewContent", {
    content_name: templateName,
    content_ids: [templateSlug],
    content_type: contentType,
  });
  tt("ViewContent", {
    content_name: templateName,
    content_id: templateSlug,
    content_type: contentType,
  });
}

/** User searches for a ticker */
export function trackSearch(query: string) {
  fb("Search", { search_string: query });
  tt("Search", { query });
}

/** User activates a template (subscribes) */
export function trackSubscribe(templateName: string, alertCount: number) {
  fb("Subscribe", {
    content_name: templateName,
    num_items: alertCount,
    currency: "USD",
    value: 0,
  });
  tt("Subscribe", {
    content_name: templateName,
    quantity: alertCount,
  });
}
