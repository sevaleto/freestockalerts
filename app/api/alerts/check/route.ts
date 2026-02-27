import { NextResponse } from "next/server";
import { mockAlerts } from "@/lib/mock/alerts";
import { evaluateAlerts } from "@/lib/alerts/evaluator";

export async function POST() {
  // TODO: Replace with cron evaluation logic, AI summary, and email sending.
  const results = await evaluateAlerts(
    mockAlerts.map((alert) => ({
      id: alert.id,
      ticker: alert.ticker,
      alertType: alert.alertType,
      triggerValue: alert.triggerValue,
      triggerDirection: alert.triggerDirection,
      cooldownMinutes: alert.cooldownMinutes,
    }))
  );

  return NextResponse.json({
    message: "Alert check completed (mock)",
    results,
  });
}
