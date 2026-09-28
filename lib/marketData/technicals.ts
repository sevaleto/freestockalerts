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
