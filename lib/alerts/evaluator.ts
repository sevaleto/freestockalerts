import { getBatchQuotes } from "@/lib/api/quotes";
import {
  fetchFmpNextEarningsDate,
  fetchFmpRsi,
  fetchFmpSma,
  type RsiSnapshot,
  type SmaSnapshot,
} from "@/lib/api/fmp";

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
  sma50?: number;
  sma200?: number;
}

/** Per-ticker technical/event data fetched only when an alert needs it. */
export interface IndicatorData {
  rsi?: RsiSnapshot | null;
  sma: Map<number, SmaSnapshot | null>;
  nextEarningsDate?: string | null;
}

/**
 * Alert types that describe a single event (a threshold cross, an indicator
 * crossing a level, an upcoming earnings date). These deactivate after they
 * fire so the user gets one notification, not one every cooldown window.
 * Recurring-condition types (daily % move, volume spike) stay active and are
 * throttled by cooldownMinutes instead.
 */
export const ONE_SHOT_ALERT_TYPES = [
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "PRICE_RECOVERY",
  "FIFTY_TWO_WEEK_HIGH",
  "FIFTY_TWO_WEEK_LOW",
  "RSI_OVERBOUGHT",
  "RSI_OVERSOLD",
  "SMA_CROSS_ABOVE",
  "SMA_CROSS_BELOW",
  "EARNINGS_REMINDER",
] as const;

const RSI_TYPES = new Set(["RSI_OVERBOUGHT", "RSI_OVERSOLD"]);
const SMA_TYPES = new Set(["SMA_CROSS_ABOVE", "SMA_CROSS_BELOW"]);
const EARNINGS_TYPES = new Set(["EARNINGS_REMINDER"]);

const RSI_PERIOD = 14;
const INDICATOR_CONCURRENCY = 5;
const MARKET_TIMEZONE = "America/New_York";

const emptyIndicators = (): IndicatorData => ({ sma: new Map() });

/** Calendar days from "today" (in US market time) until a YYYY-MM-DD date. */
const daysUntil = (dateKey: string, now: Date): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  const et = new Date(now.toLocaleString("en-US", { timeZone: MARKET_TIMEZONE }));
  const today = Date.UTC(et.getFullYear(), et.getMonth(), et.getDate());
  return Math.round((target - today) / 86_400_000);
};

