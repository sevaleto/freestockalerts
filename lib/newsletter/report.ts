/** The run report email (Resend), so a failed or flagged morning is visible without opening Beehiiv. */
import type { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { NewsletterRunEmail } from "@/lib/email/newsletterRunEmail";
import type { BuildResult, SlotResult } from "./build";
import { reportRecipients, type Slot } from "./config";
import { shiftDateKey, toMMDDYYYY, type DateKey } from "./dates";
import { IN_PROGRESS_MS } from "./build";

/** The day's issues as one result, from the rows, so a per-slot run can report on both slots. */
export async function dayResult(db: PrismaClient, dateKey: DateKey, extra: { warnings?: string[]; ms?: number; now?: Date } = {}): Promise<BuildResult> {
  const now = extra.now ?? new Date();
  const rows = await db.newsletterIssue.findMany({ where: { issueDate: dateKey }, orderBy: { slot: "asc" } });
  const slots: SlotResult[] = rows.map((r) => ({
    slot: r.slot as Slot,
    status: r.status === "pending" && now.getTime() - r.updatedAt.getTime() > IN_PROGRESS_MS ? "failed" : (r.status as SlotResult["status"]),
    ticker: r.ticker ?? undefined,
    companyName: r.companyName ?? undefined,
    headline: r.headline ?? undefined,
    subjectLine: r.subjectLine ?? undefined,
    beehiivPostId: r.beehiivPostId ?? undefined,
    beehiivPostUrl: r.beehiivPostUrl ?? undefined,
    adsFound: r.adsFound,
    tsiPostTitle: r.tsiPostTitle ?? undefined,
    tsiAdvertisers: r.tsiAdvertisers ?? undefined,
    reviewReason: r.reviewReason ?? undefined,
    error: r.error ?? (r.status === "pending" && now.getTime() - r.updatedAt.getTime() > IN_PROGRESS_MS ? "The build stopped before this issue finished (function time limit). Use Rebuild." : undefined),
    costUsd: r.costUsd,
  }));
  return { dateKey, tsiDateKey: shiftDateKey(dateKey, -1), paused: false, slots, warnings: extra.warnings ?? [], totalCostUsd: Math.round(slots.reduce((n, s) => n + s.costUsd, 0) * 1e6) / 1e6, ms: extra.ms ?? 0 };
}

export async function sendDayReport(db: PrismaClient, dateKey: DateKey, extra: { warnings?: string[]; ms?: number } = {}) {
  return sendRunReport(await dayResult(db, dateKey, extra));
}

export function reportSubject(result: BuildResult): string {
  if (result.paused) return `FSA drafts ${toMMDDYYYY(result.dateKey)}: builds are paused`;
  const ready = result.slots.filter((s) => s.status === "drafted");
  const flagged = result.slots.filter((s) => s.status === "needs_review" || s.status === "failed");
  const tickers = result.slots.map((s) => s.ticker).filter(Boolean).join(", ");
  if (flagged.length) return `ACTION NEEDED: FSA drafts ${toMMDDYYYY(result.dateKey)} — ${flagged.length} flagged${tickers ? ` (${tickers})` : ""}`;
  if (!ready.length && result.slots.every((s) => s.skipped)) return `FSA drafts ${toMMDDYYYY(result.dateKey)}: already built`;
  return `FSA drafts ${toMMDDYYYY(result.dateKey)}: ${tickers} — ${ready.length} ready`;
}

export async function sendRunReport(result: BuildResult, opts: { to?: string[]; appUrl?: string } = {}): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { sent: false, error: "RESEND_API_KEY not set" };
  const to = opts.to ?? reportRecipients();
  if (!to.length) return { sent: false, error: "no recipients" };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? (process.env.NODE_ENV === "production" ? "FreeStockAlerts <alerts@freestockalerts.ai>" : "FreeStockAlerts <onboarding@resend.dev>");
  const appUrl = opts.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.freestockalerts.ai";
  try {
    const res = await resend.emails.send({ from, to, subject: reportSubject(result), react: NewsletterRunEmail({ result, adminUrl: `${appUrl}/admin/issues` }) });
    if (res.error) return { sent: false, error: res.error.message };
    return { sent: true, id: res.data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
