/**
 * Cookie consent utilities
 *
 * Categories:
 *  - essential:  Always on (auth, security, basic function)
 *  - analytics:  Site analytics (Google Analytics, etc.)
 *  - marketing:  Ad pixels & retargeting (Meta Pixel, TikTok Pixel, etc.)
 */

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

/** Revoke consent (delete cookie) */
export function revokeConsent(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax; Secure`;
}
