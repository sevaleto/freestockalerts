/**
 * Pixel event helpers — Meta & TikTok
 *
 * Safe to call anywhere: no-ops when pixels aren't loaded or consent not given.
 * Events only fire client-side when the respective pixel global exists.
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: { track: (...args: any[]) => void; page: () => void };
  }
}

function fb(event: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params);
  }
}

function tt(event: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && window.ttq && typeof window.ttq.track === "function") {
    window.ttq.track(event, params);
  }
}

// ─── Standard Events ────────────────────────────────────────────

/** User initiates signup (clicks Google OAuth or submits email) */
export function trackLead(method: "google" | "email" = "google") {
  fb("Lead", { content_name: "signup", method });
  tt("SubmitForm", { content_name: "signup", method });
}

/** User successfully authenticated and lands on dashboard */
export function trackCompleteRegistration() {
  fb("CompleteRegistration", { content_name: "dashboard" });
  tt("CompleteRegistration", { content_name: "dashboard" });
}

/** User views a template detail page */
export function trackViewContent(templateName: string, templateSlug: string) {
  fb("ViewContent", {
    content_name: templateName,
    content_ids: [templateSlug],
    content_type: "template",
  });
  tt("ViewContent", {
    content_name: templateName,
    content_id: templateSlug,
    content_type: "template",
  });
}

/** User searches for a ticker */
export function trackSearch(query: string) {
  fb("Search", { search_string: query });
  // TikTok doesn't have a native Search event — use custom
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
