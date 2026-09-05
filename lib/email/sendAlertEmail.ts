import { Resend } from "resend";
import { AlertEmail } from "@/lib/email/alertEmail";

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
}

export async function sendAlertEmail(input: SendAlertEmailInput) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from =
    process.env.RESEND_FROM ??
    (process.env.NODE_ENV === "production"
      ? "FreeStockAlerts <alerts@freestockalerts.ai>"
      : "FreeStockAlerts <onboarding@resend.dev>");

  return resend.emails.send({
    from,
    to: input.to,
    subject: `🔔 ${input.ticker} Alert: ${input.alertType}`,
    react: AlertEmail({
      ...input,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    }),
  });
}
