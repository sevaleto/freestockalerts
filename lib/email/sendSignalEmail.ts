import { Resend } from "resend";
import { SignalEmail } from "@/lib/email/signalEmail";
import { maxScoreFor, signalRows, signalSource, signalSubject, type SignalLike } from "@/lib/strategies/present";

interface SendSignalEmailInput {
  to: string;
  strategyName: string;
  signal: SignalLike;
}

export async function sendSignalEmail({ to, strategyName, signal }: SendSignalEmailInput) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from =
    process.env.RESEND_FROM ??
    (process.env.NODE_ENV === "production" ? "FreeStockAlerts <alerts@freestockalerts.ai>" : "FreeStockAlerts <onboarding@resend.dev>");
  const subject = signalSubject(signal);
  return resend.emails.send({
    from,
    to,
    subject: `🔔 ${subject}`,
    react: SignalEmail({
      strategyName,
      strategySlug: signal.strategySlug,
      symbol: signal.symbol,
      subject,
      explanation: signal.explanation,
      rows: signalRows(signal),
      score: signal.score,
      maxScore: maxScoreFor(signal.strategySlug),
      sourceLine: signalSource(signal),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    }),
  });
}
