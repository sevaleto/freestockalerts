import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/lib/alerts/evaluator";
import { prisma } from "@/lib/prisma/client";

export async function POST() {
  const alerts = await prisma.alert.findMany({
    where: { isActive: true },
    select: {
      id: true,
      ticker: true,
      alertType: true,
      triggerValue: true,
      triggerDirection: true,
      cooldownMinutes: true,
      triggeredAt: true,
    },
  });

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

  const operations = normalizedResults.map((result) => {
    const alert = alerts.find((item) => item.id === result.alertId);
    if (!alert) return null;

    if (result.triggered && result.priceAtTrigger !== undefined) {
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
            aiSummary: null,
          },
        }),
      ]);
    }

    return prisma.alert.update({
      where: { id: alert.id },
      data: { lastCheckedAt: now },
    });
  });

  const completed = await Promise.all(operations.filter(Boolean));

  return NextResponse.json({
    message: "Alert check completed",
    results: normalizedResults,
    updates: completed.length,
  });
}
