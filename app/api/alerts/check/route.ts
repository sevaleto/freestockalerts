import { NextResponse } from "next/server";
import { evaluateAlerts, ONE_SHOT_ALERT_TYPES } from "@/lib/alerts/evaluator";
import { getBatchQuotes } from "@/lib/api/quotes";
import { prisma } from "@/lib/prisma/client";
import { sendAlertEmail } from "@/lib/email/sendAlertEmail";
import { isSameMarketDay } from "@/lib/utils/marketHours";
import { buildAlertContext } from "@/lib/alerts/context";
import { describeTrigger } from "@/lib/alerts/describe";
import { alertTypeOptions } from "@/lib/mock/alertTypes";
import { gatherAlertFacts, writeAlertContext } from "@/lib/ai/alertContext";

export const dynamic = "force-dynamic";

const humanAlertType = (alertType: string) => alertTypeOptions.find((o) => o.id === alertType)?.name ?? alertType.replace(/_/g, " ");

// Vercel crons send GET requests
export async function GET(request: Request) {
  return runAlertCheck(request);
}

export async function POST(request: Request) {
  return runAlertCheck(request);
}

/**
 * When CRON_SECRET is set in the environment, only requests carrying
 * `Authorization: Bearer <CRON_SECRET>` are accepted. Vercel attaches that
 * header to cron invocations automatically. When it is unset the route stays
 * open (legacy behaviour) so an unconfigured deploy keeps working.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
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

async function runAlertCheck(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?dryRun=1 — evaluate every active alert and report what WOULD fire,
  // without sending email, calling the model, or writing to the database.
  // Also bypasses the market-hours gate so it can be used any time.
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  if (!isMarketOpen() && !dryRun) {
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
      note: true,
      companyName: true,
      template: { select: { slug: true } },
    },
  });

  console.log(`[alert-check] Starting alert check at ${new Date().toISOString()} — ${alerts.length} active alerts${dryRun ? " (DRY RUN)" : ""}`);

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

    if (!result.triggered || !alert.triggeredAt) return result;

    // Recurring alerts (daily % move, volume spike) notify at most ONCE per
    // trading day. A stock that is up 2% stays up 2% all afternoon; the user
    // wants to hear about it once, not every five minutes.
    if (isSameMarketDay(alert.triggeredAt, now)) {
      return { ...result, triggered: false, reason: "Already notified today" };
    }

    // Belt-and-braces: honour any explicit cooldown as well.
    const cooldownActive =
      alert.cooldownMinutes > 0 &&
      now.getTime() - alert.triggeredAt.getTime() < alert.cooldownMinutes * 60 * 1000;
    if (cooldownActive) {
      return { ...result, triggered: false, reason: "Cooldown active" };
    }

    return result;
  });

  let emailsSent = 0;
  let emailsSkippedByPreference = 0;
  let emailsFailed = 0;

  const operations = await Promise.all(
    normalizedResults.map(async (result) => {
      const alert = alerts.find((item) => item.id === result.alertId);
      if (!alert) return null;

      if (result.triggered && result.priceAtTrigger !== undefined) {
        const quote = quoteMap.get(alert.ticker) as any;

        // Get user email + notification preference
        const user = await prisma.user.findUnique({
          where: { id: alert.userId },
          select: {
            email: true,
            preferences: { select: { emailAlerts: true } },
          },
        });
        const emailAllowed =
          !!user?.email && user.preferences?.emailAlerts !== false;

        if (dryRun) {
          return { dryRun: true, alertId: alert.id, wouldEmail: emailAllowed };
        }

        // Descriptive context (moving averages, volume vs average, sector vs SPY), then the
        // two-paragraph AI context written from gathered facts (news, analysts, earnings).
        const triggerText = describeTrigger({ ticker: alert.ticker, alertType: alert.alertType, triggerValue: alert.triggerValue, triggerDirection: alert.triggerDirection });
        const context = quote ? await buildAlertContext({ ...quote, ticker: alert.ticker }) : { lines: [] };
        const facts = await gatherAlertFacts({
          ticker: alert.ticker,
          companyName: quote?.companyName ?? alert.companyName,
          triggerText,
          quote: {
            price: result.priceAtTrigger,
            changePercent: quote?.changePercent,
            dayChange: quote?.change,
            volume: quote?.volume,
            sma50: quote?.sma50,
            sma200: quote?.sma200,
            fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote?.fiftyTwoWeekLow,
            marketCap: quote?.marketCap,
          },
          contextLines: context.lines,
          volumeRatio: context.volumeRatio,
          note: alert.note,
          strategySlug: alert.template?.slug ?? null,
          now,
        });
        const written = await writeAlertContext(facts);
        const aiSummary = written.text;

        // Send email notification (Resend returns { data, error } — it does
        // not throw on API errors, so check `error` explicitly).
        let emailSent = false;
        let emailSentAt: Date | null = null;
        if (emailAllowed) {
          try {
            const { error } = await sendAlertEmail({
              to: user!.email,
              userId: alert.userId,
              ticker: alert.ticker,
              alertType: humanAlertType(alert.alertType),
              currentPrice: `$${result.priceAtTrigger.toFixed(2)}`,
              triggerPrice: triggerText,
              dayChange: quote ? `${quote.change > 0 ? "+" : ""}${quote.change?.toFixed(2) ?? "0.00"}` : "N/A",
              volume: quote?.volume ? `${quote.volume.toLocaleString()}${context.volumeRatio ? ` (${context.volumeRatio.toFixed(1)}x avg)` : ""}` : "N/A",
              aiSummary,
              contextParagraphs: written.paragraphs,
              contextLines: context.lines,
            });
            if (error) {
              emailsFailed++;
              console.error(`[alert-check] Resend rejected email for alert ${alert.id}:`, error);
            } else {
              emailSent = true;
              emailSentAt = new Date();
              emailsSent++;
            }
          } catch (err) {
            emailsFailed++;
            console.error(`[alert-check] Failed to send email for alert ${alert.id}:`, err);
          }
        } else if (user?.email) {
          emailsSkippedByPreference++;
          console.log(`[alert-check] Email alerts disabled by user — skipping email for alert ${alert.id}`);
        }

        // Event-style alerts are ONE-SHOT: deactivate after triggering so
        // they don't fire repeatedly while the condition stays true.
        // User can re-enable (or edit) the alert for another notification.
        const shouldDeactivate = (ONE_SHOT_ALERT_TYPES as readonly string[]).includes(
          alert.alertType
        );

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
              emailSent,
              emailSentAt,
            },
          }),
        ]);
      }

      if (dryRun) return null;

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

  if (dryRun) {
    const wouldFire = normalizedResults.filter((r) => r.triggered);
    console.log(`[alert-check] DRY RUN complete: ${wouldFire.length} alert(s) would fire`);
    return NextResponse.json({
      message: "Dry run completed — nothing was sent or written",
      dryRun: true,
      checked: alerts.length,
      wouldFire: wouldFire.map((r) => {
        const alert = alerts.find((a) => a.id === r.alertId);
        return {
          alertId: r.alertId,
          ticker: alert?.ticker,
          alertType: alert?.alertType,
          triggerValue: alert?.triggerValue,
          priceAtTrigger: r.priceAtTrigger,
          reason: r.reason,
        };
      }),
      results: normalizedResults,
    });
  }

  console.log(`[alert-check] Done: ${completed} updates, ${emailsSent} emails sent, ${emailsFailed} failed, ${emailsSkippedByPreference} skipped by preference`);

  return NextResponse.json({
    message: "Alert check completed",
    results: normalizedResults,
    updates: completed,
    emailsSent,
    emailsFailed,
    emailsSkippedByPreference,
  });
}
