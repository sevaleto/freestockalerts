/**
 * Pure helpers for the subscriber table: cohort keys, attribution merging,
 * and mapping a Beehiiv subscription onto our columns.
 */
import type { BeehiivSubscription } from "@/lib/beehiiv/client";

export type AttributionSource = "app" | "beehiiv_fsa" | "beehiiv_si";

export interface AttributionFields {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referringSite: string | null;
  landingPath: string | null;
}

export const EMPTY_ATTRIBUTION: AttributionFields = { utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, referringSite: null, landingPath: null };

const norm = (v: unknown, limit = 200) => {
  const s = typeof v === "string" ? v.trim().slice(0, limit) : "";
  return s ? s : null;
};

export const NONE = "(none)";

/**
 * "<source>|<medium>|<campaign>", lowercased, so the same ad set from two
 * lists lands in one cohort. Untagged signups are keyed by the landing page
 * they converted on (source "landing:/go/<slug>") so Facebook traffic that
 * carries no UTM still shows up as its own cohort instead of "(none)".
 */
export function cohortKey(a: Pick<AttributionFields, "utmSource" | "utmMedium" | "utmCampaign"> & { landingPath?: string | null }): string {
  const part = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\|/g, "/").slice(0, 200) || NONE;
  const source = part(a.utmSource) !== NONE ? part(a.utmSource) : a.landingPath ? `landing:${part(a.landingPath)}` : NONE;
  return `${source}|${part(a.utmMedium)}|${part(a.utmCampaign)}`;
}

export function cohortLabel(key: string): { source: string; medium: string; campaign: string } {
  const [source = NONE, medium = NONE, campaign = NONE] = key.split("|");
  return { source, medium, campaign };
}

/** Beehiiv writes "direct" when nothing was tagged; treat it as no attribution so a real tag from another source can win. */
export const hasRealAttribution = (a: AttributionFields) => !!(a.utmSource && a.utmSource.toLowerCase() !== "direct") || !!a.utmMedium || !!a.utmCampaign || !!a.referringSite;

export function attributionFromBeehiiv(s: BeehiivSubscription): AttributionFields {
  return {
    utmSource: norm(s.utm_source),
    utmMedium: norm(s.utm_medium),
    utmCampaign: norm(s.utm_campaign),
    utmTerm: norm(s.utm_term),
    utmContent: norm(s.utm_content),
    referringSite: norm(s.referring_site, 500),
    landingPath: null,
  };
}

export function attributionFromUser(u: { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmTerm: string | null; utmContent: string | null; referrer: string | null; landingPath: string | null; signupSource: string | null }): AttributionFields {
  return {
    utmSource: norm(u.utmSource),
    utmMedium: norm(u.utmMedium),
    utmCampaign: norm(u.utmCampaign),
    utmTerm: norm(u.utmTerm),
    utmContent: norm(u.utmContent),
    referringSite: norm(u.referrer, 500),
    // Landing page slug is attribution too when no UTM was carried.
    landingPath: norm(u.landingPath) ?? (u.signupSource?.startsWith("lp:") ? `/go/${u.signupSource.slice(3)}` : null),
  };
}

export interface Existing {
  firstSeenAt: Date;
  attributionSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referringSite: string | null;
  landingPath: string | null;
}

/**
 * First touch wins: the attribution kept is the one from the earliest signup
 * that actually carries tags. A later source only replaces an untagged one.
 */
export function mergeAttribution(existing: Existing | null, incoming: { source: AttributionSource; createdAt: Date; attribution: AttributionFields }): { firstSeenAt: Date; attributionSource: AttributionSource | string | null } & AttributionFields {
  const inc = incoming.attribution;
  if (!existing) {
    return { firstSeenAt: incoming.createdAt, attributionSource: incoming.source, ...inc };
  }
  const firstSeenAt = incoming.createdAt < existing.firstSeenAt ? incoming.createdAt : existing.firstSeenAt;
  const existingReal = hasRealAttribution(existing);
  const incomingReal = hasRealAttribution(inc);
  const incomingWins = incomingReal && (!existingReal || incoming.createdAt < existing.firstSeenAt);
  if (incomingWins) return { firstSeenAt, attributionSource: incoming.source, ...inc };
  if (!existing.attributionSource && !existingReal && !incomingReal) return { firstSeenAt, attributionSource: incoming.source, ...inc };
  return {
    firstSeenAt,
    attributionSource: existing.attributionSource,
    utmSource: existing.utmSource,
    utmMedium: existing.utmMedium,
    utmCampaign: existing.utmCampaign,
    utmTerm: existing.utmTerm,
    utmContent: existing.utmContent,
    referringSite: existing.referringSite,
    landingPath: existing.landingPath,
  };
}

export const monthOf = (d: Date) => d.toISOString().slice(0, 7);
