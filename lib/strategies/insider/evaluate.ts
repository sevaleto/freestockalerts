/**
 * Insider Purchase Confirmation: which purchases count, and whether the
 * price action has confirmed them. Pure functions; the scan supplies data.
 */
import { INSIDER, UNIVERSE } from "../config";
import { averageVolume, daysBetween, highestCloseSince, isoDay, type DailyBar, type QuoteSnapshot } from "../market";
import { classifyRole, describeInsider, isCommonStock, prettyName, type NormalizedInsiderTransaction } from "./normalize";

export interface Rejection {
  ok: false;
  reason: string;
}
export type Verdict = { ok: true } | Rejection;

/** Rules that apply to one transaction on its own. */
export function isQualifyingPurchase(t: NormalizedInsiderTransaction, now = new Date()): Verdict {
  if (!(INSIDER.purchaseCodes as readonly string[]).includes(t.transactionCode)) {
    return { ok: false, reason: t.transactionCode ? `transaction code ${t.transactionCode} is not a purchase` : "no SEC transaction code" };
  }
  if (t.acquisitionOrDisposition && t.acquisitionOrDisposition.toUpperCase().startsWith("D")) return { ok: false, reason: "disposition" };
  if (!(t.price > 0)) return { ok: false, reason: "zero or missing price" };
  if (!(t.shares > 0)) return { ok: false, reason: "zero or missing share count" };
  if (!isCommonStock(t.securityName)) return { ok: false, reason: `security is ${t.securityName}` };
  if (t.value < INSIDER.minPurchaseValue) return { ok: false, reason: `value $${Math.round(t.value).toLocaleString()} below $${INSIDER.minPurchaseValue.toLocaleString()}` };
  const role = classifyRole(t.ownerType);
  if (!role.isRelevant) return { ok: false, reason: `not a director or senior officer (${t.ownerType ?? "unknown role"})` };
  const age = daysBetween(t.transactionDate, isoDay(now));
  if (age < 0) return { ok: false, reason: "transaction date in the future" };
  if (age > INSIDER.lookbackDays) return { ok: false, reason: `purchase ${age} days old` };
  return { ok: true };
}

/** One row per dedupKey; the first occurrence wins. */
export function dedupeTransactions<T extends { dedupKey: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((t) => (seen.has(t.dedupKey) ? false : (seen.add(t.dedupKey), true)));
}

export function groupBySymbol<T extends { symbol: string }>(list: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of list) {
    if (!out.has(t.symbol)) out.set(t.symbol, []);
    out.get(t.symbol)!.push(t);
  }
  return out;
}

export type InsiderConfirmation = "breakout" | "near-high-volume";

export interface InsiderPurchaseSummary {
  insider: string;
  title: string | null;
  isSenior: boolean;
  date: string;
  shares: number;
  price: number;
  value: number;
  sharesOwnedAfter: number | null;
  /** shares bought ÷ shares held before, when ownership is known. */
  relativeToHoldings: number | null;
  filingUrl: string | null;
  accession: string | null;
  dedupKey: string;
}

