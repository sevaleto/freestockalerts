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

interface QuoteData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  dayChangePercent?: number;
  volume?: number;
  avgVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

function evaluateSingleAlert(
  alert: AlertToEvaluate,
  quote: QuoteData
): AlertEvaluationResult {
  const { alertType, triggerValue } = alert;
  const price = quote.price;

  switch (alertType) {
    case "PRICE_ABOVE": {
      const triggered = price > triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Price $${price} is above $${triggerValue}`
          : "No trigger",
      };
    }

    case "PRICE_BELOW": {
      const triggered = price < triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Price $${price} is below $${triggerValue}`
          : "No trigger",
      };
    }

    case "PRICE_RECOVERY": {
      // Same logic as PRICE_ABOVE — price recovered above a threshold
      const triggered = price > triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Price recovered to $${price} (above $${triggerValue})`
          : "No trigger",
      };
    }

    case "PERCENT_CHANGE_DAY": {
      const dayChangePercent =
        quote.dayChangePercent ?? quote.changePercent ?? 0;
      const absChange = Math.abs(dayChangePercent);
      const triggered = absChange >= triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Day change ${dayChangePercent.toFixed(2)}% exceeds ±${triggerValue}%`
          : "No trigger",
      };
    }

    case "VOLUME_SPIKE": {
      const volume = quote.volume ?? 0;
      const avgVolume = quote.avgVolume ?? 0;
      if (avgVolume === 0) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: "Average volume data unavailable",
        };
      }
      const ratio = volume / avgVolume;
      const triggered = ratio >= triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Volume spike ${ratio.toFixed(1)}x (threshold: ${triggerValue}x)`
          : "No trigger",
      };
    }

    case "FIFTY_TWO_WEEK_HIGH": {
      const yearHigh = quote.fiftyTwoWeekHigh ?? 0;
      if (yearHigh === 0) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: "52-week high data unavailable",
        };
      }
      const triggered = price >= yearHigh;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Price $${price} reached 52-week high ($${yearHigh})`
          : "No trigger",
      };
    }

    case "FIFTY_TWO_WEEK_LOW": {
      const yearLow = quote.fiftyTwoWeekLow ?? 0;
      if (yearLow === 0) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: "52-week low data unavailable",
        };
      }
      const triggered = price <= yearLow;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Price $${price} reached 52-week low ($${yearLow})`
          : "No trigger",
      };
    }

    case "RSI_OVERBOUGHT":
    case "RSI_OVERSOLD": {
      // RSI data not available from FMP quote endpoint — skip to avoid false triggers
      return {
        alertId: alert.id,
        triggered: false,
        priceAtTrigger: price,
        reason: "RSI data not available — skipped",
      };
    }

    case "SMA_CROSS_ABOVE":
    case "SMA_CROSS_BELOW": {
      // SMA data not available from FMP quote endpoint — skip to avoid false triggers
      return {
        alertId: alert.id,
        triggered: false,
        priceAtTrigger: price,
        reason: "SMA data not available — skipped",
      };
    }

    case "EARNINGS_REMINDER": {
      // Needs earnings calendar integration — skip for now
      return {
        alertId: alert.id,
        triggered: false,
        priceAtTrigger: price,
        reason: "Earnings reminder — not yet implemented",
      };
    }

    case "PERCENT_CHANGE_CUSTOM": {
      // Similar to PERCENT_CHANGE_DAY but custom period — use day change as fallback
      const dayChangePercent =
        quote.dayChangePercent ?? quote.changePercent ?? 0;
      const absChange = Math.abs(dayChangePercent);
      const triggered = absChange >= triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Change ${dayChangePercent.toFixed(2)}% exceeds ±${triggerValue}%`
          : "No trigger",
      };
    }

    default: {
      // Unknown alert type — never false-trigger
      return {
        alertId: alert.id,
        triggered: false,
        priceAtTrigger: price,
        reason: `Unknown alert type: ${alertType}`,
      };
    }
  }
}

export const evaluateAlerts = async (
  alerts: AlertToEvaluate[]
): Promise<AlertEvaluationResult[]> => {
  const tickers = Array.from(new Set(alerts.map((alert) => alert.ticker)));
  const quotes = await getBatchQuotes(tickers);
  const quoteMap = new Map(
    quotes.map((quote: any) => [quote.ticker, quote])
  );

  return alerts.map((alert) => {
    const quote = quoteMap.get(alert.ticker) as QuoteData | undefined;
    if (!quote) {
      return {
        alertId: alert.id,
        triggered: false,
        reason: "Quote missing",
      };
    }
    return evaluateSingleAlert(alert, quote);
  });
};
