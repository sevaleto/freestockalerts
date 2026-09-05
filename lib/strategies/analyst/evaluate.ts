/**
 * Analyst Upgrade Clusters: independent positive actions inside a short
 * window, no conflicting major downgrade, and price or volume confirmation.
 */
import { ANALYST, UNIVERSE } from "../config";
import { averageVolume, daysBetween, isoDay, recentHigh, type DailyBar, type QuoteSnapshot } from "../market";
import { firmKey, tierLabel, type NormalizedAnalystAction } from "./normalize";

export interface ClusterAction {
  firm: string;
  date: string;
  previousGrade: string | null;
  newGrade: string | null;
  previousTier: string | null;
  newTier: string | null;
  action: string | null;
  isTrueUpgrade: boolean;
  sourceUrl: string | null;
  dedupKey: string;
}

export interface Cluster {
  symbol: string;
  /** One per independent firm, latest action from that firm. */
  positive: ClusterAction[];
  firms: number;
  hasTrueUpgrade: boolean;
  majorDowngrades: ClusterAction[];
  minorDowngrades: ClusterAction[];
  /** Calendar days from the first to the last positive action. */
  spanDays: number;
  windowStart: string;
  windowEnd: string;
}

const toClusterAction = (a: NormalizedAnalystAction): ClusterAction => ({
  firm: a.firm,
  date: a.actionDate,
  previousGrade: a.previousGrade,
  newGrade: a.newGrade,
  previousTier: a.previousTier,
  newTier: a.newTier,
  action: a.action,
  isTrueUpgrade: a.isTrueUpgrade,
  sourceUrl: a.sourceUrl,
  dedupKey: a.dedupKey,
});

/** Group a symbol's actions into the last-N-days cluster. Duplicates and repeat records from one firm collapse. */
export function buildCluster(symbol: string, actions: NormalizedAnalystAction[], now = new Date()): Cluster {
  const today = isoDay(now);
  const start = isoDay(new Date(now.getTime() - ANALYST.lookbackDays * 86_400_000));
  const seen = new Set<string>();
  const inWindow = actions
    .filter((a) => a.symbol === symbol && a.actionDate >= start && a.actionDate <= today)
    .filter((a) => (seen.has(a.dedupKey) ? false : (seen.add(a.dedupKey), true)))
    .sort((a, b) => (a.actionDate < b.actionDate ? -1 : a.actionDate > b.actionDate ? 1 : 0));

  const byFirm = new Map<string, NormalizedAnalystAction>();
  for (const a of inWindow) {
    if (!a.isPositiveAction) continue;
    const key = firmKey(a);
    const prev = byFirm.get(key);
    // Keep the strongest record per firm: a true upgrade beats an initiation; later beats earlier.
    if (!prev || (a.isTrueUpgrade && !prev.isTrueUpgrade) || (a.isTrueUpgrade === prev.isTrueUpgrade && a.actionDate >= prev.actionDate)) byFirm.set(key, a);
  }
  const positive = [...byFirm.values()].map(toClusterAction);
  const dates = positive.map((p) => p.date).sort();
  return {
    symbol,
    positive,
    firms: positive.length,
    hasTrueUpgrade: positive.some((p) => p.isTrueUpgrade),
    majorDowngrades: inWindow.filter((a) => a.isMajorDowngrade).map(toClusterAction),
    minorDowngrades: inWindow.filter((a) => a.isMinorDowngrade).map(toClusterAction),
    spanDays: dates.length >= 2 ? daysBetween(dates[0], dates[dates.length - 1]) : 0,
    windowStart: start,
    windowEnd: today,
  };
}

export type AnalystConfirmation = "breakout" | "volume";

export interface AnalystEvaluation {
  symbol: string;
  qualifies: boolean;
  reasons: string[];
  score: number;
  confirmation: AnalystConfirmation | null;
  signalKey: string;
  price: number;
  explanation: string;
  payload: {
    companyName: string;
    actions: ClusterAction[];
    firms: string[];
    firmCount: number;
    hasTrueUpgrade: boolean;
    majorDowngrades: ClusterAction[];
    minorDowngrades: ClusterAction[];
    spanDays: number;
    windowDays: number;
    recentHigh: number | null;
    brokeRecentHigh: boolean;
    sma50: number | null;
    volume: number;
    avgVolume: number | null;
    volumeRatio: number | null;
    marketCap: number;
    scoreBreakdown: Record<string, number>;
    dataAsOf: string;
    source: string;
  };
}

