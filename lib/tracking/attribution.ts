/**
 * First-touch acquisition data for a signup: the UTM parameters and Facebook
 * click id on the page the visitor arrived on. Shared by the browser (capture)
 * and the server (validate and store). No cookies: the browser keeps it in
 * sessionStorage for the tab and sends it with the signup request.
 */
export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  fbclid?: string;
  landingPath?: string;
  referrer?: string;
}

export const ATTRIBUTION_KEYS = ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent", "fbclid", "landingPath", "referrer"] as const;

const PARAM_MAP: Record<string, keyof Attribution> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
  fbclid: "fbclid",
};

// Short enough that all eight fields fit the 4KB cookie used on the Google sign-in hand-off.
const LIMIT = 120;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, LIMIT) : "");

/** Pull attribution out of a URL's query string; empty object when there is nothing. */
export function attributionFromUrl(url: URL, referrer?: string | null): Attribution {
  const out: Attribution = {};
  for (const [param, key] of Object.entries(PARAM_MAP)) {
    const v = clean(url.searchParams.get(param));
    if (v) out[key] = v;
  }
  if (Object.keys(out).length === 0) return out;
  out.landingPath = url.pathname.slice(0, LIMIT);
  const ref = clean(referrer);
  if (ref) {
    try {
      out.referrer = new URL(ref).host.slice(0, LIMIT);
    } catch {
      /* not a URL */
    }
  }
  return out;
}

/** Validate an untrusted attribution object from a request body or cookie. */
export function parseAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const v = clean(obj[key]);
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

export const hasAttribution = (a: Attribution | null | undefined): a is Attribution => !!a && Object.keys(a).length > 0;
