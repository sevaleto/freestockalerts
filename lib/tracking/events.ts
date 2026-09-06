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

/**
 * Whether the Meta pixel bootstrap has run. The inline snippet defines a
 * queueing `fbq` stub synchronously, so once this is true events are safe to
 * send even if fbevents.js itself is still downloading.
 */
export function metaPixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Run `cb` once the Meta pixel stub exists, polling every 100ms up to
 * `timeoutMs`. The pixel only mounts after the consent provider's first
 * effect and Next's afterInteractive injection, so an event fired on a fixed
 * timer right after a redirect can land before `fbq` is defined and be
 * dropped by the guards above. Calls `cb(false)` on timeout (pixel blocked,
 * no marketing consent) so callers can decide what to do.
 * Returns a cancel function.
 */
export function onMetaPixelReady(cb: (ready: boolean) => void, timeoutMs: number = 8000): () => void {
  if (metaPixelReady()) {
    cb(true);
    return () => {};
  }
  const started = Date.now();
  const timer = setInterval(() => {
    if (metaPixelReady()) {
      clearInterval(timer);
      cb(true);
    } else if (Date.now() - started >= timeoutMs) {
      clearInterval(timer);
      cb(false);
    }
  }, 100);
  return () => clearInterval(timer);
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

  // Browser pixel (with event_id for dedup)
  fbWithId("Lead", eventId, { content_name: contentName, method });
  tt("SubmitForm", { content_name: contentName, method });

  // Server-side CAPI (async, fire-and-forget)
  if (typeof window !== "undefined") {
    fetch("/api/tracking/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, email, method, content_name: contentName }),
      keepalive: true, // survives page navigation (OAuth redirect)
    }).catch(() => {}); // silent fail
  }
}

/**
 * A brand-new account finished registering and landed on the dashboard.
 * Pass the CAPI event_id (URL param capi_eid) so Meta dedupes this against the
 * server event; callers should not fire this for returning sign-ins.
 * Returns true when the Meta pixel was present and the event was queued.
 */
export function trackCompleteRegistration(capiEventId?: string): boolean {
  const eventId = capiEventId || generateEventId();

  // Browser pixel — uses same event_id as CAPI for dedup
  const sent = metaPixelReady();
  fbWithId("CompleteRegistration", eventId, { content_name: "dashboard" });
  tt("CompleteRegistration", { content_name: "dashboard" });
  return sent;
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
