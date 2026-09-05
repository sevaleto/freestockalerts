/**
 * Price-action inputs shared by the event strategies: daily bars → the
 * numbers the confirmation rules look at. Pure; the scan feeds it data.
 */

export interface DailyBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteSnapshot {
  symbol: string;
  companyName: string;
  price: number;
  marketCap: number;
  volume: number;
  sma50: number | null;
  changePercent: number;
  asOf: string;
}

/** Average volume of the last N completed sessions, excluding today's partial bar when `today` is given. */
export function averageVolume(bars: DailyBar[], sessions: number, today?: string): number | null {
  const prior = bars.filter((b) => !today || b.date < today).slice(-sessions);
  if (prior.length < Math.min(sessions, 5)) return null;
  const sum = prior.reduce((a, b) => a + b.volume, 0);
  return sum / prior.length;
}

/** Highest close strictly after `afterDate` and before `today`. */
export function highestCloseSince(bars: DailyBar[], afterDate: string, today?: string): number | null {
  const window = bars.filter((b) => b.date > afterDate && (!today || b.date < today));
  if (window.length === 0) return null;
  return Math.max(...window.map((b) => b.close));
}

/** Highest close of the last N completed sessions before `today`. */
export function recentHigh(bars: DailyBar[], sessions: number, today?: string): number | null {
  const prior = bars.filter((b) => !today || b.date < today).slice(-sessions);
  if (prior.length === 0) return null;
  return Math.max(...prior.map((b) => b.close));
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export const daysAgo = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

export const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
