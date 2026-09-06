/**
 * Validation for admin-submitted landing pages and headline variants. Picks
 * fields explicitly so nothing else leaks through (same shape as
 * validateAdInput in lib/ads/template.ts). Pure: safe in unit tests.
 */
import { getStrategy } from "@/lib/templates/catalog";
import type { SampleAlert } from "@/lib/lp/pages";
import { HOME_SLUG, PAGE_STATUSES, type PageStatus, type PageKind } from "@/lib/lp/view";
import { isPageSlug, isVariantKey, PAGE_SLUG_MAX } from "@/lib/cookies/bucket";

type Result<T> = { ok: true; input: T } | { ok: false; error: string };

const str = (v: unknown, limit: number): string => (typeof v === "string" ? v.trim().slice(0, limit) : "");
const optional = (v: unknown, limit: number): string | null => {
  const s = str(v, limit);
  return s ? s : null;
};

export const LIMITS = {
  headline: 200,
  subheadline: 400,
  eyebrow: 80,
  logicLine: 400,
  bullet: 200,
  bullets: 6,
  ctaLabel: 60,
  googleLabel: 60,
  proofTitle: 120,
  disclosure: 200,
  afterSignupNote: 200,
  og: 200,
  sampleField: 300,
} as const;

/** Words Manny's compliance rules ban in financial copy. Warn, never block: "insider" is legitimate in the SEC Form 4 sense. */
export const COMPLIANCE_TERMS = ["guaranteed", "guarantee", "risk-free", "risk free", "secret", "insider"] as const;

export function complianceWarnings(text: string): string[] {
  const lower = text.toLowerCase();
  return COMPLIANCE_TERMS.filter((t) => lower.includes(t));
}

export interface VariantInput {
  key: string;
  headline: string;
  subheadline: string;
  weight: number;
  isActive: boolean;
}

export function validateVariantInput(data: Record<string, unknown>): Result<VariantInput> {
  const key = str(data.key, 4).toUpperCase();
  if (!isVariantKey(key)) return { ok: false, error: "Variant key must be a single letter A–Z" };
  const headline = str(data.headline, LIMITS.headline).replace(/\r\n/g, "\n");
  const subheadline = str(data.subheadline, LIMITS.subheadline);
  if (!headline) return { ok: false, error: `Variant ${key}: headline is required` };
  if (!subheadline) return { ok: false, error: `Variant ${key}: subheadline is required` };
  const weightRaw = typeof data.weight === "number" ? data.weight : Number(str(data.weight, 5));
  if (!Number.isInteger(weightRaw) || weightRaw < 0 || weightRaw > 100) return { ok: false, error: `Variant ${key}: weight must be a whole number from 0 to 100` };
  const isActive = data.isActive === undefined ? true : data.isActive === true || data.isActive === "true";
  return { ok: true, input: { key, headline, subheadline, weight: weightRaw, isActive } };
}

const SAMPLE_REQUIRED: (keyof SampleAlert)[] = ["ticker", "badge", "alertType", "priceLabel", "price", "change", "time", "volume", "marketCap", "whyTitle", "why", "context"];
const SAMPLE_OPTIONAL: (keyof SampleAlert)[] = ["companyName", "subject"];

/** A SampleAlert from untrusted JSON; null when absent, an error string when malformed. */
export function validateSampleAlert(data: unknown): { ok: true; sample: SampleAlert | null } | { ok: false; error: string } {
  if (data === undefined || data === null || data === "") return { ok: true, sample: null };
  if (typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "Sample alert must be an object" };
  const d = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SAMPLE_REQUIRED) {
    const v = str(d[k], LIMITS.sampleField);
    if (!v) return { ok: false, error: `Sample alert: ${k} is required` };
    out[k] = v;
  }
  for (const k of SAMPLE_OPTIONAL) {
    const v = str(d[k], LIMITS.sampleField);
    if (v) out[k] = v;
  }
  if (d.volumeMultiple !== undefined && d.volumeMultiple !== null && d.volumeMultiple !== "") {
    const n = typeof d.volumeMultiple === "number" ? d.volumeMultiple : Number(str(d.volumeMultiple, 8));
    if (!Number.isFinite(n) || n <= 0 || n > 100) return { ok: false, error: "Sample alert: volume multiple must be a number between 0 and 100" };
    out.volumeMultiple = n;
  }
  return { ok: true, sample: out as unknown as SampleAlert };
}