export interface InsiderEvaluation {
  symbol: string;
  qualifies: boolean;
  reasons: string[];
  score: number;
  confirmation: InsiderConfirmation | null;
  signalKey: string;
  price: number;
  explanation: string;
  payload: {
    companyName: string;
    purchases: InsiderPurchaseSummary[];
    distinctInsiders: number;
    totalValue: number;
    earliestPurchase: string;
    latestPurchase: string;
    postPurchaseHigh: number | null;
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

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const approxShares = (n: number) => `${Math.round(n).toLocaleString("en-US")}`;

export function summarizePurchase(t: NormalizedInsiderTransaction): InsiderPurchaseSummary {
  const before = t.sharesOwnedAfter !== null && t.sharesOwnedAfter > t.shares ? t.sharesOwnedAfter - t.shares : null;
  return {
    insider: prettyName(t.insiderName),
    title: t.insiderTitle ?? (t.isDirector ? "Director" : null),
    isSenior: t.isSenior,
    date: t.transactionDate,
    shares: t.shares,
    price: t.price,
    value: t.value,
    sharesOwnedAfter: t.sharesOwnedAfter,
    relativeToHoldings: before && before > 0 ? t.shares / before : null,
    filingUrl: t.filingUrl,
    accession: t.accession,
    dedupKey: t.dedupKey,
  };
}

export interface InsiderInputs {
  symbol: string;
  /** Already passed isQualifyingPurchase and dedupe. */
  purchases: NormalizedInsiderTransaction[];
  quote: QuoteSnapshot;
  bars: DailyBar[];
  now?: Date;
}

export function evaluateInsiderSymbol({ symbol, purchases, quote, bars, now = new Date() }: InsiderInputs): InsiderEvaluation {
  const today = isoDay(now);
  const reasons: string[] = [];
  const sorted = [...purchases].sort((a, b) => (a.transactionDate < b.transactionDate ? -1 : a.transactionDate > b.transactionDate ? 1 : 0));
  const earliest = sorted[0]?.transactionDate ?? today;
  const latest = sorted[sorted.length - 1] ?? sorted[0];
  const avgVolume = averageVolume(bars, UNIVERSE.avgVolumeSessions, today);
  const volumeRatio = avgVolume && quote.volume ? quote.volume / avgVolume : null;
  const postHigh = highestCloseSince(bars, earliest, today);
  const price = quote.price;

  if (purchases.length === 0) reasons.push("no qualifying purchases");
  if (quote.marketCap < UNIVERSE.marketCapMin) reasons.push(`market cap $${(quote.marketCap / 1e9).toFixed(1)}B below $${UNIVERSE.marketCapMin / 1e9}B`);
  if (avgVolume === null) reasons.push("average volume unavailable");
  else if (avgVolume < UNIVERSE.avgVolumeMin) reasons.push(`average volume ${Math.round(avgVolume).toLocaleString()} below ${UNIVERSE.avgVolumeMin.toLocaleString()}`);
  if (quote.sma50 === null) reasons.push("50-day average unavailable");
  else if (!(price > quote.sma50)) reasons.push("price below its 50-day average");

  let confirmation: InsiderConfirmation | null = null;
  if (postHigh === null) reasons.push("no completed session since the purchase yet");
  else if (price > postHigh) confirmation = "breakout";
  else if (price >= postHigh * (1 - INSIDER.nearHighPct) && volumeRatio !== null && volumeRatio >= INSIDER.volumeMultiple) confirmation = "near-high-volume";
  else reasons.push(`price ${((1 - price / postHigh) * 100).toFixed(1)}% below the post-purchase high without a volume push`);

  const summaries = sorted.map(summarizePurchase);
  const distinctInsiders = new Set(sorted.map((t) => (t.raw.reportingCik as string | undefined) ?? t.insiderName)).size;
  const totalValue = sorted.reduce((a, t) => a + t.value, 0);

  const breakdown: Record<string, number> = {};
  if (confirmation === "breakout") breakdown.breakout = INSIDER.score.breakout;
  if (confirmation === "near-high-volume") breakdown.nearHighWithVolume = INSIDER.score.nearHighWithVolume;
  if (distinctInsiders >= 2) breakdown.multipleInsiders = INSIDER.score.multipleInsiders;
  if (sorted.some((t) => t.isSenior)) breakdown.seniorInsider = INSIDER.score.seniorInsider;
  if (sorted.some((t) => t.value >= INSIDER.score.largePurchaseValue)) breakdown.largePurchase = INSIDER.score.largePurchase;
  if (summaries.some((p) => p.relativeToHoldings !== null && p.relativeToHoldings >= INSIDER.bigRelativeToHoldings)) breakdown.bigRelativeToHoldings = INSIDER.score.bigRelativeToHoldings;
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (score < INSIDER.minScore) reasons.push(`score ${score} below ${INSIDER.minScore}`);

  const lead = sorted.find((t) => t.isSenior) ?? [...sorted].sort((a, b) => b.value - a.value)[0];
  const explanation = lead
    ? `${describeInsider(lead)}, purchased approximately ${approxShares(lead.shares)} shares worth ${usd(lead.value)}${
        distinctInsiders > 1 ? `, one of ${distinctInsiders} insiders buying in the last ${INSIDER.lookbackDays} days` : ""
      }. The stock is now above its 50-day average and ${
        confirmation === "breakout"
          ? "is breaking above its post-purchase high"
          : `is within ${INSIDER.nearHighPct * 100}% of its post-purchase high`
      }${volumeRatio !== null && volumeRatio >= INSIDER.volumeMultiple ? " on stronger-than-normal volume" : ""}.`
    : "";

  return {
    symbol,
    qualifies: reasons.length === 0,
    reasons,
    score,
    confirmation,
    signalKey: `insider:${symbol}:${latest?.dedupKey ?? "none"}`,
    price,
    explanation,
    payload: {
      companyName: quote.companyName,
      purchases: summaries,
      distinctInsiders,
      totalValue,
      earliestPurchase: earliest,
      latestPurchase: latest?.transactionDate ?? earliest,
      postPurchaseHigh: postHigh,
      sma50: quote.sma50,
      volume: quote.volume,
      avgVolume,
      volumeRatio,
      marketCap: quote.marketCap,
      scoreBreakdown: breakdown,
      dataAsOf: quote.asOf,
      source: "SEC Form 4 filings via Financial Modeling Prep",
    },
  };
}
