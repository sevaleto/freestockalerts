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
}

export async function sendAlertEmail(input: SendAlertEmailInput) {
  // TODO: Replace mock send with live Resend integration.
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");

  return resend.emails.send({
    from: "FreeStockAlerts <alerts@freestockalerts.ai>",
    to: input.to,
    subject: `🔔 ${input.ticker} Alert: ${input.alertType}`,
    react: AlertEmail({
      ...input,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    }),
  });
}
