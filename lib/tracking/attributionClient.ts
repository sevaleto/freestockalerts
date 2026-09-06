"use client";

import { attributionFromUrl, hasAttribution, type Attribution } from "./attribution";

const STORAGE_KEY = "fsa_attr";

/**
 * Remember the first URL with UTM/fbclid parameters the visitor landed on in
 * this tab, so a signup a few pages later still carries the ad that brought
 * them. sessionStorage: cleared when the tab closes, never sent as a cookie.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const found = attributionFromUrl(new URL(window.location.href), document.referrer);
    if (hasAttribution(found)) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    /* storage blocked */
  }
}

/** Stored first-touch attribution, else whatever is on the current URL, else null. */
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Attribution;
      if (hasAttribution(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  try {
    const found = attributionFromUrl(new URL(window.location.href), document.referrer);
    return hasAttribution(found) ? found : null;
  } catch {
    return null;
  }
}
