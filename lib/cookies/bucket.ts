/**
 * Split-test cookies.
 *
 * `fsa_bucket` is a random integer stamped once per browser by the middleware
 * (same shape as `fsa_region`). Pages turn it into a headline variant with
 * lib/ab/pick.ts, so assignment is stable per visitor and page without the
 * edge knowing anything about the tests.
 *
 * `fsa_var` is written by the page the visitor last saw ("<page slug>:<key>")
 * and read by the auth routes at signup, where it becomes User.signupVariant.
 *
 * No React in this file: it is imported by the edge middleware.
 */

export const BUCKET_COOKIE = "fsa_bucket";
export const BUCKET_MAX = 10_000;
export const BUCKET_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export const VARIANT_COOKIE = "fsa_var";
export const VARIANT_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/** Page slugs: lowercase words joined by single hyphens, 2–40 chars. "home" is the homepage. */
export const PAGE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PAGE_SLUG_MAX = 40;

export const VARIANT_KEY_RE = /^[A-Z]$/;

export const isPageSlug = (v: unknown): v is string =>
  typeof v === "string" && v.length >= 2 && v.length <= PAGE_SLUG_MAX && PAGE_SLUG_RE.test(v);

export const isVariantKey = (v: unknown): v is string => typeof v === "string" && VARIANT_KEY_RE.test(v);

export const variantTag = (slug: string, key: string) => `${slug}:${key}`;

/** "<slug>:<KEY>" with a valid slug and a single capital letter. */
export function isVariantTag(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const i = v.lastIndexOf(":");
  if (i <= 0) return false;
  return isPageSlug(v.slice(0, i)) && isVariantKey(v.slice(i + 1));
}

export function parseVariantTag(v: unknown): { slug: string; key: string } | null {
  if (!isVariantTag(v)) return null;
  const i = v.lastIndexOf(":");
  return { slug: v.slice(0, i), key: v.slice(i + 1) };
}

export function randomBucket(): number {
  return Math.floor(Math.random() * BUCKET_MAX);
}

/** Cookie value → bucket, or null when missing or tampered. */
export function bucketFromCookie(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,5}$/.test(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < BUCKET_MAX ? n : null;
}