function evaluateSingleAlert(
  alert: AlertToEvaluate,
  quote: QuoteData,
  indicators: IndicatorData
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
      const rsi = indicators.rsi?.rsi;
      if (rsi === undefined) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: "RSI data unavailable — skipped",
        };
      }
      const overbought = alertType === "RSI_OVERBOUGHT";
      const triggered = overbought ? rsi >= triggerValue : rsi <= triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `RSI(${RSI_PERIOD}) ${rsi.toFixed(1)} is ${overbought ? "at or above" : "at or below"} ${triggerValue}`
          : `RSI(${RSI_PERIOD}) ${rsi.toFixed(1)} — no trigger`,
      };
    }

    case "SMA_CROSS_ABOVE":
    case "SMA_CROSS_BELOW": {
      // triggerValue holds the SMA period (20 / 50 / 100 / 200).
      const period = Math.round(triggerValue);
      const snapshot = indicators.sma.get(period);
      if (!snapshot) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: `SMA(${period}) data unavailable — skipped`,
        };
      }
      const { sma, previousClose, previousSma } = snapshot;
      const above = alertType === "SMA_CROSS_ABOVE";

      // A "cross" means the prior session was on the other side of the SMA.
      // When prior-day data is missing, fall back to the standing condition.
      const havePrior = previousClose !== undefined && previousSma !== undefined;
      const wasOnOtherSide = havePrior
        ? above
          ? previousClose! <= previousSma!
          : previousClose! >= previousSma!
        : true;
      const isNowOnTargetSide = above ? price > sma : price < sma;
      const triggered = isNowOnTargetSide && wasOnOtherSide;

      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Price $${price} crossed ${above ? "above" : "below"} the ${period}-day SMA ($${sma.toFixed(2)})`
          : `Price $${price} vs ${period}-day SMA $${sma.toFixed(2)} — no cross`,
      };
    }

    case "EARNINGS_REMINDER": {
      // triggerValue holds "days before earnings" (1 / 3 / 5 / 7 / 14).
      const next = indicators.nextEarningsDate;
      if (!next) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: "No upcoming earnings date on the calendar — skipped",
        };
      }
      const days = daysUntil(next, new Date());
      if (days === null) {
        return {
          alertId: alert.id,
          triggered: false,
          priceAtTrigger: price,
          reason: `Unparseable earnings date "${next}" — skipped`,
        };
      }
      const triggered = days >= 0 && days <= triggerValue;
      return {
        alertId: alert.id,
        triggered,
        priceAtTrigger: price,
        reason: triggered
          ? `Earnings on ${next} — ${days} day${days === 1 ? "" : "s"} away (reminder set for ${triggerValue} days)`
          : `Earnings on ${next} — ${days} days away`,
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

/** Run `fn` over `items` with a bounded number of in-flight promises. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<Array<R | null>> {
  const out: Array<R | null> = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const [j, r] of settled.entries()) {
      if (r.status === "fulfilled") {
        out.push(r.value);
      } else {
        console.warn(
          `[evaluator] indicator fetch failed for ${String(batch[j])}:`,
          r.reason instanceof Error ? r.reason.message : r.reason
        );
        out.push(null);
      }
    }
  }
  return out;
}

/**
 * Fetch only the indicator data the given alerts actually need
 * (one RSI call per ticker with RSI alerts, one SMA call per ticker+period,
 * one earnings-calendar call per ticker with an earnings reminder).
 */
export async function loadIndicators(
  alerts: AlertToEvaluate[]
): Promise<Map<string, IndicatorData>> {
  const indicators = new Map<string, IndicatorData>();
  const get = (ticker: string) => {
    let entry = indicators.get(ticker);
    if (!entry) {
      entry = emptyIndicators();
      indicators.set(ticker, entry);
    }
    return entry;
  };

  const rsiTickers = new Set<string>();
  const smaNeeds = new Map<string, Set<number>>();
  const earningsTickers = new Set<string>();

  for (const alert of alerts) {
    const ticker = alert.ticker.trim().toUpperCase();
    if (RSI_TYPES.has(alert.alertType)) rsiTickers.add(ticker);
    if (SMA_TYPES.has(alert.alertType)) {
      const period = Math.round(alert.triggerValue);
      if (period > 0) {
        if (!smaNeeds.has(ticker)) smaNeeds.set(ticker, new Set());
        smaNeeds.get(ticker)!.add(period);
      }
    }
    if (EARNINGS_TYPES.has(alert.alertType)) earningsTickers.add(ticker);
  }

  const rsiList = Array.from(rsiTickers);
  const rsiResults = await mapWithConcurrency(rsiList, INDICATOR_CONCURRENCY, (t) =>
    fetchFmpRsi(t, RSI_PERIOD)
  );
  rsiList.forEach((t, i) => {
    get(t).rsi = rsiResults[i] ?? null;
  });

  const smaList: Array<{ ticker: string; period: number }> = [];
  for (const [ticker, periods] of smaNeeds) {
    for (const period of periods) smaList.push({ ticker, period });
  }
  const smaResults = await mapWithConcurrency(smaList, INDICATOR_CONCURRENCY, (item) =>
    fetchFmpSma(item.ticker, item.period)
  );
  smaList.forEach((item, i) => {
    get(item.ticker).sma.set(item.period, smaResults[i] ?? null);
  });

  const earningsList = Array.from(earningsTickers);
  const earningsResults = await mapWithConcurrency(
    earningsList,
    INDICATOR_CONCURRENCY,
    (t) => fetchFmpNextEarningsDate(t)
  );
  earningsList.forEach((t, i) => {
    get(t).nextEarningsDate = earningsResults[i] ?? null;
  });

  return indicators;
}

export const evaluateAlerts = async (
  alerts: AlertToEvaluate[]
): Promise<AlertEvaluationResult[]> => {
  const tickers = Array.from(new Set(alerts.map((alert) => alert.ticker)));
  // skipMock: true — never evaluate alerts against stale mock/fallback data
  const [quotes, indicators] = await Promise.all([
    getBatchQuotes(tickers, { skipMock: true }),
    loadIndicators(alerts),
  ]);
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
    const ticker = alert.ticker.trim().toUpperCase();
    return evaluateSingleAlert(
      alert,
      quote,
      indicators.get(ticker) ?? emptyIndicators()
    );
  });
};
