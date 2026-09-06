import type { User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma/client";
import { isLpSlug, type LpSlug } from "@/lib/lp/pages";
import type { Attribution } from "@/lib/tracking/attribution";

export type SignupSource =
  | "hero"
  | "final-cta"
  | "template-preview"
  | "inline-cta"
  | "login"
  | "google"
  | "unknown"
  | `lp:${LpSlug}`;

export const SIGNUP_SOURCES: readonly SignupSource[] = [
  "hero",
  "final-cta",
  "template-preview",
  "inline-cta",
  "login",
  "google",
  "unknown",
];

export const toSignupSource = (value: unknown): SignupSource => {
  if (typeof value !== "string") return "unknown";
  if ((SIGNUP_SOURCES as readonly string[]).includes(value)) return value as SignupSource;
  // Ad landing pages: "lp:<slug>" for a slug defined in lib/lp/pages.ts
  if (value.startsWith("lp:") && isLpSlug(value.slice(3))) return value as SignupSource;
  return "unknown";
};

interface UpsertInput {
  authUser: Pick<AuthUser, "id" | "email" | "email_confirmed_at" | "app_metadata">;
  abVariant?: string | null;
  source?: SignupSource;
  emailVerified?: boolean;
  lastLinkSentAt?: Date;
  /** First-touch UTM/fbclid from the page the lead converted on; written only when the row is created, so nobody can rewrite an existing account's cohort by re-submitting its email. */
  attribution?: Attribution | null;
}

const attributionColumns = (a: Attribution | null | undefined) =>
  a
    ? {
        utmSource: a.utmSource ?? null,
        utmMedium: a.utmMedium ?? null,
        utmCampaign: a.utmCampaign ?? null,
        utmTerm: a.utmTerm ?? null,
        utmContent: a.utmContent ?? null,
        fbclid: a.fbclid ?? null,
        landingPath: a.landingPath ?? null,
        referrer: a.referrer ?? null,
      }
    : {};

/**
 * Create or update the Prisma User for a Supabase auth user.
 *
 * Matches on auth id OR email so an older row created under a different id
 * (or a row created at form-submit time) is updated rather than colliding on
 * the unique email index. If the ids differ the row is re-keyed to the auth
 * id; every relation cascades on update.
 */
export async function upsertUserForAuth(input: UpsertInput) {
  const email = (input.authUser.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Auth user has no email");

  const variantTag = input.abVariant ? `hero_headline:${input.abVariant}` : null;
  const existing = await prisma.user.findFirst({
    where: { OR: [{ id: input.authUser.id }, { email }] },
  });

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        id: input.authUser.id,
        email,
        emailVerified: input.emailVerified ?? !!input.authUser.email_confirmed_at,
        signupVariant: variantTag,
        signupSource: input.source ?? null,
        lastLinkSentAt: input.lastLinkSentAt ?? null,
        ...attributionColumns(input.attribution),
      },
    });
    return { user: created, created: true };
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(existing.id !== input.authUser.id ? { id: input.authUser.id } : {}),
      email,
      ...(input.emailVerified ? { emailVerified: true } : {}),
      ...(variantTag && !existing.signupVariant ? { signupVariant: variantTag } : {}),
      ...(input.source && !existing.signupSource ? { signupSource: input.source } : {}),
      ...(input.lastLinkSentAt ? { lastLinkSentAt: input.lastLinkSentAt } : {}),
    },
  });
  return { user, created: false };
}

// Audience membership is gated on the deliverability verdict; see lib/email/verification.ts
export { ensureOnAudience } from "@/lib/email/verification";
