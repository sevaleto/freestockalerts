import { formatPrice } from "@/lib/utils/formatters";
import { alertTypeOptions } from "@/lib/mock/alertTypes";

export interface DescribableItem {
  ticker: string;
  companyName?: string | null;
  alertType: string;
  triggerValue: number;
  triggerDirection?: "ABOVE" | "BELOW" | "BOTH" | string;
  rationale?: string | null;
}

/**
 * Plain-English trigger for an alert or template item, e.g.
 * "drops below $58.00", "hits a new 52-week high", "RSI drops below 30".
 * Reads naturally after the ticker: "KO drops below $58.00".
 */
export function describeTrigger(item: DescribableItem): string {
  const v = item.triggerValue;
  switch (item.alertType) {
    case "PRICE_ABOVE":
      return `rises above ${formatPrice(v)}`;
    case "PRICE_BELOW":
      return `drops below ${formatPrice(v)}`;
    case "PRICE_RECOVERY":
      return `recovers above ${formatPrice(v)}`;
    case "PERCENT_CHANGE_DAY":
      return item.triggerDirection === "ABOVE"
        ? `gains ${v}% or more in a day`
        : item.triggerDirection === "BELOW"
          ? `drops ${v}% or more in a day`
          : `moves ${v}% or more in a day`;
    case "PERCENT_CHANGE_CUSTOM":
      return `moves ${v}% from today's price`;
    case "VOLUME_SPIKE":
      return `trades at ${v}x its average volume`;
    case "RSI_OVERBOUGHT":
      return `RSI rises above ${v}`;
    case "RSI_OVERSOLD":
      return `RSI drops below ${v}`;
    case "SMA_CROSS_ABOVE":
      return `crosses above its ${Math.round(v)}-day moving average`;
    case "SMA_CROSS_BELOW":
      return `crosses below its ${Math.round(v)}-day moving average`;
    case "FIFTY_TWO_WEEK_HIGH":
      return "hits a new 52-week high";
    case "FIFTY_TWO_WEEK_LOW":
      return "hits a new 52-week low";
    case "EARNINGS_REMINDER":
      return `${v} day${v === 1 ? "" : "s"} before earnings`;
    default: {
      const opt = alertTypeOptions.find((o) => o.id === item.alertType);
      return opt?.description ?? item.alertType.replace(/_/g, " ").toLowerCase();
    }
  }
}
