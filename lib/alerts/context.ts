/**
 * Extra context attached to a triggered alert so the email says more than
 * "price crossed X": position against the 50- and 200-day averages, volume
 * against the 30-session average, and, for the sector ETFs, the last month's
 * performance against SPY with a plain reading of what the cross looks like.
 *
 * Everything here is descriptive. No line predicts what happens next.
 */
import { fetchFmpAvgVolume, fetchFmpHistoricalCloses } from "@/lib/api/fmp";

export interface ContextQuote {
  ticker: string;
  price: number;
  volume?: number;
  avgVolume?: number;
  sma50?: number;
  sma200?: number;
  fiftyTwoWeekHigh?: number;
}

export interface AlertContext {
  /** Short factual lines for the email and the AI prompt. */
  lines: string[];
  /** Volume / 30-session average when both are known. */
  volumeRatio?: number;
  aboveSma50?: boolean;
  aboveSma200?: boolean;
  /** ETF 21-session return minus SPY's, in percentage points. */
  relativeToSpyPts?: number;
}

export const SECTOR_ETFS = new Set(["XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC"]);
const LOOKBACK_SESSIONS = 21;

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

/** Simple return over the last N sessions from a newest-first close series. */
export function trailingReturn(closes: number[], sessions = LOOKBACK_SESSIONS): number | null {
  if (closes.length <= sessions) return null;
  const latest = closes[0];
  const base = closes[sessions];
  if (!latest || !base) return null;
  return (latest / base - 1) * 100;
}

/** Pure part: build the lines from numbers already in hand. */
export function describeContext(
  quote: ContextQuote,
  extras: { avgVolume?: number | null; etfReturn?: number | null; spyReturn?: number | null } = {}
): AlertContext {
  const out: AlertContext = { lines: [] };
  const price = quote.price;

  if (quote.sma50 && quote.sma200) {
    out.aboveSma50 = price > quote.sma50;
    out.aboveSma200 = price > quote.sma200;
    out.lines.push(
      `${out.aboveSma50 ? "Above" : "Below"} its 50-day average ($${quote.sma50.toFixed(2)}) and ${out.aboveSma200 ? "above" : "below"} its 200-day ($${quote.sma200.toFixed(2)}).`
    );
  }

  const avg = quote.avgVolume || extras.avgVolume || 0;
  if (quote.volume && avg > 0) {
    out.volumeRatio = quote.volume / avg;
    const r = out.volumeRatio;
    out.lines.push(`Volume ${r.toFixed(1)}× its 30-session average${r >= 1.5 ? " (above the 1.5× participation mark)" : r < 0.8 ? " (light)" : ""}.`);
  }

  if (quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekHigh > 0) {
    const off = (1 - price / quote.fiftyTwoWeekHigh) * 100;
    if (off > 0.05) out.lines.push(`${off.toFixed(1)}% below its 52-week high.`);
  }

  if (typeof extras.etfReturn === "number" && typeof extras.spyReturn === "number") {
    out.relativeToSpyPts = extras.etfReturn - extras.spyReturn;
    const rel = out.relativeToSpyPts;
    out.lines.push(`Last ${LOOKBACK_SESSIONS} sessions: ${pct(extras.etfReturn)} vs SPY ${pct(extras.spyReturn)} (${rel >= 0 ? "+" : "−"}${Math.abs(rel).toFixed(1)} pts).`);
    if (out.aboveSma200 !== undefined) {
      const leading = out.aboveSma200 && rel > 0;
      out.lines.push(
        leading
          ? "Reads as improving leadership: above the 200-day average and ahead of the index over the last month."
          : out.aboveSma200
            ? "Reads as a trend still intact but lagging the index over the last month."
            : "Reads as a bounce within a downtrend: still below the 200-day average" + (rel > 0 ? ", though ahead of the index over the last month." : " and behind the index over the last month.")
      );
    }
  }

  return out;
}

/**
 * Fetch what the quote does not carry (30-session average volume; ETF and
 * SPY closes for the sector list) and describe. Never throws: a failed fetch
 * just means fewer lines.
 */
export async function buildAlertContext(quote: ContextQuote): Promise<AlertContext> {
  const ticker = quote.ticker.toUpperCase();
  let avgVolume: number | null = null;
  let etfReturn: number | null = null;
  let spyReturn: number | null = null;
  try {
    if (!quote.avgVolume && quote.volume) avgVolume = await fetchFmpAvgVolume(ticker);
  } catch (err) {
    console.warn(`[context] avg volume failed for ${ticker}:`, err instanceof Error ? err.message : err);
  }
  if (SECTOR_ETFS.has(ticker)) {
    try {
      const [etf, spy] = await Promise.all([fetchFmpHistoricalCloses(ticker), fetchFmpHistoricalCloses("SPY")]);
      etfReturn = trailingReturn(etf);
      spyReturn = trailingReturn(spy);
    } catch (err) {
      console.warn(`[context] relative performance failed for ${ticker}:`, err instanceof Error ? err.message : err);
    }
  }
  return describeContext(quote, { avgVolume, etfReturn, spyReturn });
}
