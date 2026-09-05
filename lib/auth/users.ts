import type { User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma/client";
import { addContactToAudience } from "@/lib/email/audience";

export type SignupSource =
  | "hero"
  | "final-cta"
  | "template-preview"
  | "login"
  | "google"
  | "unknown";

export const SIGNUP_SOURCES: readonly SignupSource[] = [
  "hero",
  "final-cta",
  "template-preview",
  "login",
  "google",
  "unknown",
];

export const toSignupSource = (value: unknown): SignupSource =>
  (SIGNUP_SOURCES as readonly string[]).includes(String(value))
    ? (value as SignupSource)
    : "unknown";

interface UpsertInput {
  authUser: Pick<AuthUser, "id" | "email" | "email_confirmed_at" | "app_metadata">;
  abVariant?: string | null;
  source?: SignupSource;
  emailVerified?: boolean;
  lastLinkSentAt?: Date;
}

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
    return prisma.user.create({
      data: {
        id: input.authUser.id,
        email,
        emailVerified: input.emailVerified ?? !!input.authUser.email_confirmed_at,
        signupVariant: variantTag,
        signupSource: input.source ?? null,
        lastLinkSentAt: input.lastLinkSentAt ?? null,
      },
    });
  }

  return prisma.user.update({
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
}

/**
 * Put the user on the Resend broadcast audience if they aren't already
 * (and haven't unsubscribed). Awaited so the lead lands on the list even
 * on a short-lived serverless invocation. Never throws.
 */
export async function ensureOnAudience(user: {
  id: string;
  email: string;
  firstName: string | null;
  resendContactId: string | null;
  unsubscribedFromBlasts: boolean;
}) {
  if (user.resendContactId || user.unsubscribedFromBlasts) return user.resendContactId;
  const contactId = await addContactToAudience(user.email, user.firstName);
  if (contactId) {
    await prisma.user
      .update({ where: { id: user.id }, data: { resendContactId: contactId } })
      .catch((err) => console.error("[audience] failed to store contact id:", err));
  }
  return contactId;
}
