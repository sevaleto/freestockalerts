/**
 * Consent region: decides whether a visitor gets an opt-in banner (EEA, UK,
 * Switzerland) or the US-style opt-out model (no banner, pixels on by
 * default, "Do Not Sell or Share" + "Cookie Settings" in the footer, GPC
 * honored).
 *
 * The country comes from Cloudflare's `cf-ipcountry` header (the domain is
 * proxied, and Cloudflare overwrites this header so it cannot be spoofed),
 * with Vercel's `x-vercel-ip-country` as a fallback. Unknown → opt-in, the
 * safe default, which is also what local dev sees.
 *
 * No React in this file: it is imported by the edge middleware.
 */

export type ConsentRegion = "optin" | "optout";

export const REGION_COOKIE = "fsa_region";
export const REGION_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** EU-27 + EEA (IS, LI, NO) + UK + Switzerland. */
export const OPT_IN_COUNTRIES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "CH",
]);

export function regionFromCountry(code: string | null | undefined): ConsentRegion {
  const c = (code ?? "").trim().toUpperCase();
  if (!c || c === "XX" || c === "T1") return "optin"; // unknown / Tor: ask
  return OPT_IN_COUNTRIES.has(c) ? "optin" : "optout";
}

export function countryFromHeaders(headers: Headers): string | null {
  return headers.get("cf-ipcountry") || headers.get("x-vercel-ip-country") || null;
}

export function regionFromHeaders(headers: Headers): ConsentRegion {
  return regionFromCountry(countryFromHeaders(headers));
}

export function isConsentRegion(v: unknown): v is ConsentRegion {
  return v === "optin" || v === "optout";
}
