import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/lib/alerts/evaluator";
import { getBatchQuotes } from "@/lib/api/quotes";
import { prisma } from "@/lib/prisma/client";
import { sendAlertEmail } from "@/lib/email/sendAlertEmail";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

async function generateSummary(
  ticker: string,
  alertType: string,
  triggerValue: number,
  currentPrice: number,
  dayChange?: number,
  dayChangePercent?: number
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are a concise stock alert analyst. Write a 1-2 sentence summary explaining why this price movement matters. Be specific and actionable. No disclaimers.",
        },
        {
          role: "user",
          content: `Stock: ${ticker}\nAlert type: ${alertType}\nTrigger: $${triggerValue}\nCurrent: $${currentPrice}${dayChange !== undefined ? `\nDay change: ${dayChange > 0 ? "+" : ""}$${dayChange} (${dayChangePercent ?? 0}%)` : ""}\n\nBrief summary:`,
        },
      ],
    });
    return (
      completion.choices[0]?.message?.content?.trim() ??
      `${ticker} crossed $${triggerValue}, now at $${currentPrice}.`
    );
  } catch {
    return `${ticker} crossed $${triggerValue}, now trading at $${currentPrice}. Monitor for follow-through.`;
  }
}

// Vercel crons send GET requests
export async function GET() {
  return runAlertCheck();
}

export async function POST() {
  return runAlertCheck();
}

async function runAlertCheck() {
  const alerts = await prisma.alert.findMany({
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      ticker: true,
      alertType: true,
      triggerValue: true,
      triggerDirection: true,
      cooldownMinutes: true,
      triggeredAt: true,
    },
  });

  if (alerts.length === 0) {
    return NextResponse.json({ message: "No active alerts", results: [], updates: 0 });
  }

  const now = new Date();
  const results = await evaluateAlerts(
    alerts.map((alert) => ({
      id: alert.id,
      ticker: alert.ticker,
      alertType: alert.alertType,
      triggerValue: alert.triggerValue,
      triggerDirection: alert.triggerDirection,
      cooldownMinutes: alert.cooldownMinutes,
      lastTriggeredAt: alert.triggeredAt?.toISOString(),
    }))
  );

  // Get quotes for email data
  const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
  const quotes = await getBatchQuotes(tickers);
  const quoteMap = new Map(quotes.map((q: any) => [q.ticker, q]));

  const normalizedResults = results.map((result) => {
    const alert = alerts.find((item) => item.id === result.alertId);
    if (!alert) return result;

    const cooldownActive =
      alert.triggeredAt &&
      alert.cooldownMinutes > 0 &&
      now.getTime() - alert.triggeredAt.getTime() < alert.cooldownMinutes * 60 * 1000;

    if (cooldownActive && result.triggered) {
      return { ...result, triggered: false, reason: "Cooldown active" };
    }

    return result;
  });

  let emailsSent = 0;

  const operations = await Promise.all(
    normalizedResults.map(async (result) => {
      const alert = alerts.find((item) => item.id === result.alertId);
      if (!alert) return null;

      if (result.triggered && result.priceAtTrigger !== undefined) {
        const quote = quoteMap.get(alert.ticker) as any;

        // Generate AI summary
        const aiSummary = await generateSummary(
          alert.ticker,
          alert.alertType,
          alert.triggerValue,
          result.priceAtTrigger,
          quote?.change,
          quote?.changePercent
        );

        // Get user email for notification
        const user = await prisma.user.findUnique({
          where: { id: alert.userId },
          select: { email: true },
        });

        // Send email notification
        if (user?.email) {
          try {
            await sendAlertEmail({
              to: user.email,
              ticker: alert.ticker,
              alertType: alert.alertType,
              currentPrice: `$${result.priceAtTrigger.toFixed(2)}`,
              triggerPrice: `$${alert.triggerValue.toFixed(2)}`,
              dayChange: quote ? `${quote.change > 0 ? "+" : ""}${quote.change?.toFixed(2) ?? "0.00"}` : "N/A",
              volume: quote?.volume?.toLocaleString() ?? "N/A",
              aiSummary,
            });
            emailsSent++;
          } catch (err) {
            console.error(`Failed to send email for alert ${alert.id}:`, err);
          }
        }

        // Update DB
        return prisma.$transaction([
          prisma.alert.update({
            where: { id: alert.id },
            data: {
              isTriggered: true,
              triggeredAt: now,
              currentPrice: result.priceAtTrigger,
              lastCheckedAt: now,
            },
          }),
          prisma.alertHistory.create({
            data: {
              alertId: alert.id,
              priceAtTrigger: result.priceAtTrigger,
              aiSummary,
            },
          }),
        ]);
      }

      return prisma.alert.update({
        where: { id: alert.id },
        data: { lastCheckedAt: now },
      });
    })
  );

  const completed = operations.filter(Boolean).length;

  return NextResponse.json({
    message: "Alert check completed",
    results: normalizedResults,
    updates: completed,
    emailsSent,
  });
}
