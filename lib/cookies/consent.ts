/**
 * Cookie consent utilities
 *
 * Categories:
 *  - essential:  Always on (auth, security, basic function)
 *  - analytics:  Site analytics (Google Analytics, etc.)
 *  - marketing:  Ad pixels & retargeting (Meta Pixel, TikTok Pixel, etc.)
 *
 * Two regimes, chosen by region (see ./region.ts):
 *  - optin  (EEA/UK/CH): nothing non-essential until the visitor accepts.
 *  - optout (everyone else, incl. US): on by default, no banner; the visitor
 *    can opt out from the footer, and a Global Privacy Control signal turns
 *    marketing off automatically. No cookie is written until they choose.
 */

import { isConsentRegion, REGION_COOKIE, type ConsentRegion } from "./region";

export type ConsentCategory = "essential" | "analytics" | "marketing";

export interface ConsentPreferences {
  essential: true; // always true — cannot be disabled
  analytics: boolean;
  marketing: boolean;
  timestamp: string; // ISO 8601
}

const COOKIE_NAME = "fsa_consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

/** Default preferences (all non-essential OFF) */
export const DEFAULT_PREFERENCES: ConsentPreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  timestamp: "",
};

/** Accept-all preferences */
export function acceptAllPreferences(): ConsentPreferences {
  return {
    essential: true,
    analytics: true,
    marketing: true,
    timestamp: new Date().toISOString(),
  };
}

/** Reject-all (essential only) preferences */
export function rejectAllPreferences(): ConsentPreferences {
  return {
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: new Date().toISOString(),
  };
}

/** Read consent from cookie — returns null if no consent recorded */
export function getConsent(): ConsentPreferences | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  try {
    const decoded = decodeURIComponent(match.split("=")[1]);
    const parsed = JSON.parse(decoded) as ConsentPreferences;
    // Validate shape
    if (typeof parsed.essential !== "boolean" || !parsed.timestamp) return null;
    return { ...parsed, essential: true }; // essential always forced true
  } catch {
    return null;
  }
}

/** Write consent to cookie */
export function setConsent(prefs: ConsentPreferences): void {
  if (typeof document === "undefined") return;

  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

/** Check if a specific category has consent */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "essential") return true;
  const prefs = getConsent();
  if (!prefs) return false;
  return prefs[category] === true;
}

/** Region the middleware stamped on this browser; null when absent (local dev, first paint). */
export function readRegionCookie(): ConsentRegion | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${REGION_COOKIE}=`));
  const value = match?.split("=")[1];
  return isConsentRegion(value) ? value : null;
}

/** Global Privacy Control browser signal (Firefox, Brave, DuckDuckGo, Chrome with the flag). */
export function hasGpc(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/**
 * What applies right now: a stored choice always wins; otherwise the region
 * default (opt-out region: on, minus marketing when GPC is set; opt-in: off).
 */
export function effectivePreferences(
  stored: ConsentPreferences | null,
  region: ConsentRegion,
  gpc: boolean
): ConsentPreferences {
  if (stored) return stored;
  if (region === "optout") {
    return { essential: true, analytics: true, marketing: !gpc, timestamp: "" };
  }
  return DEFAULT_PREFERENCES;
}
