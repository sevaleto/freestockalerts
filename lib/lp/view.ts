/**
 * The shape a landing page renders from, whichever source it came from
 * (database row, or the static fallback in lib/lp/pages.ts). JSON-safe on
 * purpose: rows pass through Next's data cache.
 */
import type { LandingPage as StaticLandingPage, SampleAlert } from "@/lib/lp/pages";
import type { StrategyDefinition } from "@/lib/templates/catalog";

export type PageKind = "HOME" | "GO";
export type PageStatus = "DRAFT" | "LIVE" | "ARCHIVED";
export const PAGE_STATUSES: readonly PageStatus[] = ["DRAFT", "LIVE", "ARCHIVED"];

export interface VariantRecord {
  key: string;
  headline: string;
  subheadline: string;
  weight: number;
  isActive: boolean;
  views: number;
}

/** A page as stored (or as the static config maps onto storage). */
export interface PageRecord {
  id: string | null;
  slug: string;
  kind: PageKind;
  status: PageStatus;
  templateSlug: string;
  eyebrow: string | null;
  logicLine: string | null;
  bullets: string[];
  ctaLabel: string | null;
  googleLabel: string | null;
  proofTitle: string | null;
  disclosure: string | null;
  afterSignupNote: string | null;
  sampleAlert: SampleAlert | null;
  ogTitle: string | null;
  ogDescription: string | null;
  variants: VariantRecord[];
}

/** Everything app/go/[slug]/page.tsx and the homepage hero need, already resolved to one variant. */
export interface LandingPageView {
  slug: string;
  kind: PageKind;
  status: PageStatus;
  templateSlug: string;
  /** Stored in User.signupSource for attribution. */
  source: `lp:${string}`;
  /** Meta pixel content_name for ViewContent / Lead. */
  metaContentName: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  logicLine: string;
  bullets: string[];
  ctaLabel: string;
  googleLabel: string;
  disclosure: string;
  sampleAlert: SampleAlert;
  proofTitle: string;
  afterSignupNote: string;
  /** Stable metadata regardless of which variant the visitor drew. */
  ogTitle: string;
  ogDescription: string;
  variantKey: string;
  /** "<slug>:<key>", the value recorded on User.signupVariant. */
  variantTag: string;
}

export const HOME_SLUG = "home";

/** Copy shared by every ad page unless a page overrides it. */
export const DEFAULTS = {
  eyebrow: "Free forever • Set up in 60 seconds",
  ctaLabel: "Send me the free alerts",
  googleLabel: "Continue with Google",
  disclosure: "Educational information only. Not investment advice.",
  proofTitle: "Here's exactly what you'll be watching",
  afterSignupNote: "Your alerts go live the moment you confirm your email. No setup.",
} as const;

/** The generic sample shown when neither the page nor the strategy has one. */
export const FALLBACK_SAMPLE: SampleAlert = {
  ticker: "XYZ",
  companyName: "Example Co.",
  subject: "XYZ crossed your trigger — here's what moved it",
  volumeMultiple: 1.4,
  badge: "Trigger crossed",
  alertType: "Watchlist alert",
  priceLabel: "Price",
  price: "$84.20",
  change: "+2.1%",
  time: "10:40 AM ET",
  volume: "4.1M (1.4x avg)",
  marketCap: "$12B",
  whyTitle: "Why it triggered",
  why: "Crossed the level on above-average volume",
  context: "Illustrative example. Real alerts carry the live price, volume versus the 30-day average, and plain-English context on what happened.",
};

export const firstLine = (headline: string) => headline.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

/** Static config → the stored shape (single variant A). Used by the seed and the fallback path. */
export function recordFromStatic(lp: StaticLandingPage): PageRecord {
  return {
    id: null,
    slug: lp.slug,
    kind: "GO",
    status: "LIVE",
    templateSlug: lp.templateSlug,
    eyebrow: lp.eyebrow,
    logicLine: lp.logicLine,
    bullets: lp.bullets,
    ctaLabel: lp.ctaLabel,
    googleLabel: lp.googleLabel,
    proofTitle: lp.proofTitle,
    disclosure: lp.disclosure,
    afterSignupNote: lp.afterSignupNote,
    sampleAlert: lp.sampleAlert,
    ogTitle: lp.ogTitle ?? null,
    ogDescription: lp.ogDescription ?? null,
    variants: [{ key: "A", headline: lp.headline, subheadline: lp.subheadline, weight: 1, isActive: true, views: 0 }],
  };
}

/** Prefill for a page that was just pointed at a strategy. */
export function defaultsFromStrategy(s: StrategyDefinition) {
  return {
    headline: s.landing.headline,
    subheadline: s.landing.description,
    logicLine: s.valueProposition,
    bullets: s.triggerRules.slice(0, 3),
    sampleAlert: s.sampleAlert,
    ogTitle: firstLine(s.landing.headline),
    ogDescription: s.landing.description,
  };
}

/** Resolve one record + one variant into the render shape. */
export function toView(record: PageRecord, variant: VariantRecord, strategy: StrategyDefinition | null): LandingPageView {
  const a = record.variants.find((v) => v.key === "A") ?? record.variants[0] ?? variant;
  return {
    slug: record.slug,
    kind: record.kind,
    status: record.status,
    templateSlug: record.templateSlug,
    source: `lp:${record.slug}`,
    metaContentName: `lp_${record.slug}`,
    eyebrow: record.eyebrow ?? DEFAULTS.eyebrow,
    headline: variant.headline,
    subheadline: variant.subheadline,
    logicLine: record.logicLine ?? strategy?.valueProposition ?? "",
    bullets: record.bullets.length ? record.bullets : (strategy?.triggerRules.slice(0, 3) ?? []),
    ctaLabel: record.ctaLabel ?? DEFAULTS.ctaLabel,
    googleLabel: record.googleLabel ?? DEFAULTS.googleLabel,
    disclosure: record.disclosure ?? DEFAULTS.disclosure,
    sampleAlert: record.sampleAlert ?? strategy?.sampleAlert ?? FALLBACK_SAMPLE,
    proofTitle: record.proofTitle ?? DEFAULTS.proofTitle,
    afterSignupNote: record.afterSignupNote ?? DEFAULTS.afterSignupNote,
    ogTitle: record.ogTitle ?? firstLine(a.headline),
    ogDescription: record.ogDescription ?? a.subheadline,
    variantKey: variant.key,
    variantTag: `${record.slug}:${variant.key}`,
  };
}

/** Homepage hero copy: first line navy, second line teal, sub below. */
export interface HeroHeadline {
  line1: string;
  line2: string;
  sub: string;
  variantKey: string;
  variantTag: string;
}

export function heroHeadline(slug: string, variant: VariantRecord): HeroHeadline {
  const [line1, ...rest] = variant.headline.split("\n");
  return { line1: line1.trim(), line2: rest.join(" ").trim(), sub: variant.subheadline, variantKey: variant.key, variantTag: `${slug}:${variant.key}` };
}
