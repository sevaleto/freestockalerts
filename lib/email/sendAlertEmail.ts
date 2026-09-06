import { Resend } from "resend";
import { AlertEmail } from "@/lib/email/alertEmail";
import { serveEmailAd } from "@/lib/ads/serve";

interface SendAlertEmailInput {
  to: string;
  ticker: string;
  alertType: string;
  currentPrice: string;
  triggerPrice: string;
  dayChange: string;
  volume: string;
  aiSummary: string;
  /** Factual context lines (moving averages, volume vs average, sector vs SPY). */
  contextLines?: string[];
  /** AI-written context, one entry per paragraph. */
  contextParagraphs?: string[];
  /** Recipient's user id; identifies them on ad clicks. */
  userId?: string | null;
}

export async function sendAlertEmail(input: SendAlertEmailInput) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from =
    process.env.RESEND_FROM ??
    (process.env.NODE_ENV === "production"
      ? "FreeStockAlerts <alerts@freestockalerts.ai>"
      : "FreeStockAlerts <onboarding@resend.dev>");

  // One impression per email sent; null when no ad is active, and never throws.
  const ad = await serveEmailAd({ userId: input.userId });

  const { userId: _userId, ...emailProps } = input;
  void _userId;
  return resend.emails.send({
    from,
    to: input.to,
    subject: `🔔 ${input.ticker} Alert: ${input.alertType}`,
    react: AlertEmail({
      ...emailProps,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      adHtml: ad?.html ?? null,
    }),
  });
}
