/**
 * Indicator math over daily bars. Pure functions, no I/O, so any provider's
 * bars give the same numbers and the alert logic never depends on a vendor's
 * indicator endpoint. Every input series is ordered oldest to newest.
 */

/** Mean of the last `period` values, or null when there are fewer. */
export function sma(values: number[], period: number): number | null {
  if (!Number.isInteger(period) || period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

/**
 * Wilder's RSI for every close, aligned to the input (null until enough
 * history). The first average is a simple mean of the first `period` changes;
 * after that each average is smoothed as (prev * (period - 1) + current) / period.
 */
export function rsiSeries(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = closes.map(() => null);
  if (!Number.isInteger(period) || period <= 0 || closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = toRsi(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

const toRsi = (avgGain: number, avgLoss: number) => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));

/** Rounded mean of the last `sessions` positive volumes, or null when none. */
export function averageVolume(volumes: number[], sessions: number): number | null {
  const recent = volumes.slice(-sessions).filter((v) => Number.isFinite(v) && v > 0);
  if (!recent.length) return null;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}