export interface LandingPageInput {
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
  variants: VariantInput[];
}

export interface ValidateOptions {
  /** Editing an existing page: the slug and kind are fixed and come from the row. */
  existing?: { slug: string; kind: PageKind } | null;
}

export function validateLandingPageInput(data: Record<string, unknown>, opts: ValidateOptions = {}): Result<LandingPageInput> {
  const kind: PageKind = opts.existing?.kind ?? "GO";
  const slug = opts.existing?.slug ?? str(data.slug, PAGE_SLUG_MAX + 1).toLowerCase();
  if (!opts.existing) {
    if (!isPageSlug(slug)) return { ok: false, error: "Slug must be 2–40 lowercase letters, digits or hyphens (e.g. breakouts-v2)" };
    if (slug === HOME_SLUG) return { ok: false, error: `"${HOME_SLUG}" is reserved for the homepage` };
  }

  const status = PAGE_STATUSES.find((s) => s === str(data.status, 10).toUpperCase()) ?? "DRAFT";

  let templateSlug = str(data.templateSlug, 80);
  if (kind === "GO") {
    if (!templateSlug) return { ok: false, error: "Pick a strategy" };
    if (!getStrategy(templateSlug)) return { ok: false, error: `Unknown strategy: ${templateSlug}` };
  } else {
    templateSlug = "";
  }

  const rawBullets = Array.isArray(data.bullets) ? data.bullets : typeof data.bullets === "string" ? data.bullets.split("\n") : [];
  const bullets = rawBullets.map((b) => str(b, LIMITS.bullet)).filter(Boolean).slice(0, LIMITS.bullets);

  const sample = validateSampleAlert(data.sampleAlert);
  if (!sample.ok) return sample;

  const rawVariants = Array.isArray(data.variants) ? data.variants : [];
  if (rawVariants.length === 0) return { ok: false, error: "At least one headline variant is required" };
  if (rawVariants.length > 26) return { ok: false, error: "At most 26 variants" };
  const variants: VariantInput[] = [];
  for (const raw of rawVariants) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Malformed variant" };
    const parsed = validateVariantInput(raw as Record<string, unknown>);
    if (!parsed.ok) return parsed;
    if (variants.some((v) => v.key === parsed.input.key)) return { ok: false, error: `Duplicate variant key ${parsed.input.key}` };
    variants.push(parsed.input);
  }
  variants.sort((a, b) => a.key.localeCompare(b.key));

  return {
    ok: true,
    input: {
      slug,
      kind,
      status,
      templateSlug,
      eyebrow: optional(data.eyebrow, LIMITS.eyebrow),
      logicLine: optional(data.logicLine, LIMITS.logicLine),
      bullets,
      ctaLabel: optional(data.ctaLabel, LIMITS.ctaLabel),
      googleLabel: optional(data.googleLabel, LIMITS.googleLabel),
      proofTitle: optional(data.proofTitle, LIMITS.proofTitle),
      disclosure: optional(data.disclosure, LIMITS.disclosure),
      afterSignupNote: optional(data.afterSignupNote, LIMITS.afterSignupNote),
      sampleAlert: sample.sample,
      ogTitle: optional(data.ogTitle, LIMITS.og),
      ogDescription: optional(data.ogDescription, LIMITS.og),
      variants,
    },
  };
}

/** Next unused variant letter for the "Add variant" button. */
export function nextVariantKey(existing: readonly string[]): string | null {
  for (let c = 65; c <= 90; c++) {
    const k = String.fromCharCode(c);
    if (!existing.includes(k)) return k;
  }
  return null;
}
