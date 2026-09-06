/** The run report email (Resend), so a failed or flagged morning is visible without opening Beehiiv. */
import { Resend } from "resend";
import { NewsletterRunEmail } from "@/lib/email/newsletterRunEmail";
import type { BuildResult } from "./build";
import { reportRecipients } from "./config";
import { toMMDDYYYY } from "./dates";

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
