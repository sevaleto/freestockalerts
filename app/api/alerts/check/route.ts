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

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  // Skip weekends
  if (day === 0 || day === 6) return false;

  // Convert to ET (handles DST automatically)
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Market hours: 9:30 AM - 4:00 PM ET
  return totalMinutes >= 570 && totalMinutes < 960;
}

async function runAlertCheck() {
  if (!isMarketOpen()) {
    console.log(`[alert-check] Outside market hours — skipping`);
    return NextResponse.json({ message: "Outside market hours", results: [], updates: 0 });
  }

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

  console.log(`[alert-check] Starting alert check at ${new Date().toISOString()} — ${alerts.length} active alerts`);

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

  // Get quotes for email data (skipMock: true to avoid fake prices in emails)
  const tickers = Array.from(new Set(alerts.map((a) => a.ticker)));
  const quotes = await getBatchQuotes(tickers, { skipMock: true });
  const quoteMap = new Map(quotes.map((q: any) => [q.ticker, q]));

  console.log(`[alert-check] Fetched ${quotes.length} quotes for ${tickers.length} tickers: ${tickers.join(", ")}`);
  for (const q of quotes as any[]) {
    console.log(`[alert-check] ${q.ticker}: $${q.price} (change: ${q.change})`);
  }

  const triggeredCount = results.filter(r => r.triggered).length;
  console.log(`[alert-check] Evaluation complete: ${triggeredCount}/${results.length} triggered`);
  for (const r of results.filter(r => r.triggered)) {
    console.log(`[alert-check] TRIGGERED: alertId=${r.alertId} price=$${r.priceAtTrigger} reason="${r.reason}"`);
  }

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

        // Price-threshold alerts are ONE-SHOT: deactivate after triggering
        // so they don't fire repeatedly while the condition stays true.
        // User can re-enable or create a new alert if they want another notification.
        const ONE_SHOT_TYPES = [
          "PRICE_ABOVE", "PRICE_BELOW", "PRICE_RECOVERY",
          "FIFTY_TWO_WEEK_HIGH", "FIFTY_TWO_WEEK_LOW",
        ];
        const shouldDeactivate = ONE_SHOT_TYPES.includes(alert.alertType);

        // Update DB
        return prisma.$transaction([
          prisma.alert.update({
            where: { id: alert.id },
            data: {
              isTriggered: true,
              triggeredAt: now,
              currentPrice: result.priceAtTrigger,
              lastCheckedAt: now,
              ...(shouldDeactivate ? { isActive: false } : {}),
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

      const latestPrice = (quoteMap.get(alert.ticker) as any)?.price;
      return prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastCheckedAt: now,
          ...(latestPrice != null ? { currentPrice: latestPrice } : {}),
        },
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
