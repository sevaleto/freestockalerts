/**
 * Landing pages for rendering: database rows through Next's data cache, with
 * the static config (lib/lp/pages.ts) and the seeded homepage copy as
 * fallbacks so an ad page or the homepage never fails on a database blip.
 *
 * Cache keys are per slug and tagged `lp:<slug>` (+ `lp:all`); the admin
 * write routes call revalidateTag so edits show up on the next request.
 * Never read cookies() inside a cached function: pick the variant outside.
 */
import { unstable_cache } from "next/cache";
import type { LandingPage as LandingPageRow, HeadlineVariant as HeadlineVariantRow } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getLandingPage } from "@/lib/lp/pages";
import type { SampleAlert } from "@/lib/lp/pages";
import { getStrategy } from "@/lib/templates/catalog";
import { pickVariant } from "@/lib/ab/pick";
import { isPageSlug, isVariantKey } from "@/lib/cookies/bucket";
import { HOME_RECORD } from "@/lib/lp/home";
import { HOME_SLUG, heroHeadline, recordFromStatic, toView, type HeroHeadline, type LandingPageView, type PageRecord, type VariantRecord } from "@/lib/lp/view";

export const pageTag = (slug: string) => `lp:${slug}`;
export const ALL_PAGES_TAG = "lp:all";
const PAGE_REVALIDATE_SEC = 3600;

export type PageRowWithVariants = LandingPageRow & { variants: HeadlineVariantRow[] };

export function toVariantRecord(v: HeadlineVariantRow): VariantRecord {
  return { key: v.key, headline: v.headline, subheadline: v.subheadline, weight: v.weight, isActive: v.isActive, views: v.views };
}

/** Prisma row → JSON-safe record (no Dates, so it survives the data cache). */
export function toRecord(row: PageRowWithVariants): PageRecord {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    templateSlug: row.templateSlug,
    eyebrow: row.eyebrow,
    logicLine: row.logicLine,
    bullets: row.bullets,
    ctaLabel: row.ctaLabel,
    googleLabel: row.googleLabel,
    proofTitle: row.proofTitle,
    disclosure: row.disclosure,
    afterSignupNote: row.afterSignupNote,
    sampleAlert: (row.sampleAlert as SampleAlert | null) ?? null,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    variants: [...row.variants].sort((a, b) => a.key.localeCompare(b.key)).map(toVariantRecord),
  };
}

export const loadPageCached = (slug: string): Promise<PageRecord | null> =>
  unstable_cache(
    async () => {
      const row = await prisma.landingPage.findUnique({ where: { slug }, include: { variants: true } });
      return row ? toRecord(row) : null;
    },
    ["lp-page", slug],
    { tags: [pageTag(slug), ALL_PAGES_TAG], revalidate: PAGE_REVALIDATE_SEC }
  )();

/** Database first; static config (ad pages) or seeded copy (home) when the row is missing or the read fails. */
export async function loadPageRecord(slug: string): Promise<PageRecord | null> {
  if (!isPageSlug(slug)) return null;
  try {
    const record = await loadPageCached(slug);
    if (record) return record;
  } catch (err) {
    console.error(`[lp] page read failed for ${slug}, using static fallback:`, err);
  }
  if (slug === HOME_SLUG) return HOME_RECORD;
  const lp = getLandingPage(slug);
  return lp ? recordFromStatic(lp) : null;
}

export interface ResolveOptions {
  /** `?v=B`: show this variant regardless of the bucket (previews, QA). */
  forceKey?: string | null;
  /** Admin preview of DRAFT / ARCHIVED pages. */
  allowDraft?: boolean;
}

export function resolveVariant(record: PageRecord, bucket: number | null, forceKey?: string | null): { variant: VariantRecord; forced: boolean } {
  if (forceKey && isVariantKey(forceKey)) {
    const v = record.variants.find((x) => x.key === forceKey);
    if (v) return { variant: v, forced: true };
  }
  const picked = pickVariant(record.variants, bucket, record.slug);
  return { variant: picked ?? { key: "A", headline: "", subheadline: "", weight: 1, isActive: true, views: 0 }, forced: false };
}

export interface ResolvedPage {
  view: LandingPageView;
  forced: boolean;
}

/** An ad page ready to render, or null for unknown, non-GO, or unpublished slugs. */
export async function getLandingPageView(slug: string, bucket: number | null, opts: ResolveOptions = {}): Promise<ResolvedPage | null> {
  const record = await loadPageRecord(slug);
  if (!record || record.kind !== "GO") return null;
  if (record.status !== "LIVE" && !opts.allowDraft) return null;
  const { variant, forced } = resolveVariant(record, bucket, opts.forceKey);
  return { view: toView(record, variant, getStrategy(record.templateSlug)), forced };
}

/** The homepage hero copy for this visitor. Always resolves (seeded copy as the last resort). */
export async function getHomeHeadline(bucket: number | null, forceKey?: string | null): Promise<HeroHeadline & { forced: boolean }> {
  const record = (await loadPageRecord(HOME_SLUG)) ?? HOME_RECORD;
  const { variant, forced } = resolveVariant(record.variants.length ? record : HOME_RECORD, bucket, forceKey);
  return { ...heroHeadline(HOME_SLUG, variant), forced };
}
