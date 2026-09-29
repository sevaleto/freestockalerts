/**
 * Daily-timeframe technicals computed from one cached bars call per ticker:
 * RSI, SMA with the prior session for cross detection, average volume and
 * trailing closes. Replaces FMP's indicator and historical endpoints.
 */
import { fetchTdDailyBars, type DailyBarTD } from "@/lib/api/twelveData";
import { averageVolume, rsiSeries, sma } from "./indicators";

/** Enough history for SMA 200 plus the prior session, and for RSI smoothing to settle. */
const BAR_WINDOW = 260;
const AVG_VOLUME_SESSIONS = 30;

export interface RsiSnapshot {
  ticker: string;
  period: number;
  /** RSI on the newest bar (today's, still forming, during the session). */
  rsi: number;
  previousRsi?: number;
  date: string;
}

export interface SmaSnapshot {
  ticker: string;
  period: number;
  sma: number;
  close: number;
  /** Prior session's SMA and close, used to detect a cross rather than a standing condition. */
  previousSma?: number;
  previousClose?: number;
  date: string;
}

export function rsiSnapshotFromBars(ticker: string, bars: DailyBarTD[], period = 14): RsiSnapshot | null {
  const series = rsiSeries(bars.map((b) => b.close), period);
  const last = series[series.length - 1];
  if (last === null || last === undefined) return null;
  const prev = series[series.length - 2];
  return { ticker: ticker.toUpperCase(), period, rsi: last, previousRsi: prev ?? undefined, date: bars[bars.length - 1].date };
}

export function smaSnapshotFromBars(ticker: string, bars: DailyBarTD[], period: number): SmaSnapshot | null {
  const closes = bars.map((b) => b.close);
  const today = sma(closes, period);
  if (today === null) return null;
  const prior = sma(closes.slice(0, -1), period);
  return {
    ticker: ticker.toUpperCase(),
    period,
    sma: today,
    close: closes[closes.length - 1],
    previousSma: prior ?? undefined,
    previousClose: closes.length > 1 ? closes[closes.length - 2] : undefined,
    date: bars[bars.length - 1].date,
  };
}

/** New York calendar date, YYYY-MM-DD. */
const nyDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/**
 * Average of the last completed sessions. Today's forming bar is left out so a
 * volume spike is measured against normal days, not diluted by itself.
 */
export function avgVolumeFromBars(bars: DailyBarTD[], now = new Date(), sessions = AVG_VOLUME_SESSIONS): number | null {
  const today = nyDate(now);
  const completed = bars.length && bars[bars.length - 1].date === today ? bars.slice(0, -1) : bars;
  return averageVolume(completed.map((b) => b.volume), sessions);
}

export async function getRsi(ticker: string, period = 14): Promise<RsiSnapshot | null> {
  return rsiSnapshotFromBars(ticker, await fetchTdDailyBars(ticker, BAR_WINDOW), period);
}

export async function getSma(ticker: string, period: number): Promise<SmaSnapshot | null> {
  return smaSnapshotFromBars(ticker, await fetchTdDailyBars(ticker, BAR_WINDOW), period);
}

export async function getAvgVolume(ticker: string, now = new Date()): Promise<number | null> {
  return avgVolumeFromBars(await fetchTdDailyBars(ticker, BAR_WINDOW), now);
}

/** Daily closes, newest first (the order the relative-performance helpers expect). */
export async function getHistoricalCloses(ticker: string, sessions = 60): Promise<number[]> {
  const bars = await fetchTdDailyBars(ticker, BAR_WINDOW);
  return bars.slice(-sessions).map((b) => b.close).reverse();
}

/* ------------------------- post-close session volume ------------------------ */

/**
 * Twelve Data's intraday volume is a minority-venue sample (a few percent of
 * the market), while completed daily bars carry full-market volume. Volume
 * spikes are therefore judged once per session, after the close, on the
 * completed bar.
 */
const SESSION_SETTLE_MINUTES = 16 * 60 + 15; // 4:15 pm New York
/**
 * A completed bar whose volume is below this share of its 30-session average is
 * treated as not yet finalized (still the venue sample). Genuine full-market
 * volume essentially never falls this low; the venue sample always does.
 */
export const MIN_FULL_MARKET_SHARE = 0.15;

export interface SessionVolume {
  /** Session date, YYYY-MM-DD (New York). */
  date: string;
  volume: number;
  /** Average of the 30 completed sessions before this one. */
  avgVolume: number;
  ratio: number;
  close: number;
  previousClose?: number;
  /** False while the bar still looks like the venue sample; do not judge it yet. */
  finalized: boolean;
}

const nyParts = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { minutes: get("hour") * 60 + get("minute") };
};

/** The latest completed session in `bars` (oldest first) as of `now`, with its volume against the prior 30 sessions. */
export function lastSessionVolumeFromBars(bars: DailyBarTD[], now = new Date(), sessions = AVG_VOLUME_SESSIONS): SessionVolume | null {
  if (!bars.length) return null;
  const today = nyDate(now);
  let idx = bars.length - 1;
  if (bars[idx].date > today) idx--;
  if (idx >= 0 && bars[idx].date === today && nyParts(now).minutes < SESSION_SETTLE_MINUTES) idx--;
  if (idx < 1) return null;
  const avg = averageVolume(bars.slice(Math.max(0, idx - sessions), idx).map((b) => b.volume), sessions);
  const bar = bars[idx];
  if (!avg || !(bar.volume > 0)) return null;
  return {
    date: bar.date,
    volume: bar.volume,
    avgVolume: avg,
    ratio: bar.volume / avg,
    close: bar.close,
    previousClose: bars[idx - 1]?.close,
    finalized: bar.volume >= MIN_FULL_MARKET_SHARE * avg,
  };
}

export async function getLastSessionVolume(ticker: string, now = new Date()): Promise<SessionVolume | null> {
  return lastSessionVolumeFromBars(await fetchTdDailyBars(ticker, BAR_WINDOW), now);
}

/** 4:00 pm New York on `dateKey` as a UTC instant (handles daylight saving). */
export function sessionCloseUtc(dateKey: string): Date {
  for (const offset of ["-04:00", "-05:00"]) {
    const d = new Date(`${dateKey}T16:00:00${offset}`);
    if (nyParts(d).minutes === 16 * 60) return d;
  }
  return new Date(`${dateKey}T21:00:00Z`);
}
