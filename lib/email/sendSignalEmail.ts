import { Resend } from "resend";
import { SignalEmail } from "@/lib/email/signalEmail";
import { serveEmailAd } from "@/lib/ads/serve";
import { maxScoreFor, signalAiContext, signalRows, signalSource, signalSubject, type SignalLike } from "@/lib/strategies/present";

interface SendSignalEmailInput {
  to: string;
  /** Recipient's user id; identifies them on ad clicks. */
  userId?: string | null;
  strategyName: string;
  signal: SignalLike;
}

export async function sendSignalEmail({ to, userId, strategyName, signal }: SendSignalEmailInput) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const from =
    process.env.RESEND_FROM ??
    (process.env.NODE_ENV === "production" ? "FreeStockAlerts <alerts@freestockalerts.ai>" : "FreeStockAlerts <onboarding@resend.dev>");
  const subject = signalSubject(signal);
  const ad = await serveEmailAd({ userId });
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
      contextParagraphs: signalAiContext(signal)?.paragraphs ?? [],
      adHtml: ad?.html ?? null,
    }),
  });
}