/** Stable, short key for a set of dedup keys. */
export function hashKeys(keys: string[]): string {
  const s = [...keys].sort().join("\n");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export interface AnalystInputs {
  cluster: Cluster;
  quote: QuoteSnapshot;
  bars: DailyBar[];
  now?: Date;
}

export function evaluateAnalystSymbol({ cluster, quote, bars, now = new Date() }: AnalystInputs): AnalystEvaluation {
  const today = isoDay(now);
  const reasons: string[] = [];
  const price = quote.price;
  const avgVolume = averageVolume(bars, UNIVERSE.avgVolumeSessions, today);
  const volumeRatio = avgVolume && quote.volume ? quote.volume / avgVolume : null;
  const high = recentHigh(bars, ANALYST.highLookbackSessions, today);
  const brokeHigh = high !== null && price > high;
  const volumeConfirmed = volumeRatio !== null && volumeRatio >= ANALYST.volumeMultiple && quote.changePercent > 0;

  if (cluster.firms < ANALYST.minFirms) reasons.push(`${cluster.firms} independent positive action${cluster.firms === 1 ? "" : "s"}; ${ANALYST.minFirms} required`);
  if (cluster.majorDowngrades.length > 0) reasons.push(`conflicting downgrade from ${cluster.majorDowngrades.map((d) => d.firm).join(", ")}`);
  if (quote.marketCap < UNIVERSE.marketCapMin) reasons.push(`market cap $${(quote.marketCap / 1e9).toFixed(1)}B below $${UNIVERSE.marketCapMin / 1e9}B`);
  if (avgVolume === null) reasons.push("average volume unavailable");
  else if (avgVolume < UNIVERSE.avgVolumeMin) reasons.push(`average volume ${Math.round(avgVolume).toLocaleString()} below ${UNIVERSE.avgVolumeMin.toLocaleString()}`);
  if (quote.sma50 === null) reasons.push("50-day average unavailable");
  else if (!(price > quote.sma50)) reasons.push("price below its 50-day average");

  let confirmation: AnalystConfirmation | null = null;
  if (brokeHigh) confirmation = "breakout";
  else if (volumeConfirmed) confirmation = "volume";
  else reasons.push("no price or volume confirmation");

  const breakdown: Record<string, number> = {};
  if (cluster.firms >= ANALYST.minFirms) breakdown.base = ANALYST.score.base;
  if (cluster.firms >= 3) breakdown.threeOrMoreFirms = ANALYST.score.threeOrMoreFirms;
  if (cluster.firms >= ANALYST.minFirms && cluster.spanDays <= ANALYST.tightWindowDays) breakdown.tightWindow = ANALYST.score.tightWindow;
  if (cluster.hasTrueUpgrade) breakdown.trueUpgrade = ANALYST.score.trueUpgrade;
  if (brokeHigh) breakdown.breakout = ANALYST.score.breakout;
  if (volumeRatio !== null && volumeRatio >= ANALYST.volumeMultiple) breakdown.volume = ANALYST.score.volume;
  if (cluster.minorDowngrades.length > 0) breakdown.minorDowngrade = ANALYST.score.minorDowngradePenalty;
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (score < ANALYST.minScore) reasons.push(`score ${score} below ${ANALYST.minScore}`);

  const spanText = cluster.spanDays <= 1 ? "the past day" : `the past ${Math.max(cluster.spanDays, 1)} days`;
  const explanation = `${cluster.symbol} received ${cluster.firms} positive analyst action${cluster.firms === 1 ? "" : "s"} from independent firms during ${spanText}${
    cluster.hasTrueUpgrade ? ", including at least one outright upgrade" : ""
  }. Shares are now above their 50-day average and ${
    confirmation === "breakout" ? `breaking a ${ANALYST.highLookbackSessions}-day high` : "trading on elevated volume"
  }${confirmation === "breakout" && volumeRatio !== null && volumeRatio >= ANALYST.volumeMultiple ? " on elevated volume" : ""}.`;

  return {
    symbol: cluster.symbol,
    qualifies: reasons.length === 0,
    reasons,
    score,
    confirmation,
    signalKey: `analyst:${cluster.symbol}:${hashKeys(cluster.positive.map((p) => p.dedupKey))}`,
    price,
    explanation,
    payload: {
      companyName: quote.companyName,
      actions: cluster.positive.map((p) => ({ ...p, previousTier: p.previousTier ? tierLabel(p.previousTier as never) : null, newTier: p.newTier ? tierLabel(p.newTier as never) : null })),
      firms: cluster.positive.map((p) => p.firm),
      firmCount: cluster.firms,
      hasTrueUpgrade: cluster.hasTrueUpgrade,
      majorDowngrades: cluster.majorDowngrades,
      minorDowngrades: cluster.minorDowngrades,
      spanDays: cluster.spanDays,
      windowDays: ANALYST.lookbackDays,
      recentHigh: high,
      brokeRecentHigh: brokeHigh,
      sma50: quote.sma50,
      volume: quote.volume,
      avgVolume,
      volumeRatio,
      marketCap: quote.marketCap,
      scoreBreakdown: breakdown,
      dataAsOf: quote.asOf,
      source: "Analyst rating changes via Financial Modeling Prep",
    },
  };
}
