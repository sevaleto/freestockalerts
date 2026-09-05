import { isConsentRegion, REGION_COOKIE, regionFromHeaders } from "@/lib/cookies/region";

/**
 * Server-side view of the visitor's marketing consent, for the Meta
 * Conversions API sends that don't go through the browser pixel.
 *
 * Precedence: an explicit fsa_consent choice → the Sec-GPC browser signal →
 * the region (opt-out region = allowed by default, opt-in region = not until
 * they accept).
 */
export function marketingAllowed(request: Request): { allowed: boolean; reason: string } {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) cookies.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }

  const stored = cookies.get("fsa_consent");
  if (stored) {
    try {
      const prefs = JSON.parse(decodeURIComponent(stored)) as { marketing?: unknown };
      if (typeof prefs.marketing === "boolean") {
        return { allowed: prefs.marketing, reason: prefs.marketing ? "consent" : "declined" };
      }
    } catch {
      /* malformed cookie: fall through */
    }
  }

  if (request.headers.get("sec-gpc") === "1") return { allowed: false, reason: "gpc" };

  const cookieRegion = cookies.get(REGION_COOKIE);
  const region = isConsentRegion(cookieRegion) ? cookieRegion : regionFromHeaders(request.headers);
  return region === "optout" ? { allowed: true, reason: "optout-region" } : { allowed: false, reason: "optin-region" };
}
