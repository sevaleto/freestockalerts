import type { EmailStatus, Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { addContactToAudience, unsubscribeContact } from "@/lib/email/audience";
import { oversightEnabled, statusFromOversight, validateWithOversight } from "@/lib/email/oversight";

/**
 * Where a lead's deliverability verdict lives and what it unlocks.
 *
 *   PENDING ──Email Oversight──▶ VALID / ACCEPT_ALL / RISKY / INVALID / SUPPRESSED
 *   any (except SUPPRESSED) ──magic link clicked / Google──▶ VALID
 *   any ──Resend complaint──▶ SUPPRESSED      any ──Resend hard bounce──▶ INVALID
 *
 * Gates:
 *   Resend audience (broadcasts)  VALID, ACCEPT_ALL
 *   Newsletter export             VALID, ACCEPT_ALL
 *   Lead sharing                  VALID only
 */

export const MAX_CHECK_ATTEMPTS = 3;
export const AUDIENCE_ELIGIBLE: readonly EmailStatus[] = ["VALID", "ACCEPT_ALL"];
export const NEWSLETTER_ELIGIBLE: readonly EmailStatus[] = ["VALID", "ACCEPT_ALL"];
export const LEAD_SHARE_ELIGIBLE: readonly EmailStatus[] = ["VALID"];

export type LeadPurpose = "newsletter" | "lead-share";

export function isAudienceEligible(status: EmailStatus): boolean {
  return AUDIENCE_ELIGIBLE.includes(status);
}

/** Prisma filter for every export that leaves the building. */
export function leadWhere(purpose: LeadPurpose): Prisma.UserWhereInput {
  const statuses = purpose === "lead-share" ? LEAD_SHARE_ELIGIBLE : NEWSLETTER_ELIGIBLE;
  return { emailStatus: { in: [...statuses] }, unsubscribedFromBlasts: false };
}

type AudienceUser = Pick<User, "id" | "email" | "firstName" | "resendContactId" | "unsubscribedFromBlasts" | "emailStatus">;

/**
 * Put the user on the Resend broadcast audience if their address is mailable
 * and they aren't already there (or unsubscribed). Never throws.
 */
export async function ensureOnAudience(user: AudienceUser): Promise<string | null> {
  if (user.resendContactId || user.unsubscribedFromBlasts) return user.resendContactId;
  if (!isAudienceEligible(user.emailStatus)) return null;
  const contactId = await addContactToAudience(user.email, user.firstName);
  if (contactId) {
    await prisma.user
      .update({ where: { id: user.id }, data: { resendContactId: contactId } })
      .catch((err) => console.error("[audience] failed to store contact id:", err));
  }
  return contactId;
}

/** Drop a user from broadcasts in Resend (keeps the contact id so we never re-add). */
async function dropFromAudience(user: Pick<User, "resendContactId">) {
  if (user.resendContactId) await unsubscribeContact(user.resendContactId);
}

/**
 * The user proved the inbox exists (clicked the magic link, entered the code,
 * or signed in with Google). Overrides every verdict except SUPPRESSED.
 */
export async function markEmailConfirmed(userId: string, via: "magic-link" | "google"): Promise<User | null> {
  const now = new Date();
  const res = await prisma.user.updateMany({
    where: { id: userId, emailStatus: { not: "SUPPRESSED" } },
    data: { emailStatus: "VALID", emailVerdict: via, emailCheckedAt: now },
  });
  if (res.count === 0) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

/** Resend told us the address complained (SUPPRESSED) or hard-bounced (INVALID). */
export async function markEmailFromResend(email: string, event: "complaint" | "bounce"): Promise<number> {
  const status: EmailStatus = event === "complaint" ? "SUPPRESSED" : "INVALID";
  const res = await prisma.user.updateMany({
    where: { email: email.trim().toLowerCase(), ...(event === "bounce" ? { emailStatus: { not: "SUPPRESSED" } } : {}) },
    data: { emailStatus: status, emailVerdict: event, emailCheckedAt: new Date(), unsubscribedFromBlasts: true },
  });
  return res.count;
}

let warnedNotConfigured = false;

export interface VerifyOutcome {
  status: EmailStatus;
  verdict: string | null;
  changed: boolean;
}

/**
 * Ask Email Oversight about a PENDING user and store the verdict.
 * Safe to call repeatedly: confirmed / suppressed / already-decided users are
 * skipped, and a verdict never overwrites a confirmation that raced ahead.
 */
export async function verifyUserEmail(userId: string): Promise<VerifyOutcome | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.emailStatus !== "PENDING") {
    return { status: user.emailStatus, verdict: user.emailVerdict, changed: false };
  }
  if (user.emailVerified) {
    const confirmed = await markEmailConfirmed(user.id, "magic-link");
    if (confirmed) await ensureOnAudience(confirmed);
    return { status: "VALID", verdict: "magic-link", changed: true };
  }
  if (!oversightEnabled()) {
    if (!warnedNotConfigured) {
      console.warn("[verify] EMAIL_OVERSIGHT_API_TOKEN / EMAIL_OVERSIGHT_LIST_ID not set; addresses stay PENDING");
      warnedNotConfigured = true;
    }
    return { status: "PENDING", verdict: null, changed: false };
  }

  const attempts = user.emailCheckAttempts + 1;
  const verdict = await validateWithOversight(user.email);
  const now = new Date();

  if (!verdict) {
    await prisma.user.update({ where: { id: user.id }, data: { emailCheckAttempts: attempts, emailCheckedAt: now } });
    return { status: "PENDING", verdict: null, changed: false };
  }

  const mapped = statusFromOversight(verdict.resultId);
  let status = mapped.status;
  const retry = mapped.retry;
  let verdictLabel = verdict.result || `ResultId ${verdict.resultId}`;
  if (retry && attempts >= MAX_CHECK_ATTEMPTS && verdict.resultId !== 12) {
    status = "RISKY"; // gave up: treat as unknown-but-not-proven
    verdictLabel = `${verdictLabel} (after ${attempts} attempts)`;
  }

  // Only write while still PENDING so a magic-link confirmation that landed
  // in the meantime keeps its VALID status.
  const res = await prisma.user.updateMany({
    where: { id: user.id, emailStatus: "PENDING" },
    data: { emailStatus: status, emailVerdict: status === "PENDING" ? user.emailVerdict : verdictLabel, emailCheckedAt: now, emailCheckAttempts: attempts },
  });
  if (res.count === 0) {
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    return { status: fresh?.emailStatus ?? "VALID", verdict: fresh?.emailVerdict ?? null, changed: false };
  }
  console.log(`[verify] ${user.email}: ${verdictLabel} → ${status}`);

  if (isAudienceEligible(status)) {
    await ensureOnAudience({ ...user, emailStatus: status });
  } else if (status === "INVALID" || status === "SUPPRESSED") {
    await dropFromAudience(user);
    if (status === "SUPPRESSED") {
      await prisma.user.update({ where: { id: user.id }, data: { unsubscribedFromBlasts: true } }).catch(() => {});
    }
  }
  return { status, verdict: verdictLabel, changed: status !== "PENDING" };
}

/** Batch used by the cron and the backfill script. */
export async function verifyPendingEmails(limit = 50, olderThanMs = 2 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const users = await prisma.user.findMany({
    where: {
      emailStatus: "PENDING",
      createdAt: { lt: cutoff },
      OR: [{ emailCheckedAt: null }, { emailCheckedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }],
      emailCheckAttempts: { lt: MAX_CHECK_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, email: true },
  });
  const results: Array<{ email: string; status: EmailStatus; verdict: string | null }> = [];
  for (const u of users) {
    const out = await verifyUserEmail(u.id);
    if (out) results.push({ email: u.email, status: out.status, verdict: out.verdict });
  }
  return results;
}
