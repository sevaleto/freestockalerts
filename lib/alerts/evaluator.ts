import { getBatchQuotes } from "@/lib/api/quotes";

export interface AlertToEvaluate {
  id: string;
  ticker: string;
  alertType: string;
  triggerValue: number;
  triggerDirection: "ABOVE" | "BELOW" | "BOTH";
  cooldownMinutes: number;
  lastCheckedAt?: string;
  lastTriggeredAt?: string;
}

export interface AlertEvaluationResult {
  alertId: string;
  triggered: boolean;
  priceAtTrigger?: number;
  reason?: string;
}

export const evaluateAlerts = async (alerts: AlertToEvaluate[]) => {
  // TODO: Replace with full evaluation logic across alert types.
  const tickers = Array.from(new Set(alerts.map((alert) => alert.ticker)));
  const quotes = await getBatchQuotes(tickers);
  const quoteMap = new Map(quotes.map((quote: any) => [quote.ticker, quote]));

  return alerts.map((alert) => {
    const quote = quoteMap.get(alert.ticker) as { ticker: string; price: number; change: number; changePercent: number; volume: number } | undefined;
    if (!quote) {
      return { alertId: alert.id, triggered: false, reason: "Quote missing" };
    }

    const triggered =
      alert.triggerDirection === "ABOVE"
        ? quote.price > alert.triggerValue
        : alert.triggerDirection === "BELOW"
          ? quote.price < alert.triggerValue
          : quote.price !== alert.triggerValue;

    return {
      alertId: alert.id,
      triggered,
      priceAtTrigger: quote.price,
      reason: triggered ? "Threshold crossed" : "No trigger",
    } satisfies AlertEvaluationResult;
  });
};
