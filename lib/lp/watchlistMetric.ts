/**
 * "Distance to trigger" for a pending alert: how far the stock is from the
 * condition that would fire it. Honest by construction — a negative number
 * means "not there yet", and only a met condition is shown as positive.
 */
import type { DescribableItem } from "@/lib/alerts/describe";

export interface WatchlistQuote {
  price: number;
  changePercent: number;
  volume?: number;
  avgVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sma50?: number;
  sma200?: number;
  rsi?: number;
}

export interface WatchlistMetric {
  label: string;
  met: boolean;
}

const pct = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}%`;

export function watchlistMetric(item: DescribableItem, q: WatchlistQuote): WatchlistMetric | null {
  const v = item.triggerValue;
  switch (item.alertType) {
    case "FIFTY_TWO_WEEK_HIGH": {
      if (!q.fiftyTwoWeekHigh) return null;
      const d = q.price / q.fiftyTwoWeekHigh - 1;
      return d >= -0.0005 ? { label: "At 52-wk high", met: true } : { label: `${pct(d)} from 52-wk high`, met: false };
    }
    case "FIFTY_TWO_WEEK_LOW": {
      if (!q.fiftyTwoWeekLow) return null;
      const d = q.price / q.fiftyTwoWeekLow - 1;
      return d <= 0.0005 ? { label: "At 52-wk low", met: true } : { label: `${pct(d)} above 52-wk low`, met: false };
    }
    case "SMA_CROSS_ABOVE":
    case "SMA_CROSS_BELOW": {
      const period = Math.round(v);
      const sma = period === 50 ? q.sma50 : period === 200 ? q.sma200 : undefined;
      if (!sma) return null;
      const d = q.price / sma - 1;
      const met = item.alertType === "SMA_CROSS_ABOVE" ? d >= 0 : d <= 0;
      return { label: `${pct(d)} vs ${period}-day avg`, met };
    }
    case "RSI_OVERSOLD":
    case "RSI_OVERBOUGHT": {
      if (q.rsi === undefined) return null;
      const met = item.alertType === "RSI_OVERSOLD" ? q.rsi <= v : q.rsi >= v;
      return { label: `RSI ${q.rsi.toFixed(0)} (trigger ${v})`, met };
    }
    case "PRICE_ABOVE":
    case "PRICE_RECOVERY":
    case "PRICE_BELOW": {
      if (!v) return null;
      const d = q.price / v - 1;
      const met = item.alertType === "PRICE_BELOW" ? d <= 0 : d >= 0;
      return { label: `${pct(d)} vs $${v}`, met };
    }
    case "VOLUME_SPIKE": {
      if (!q.volume || !q.avgVolume) return null;
      const ratio = q.volume / q.avgVolume;
      return { label: `${ratio.toFixed(1)}x avg volume`, met: ratio >= v };
    }
    case "PERCENT_CHANGE_DAY":
    case "PERCENT_CHANGE_CUSTOM": {
      const d = q.changePercent;
      return { label: `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}% today`, met: Math.abs(d) >= v };
    }
    default:
      return null;
  }
}
