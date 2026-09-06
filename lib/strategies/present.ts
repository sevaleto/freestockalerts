/**
 * One place that turns a stored signal into the rows an email or a page
 * shows. Both strategies' payloads are typed here so the UI, the email and
 * the tests agree on what an alert contains.
 */
import type { InsiderEvaluation } from "./insider/evaluate";
import type { AnalystEvaluation } from "./analyst/evaluate";
import { ANALYST_SLUG, INSIDER_SLUG, MAX_SCORE } from "./config";

export type InsiderPayload = InsiderEvaluation["payload"];
export type AnalystPayload = AnalystEvaluation["payload"];

export interface SignalLike {
  strategySlug: string;
  symbol: string;
  companyName: string | null;
  price: number;
  score: number;
  confirmation: string;
  explanation: string;
  payload: unknown;
  dataAsOf: Date | string;
  createdAt?: Date | string;
}

export interface SignalRow {
  label: string;
  value: string;
  href?: string;
}

const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdRound = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const int = (v: number) => Math.round(v).toLocaleString("en-US");
const shortDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
};

export const formatDataTimestamp = (d: Date | string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(d)) + " ET";

export const confirmationLabel = (c: string) =>
  ({
    breakout: "Breaking above the post-purchase high",
    "near-high-volume": "Within 3% of the post-purchase high on elevated volume",
    volume: "Elevated volume on an up day",
  })[c] ?? c;

export const analystConfirmationLabel = (c: string) => (c === "breakout" ? "Breaking a 20-day high" : c === "volume" ? "Elevated volume on an up day" : c);

export const maxScoreFor = (slug: string) => (slug === INSIDER_SLUG ? MAX_SCORE.insider : slug === ANALYST_SLUG ? MAX_SCORE.analyst : null);

export function signalSubject(s: SignalLike): string {
  if (s.strategySlug === INSIDER_SLUG) {
    const p = s.payload as InsiderPayload;
    return `${s.symbol}: insider purchase confirmed (${p.distinctInsiders} insider${p.distinctInsiders === 1 ? "" : "s"}, ${usdRound(p.totalValue)})`;
  }
  const p = s.payload as AnalystPayload;
  return `${s.symbol}: ${p.firmCount} positive analyst actions, price confirming`;
}

export function signalRows(s: SignalLike): SignalRow[] {
  const rows: SignalRow[] = [
    { label: "Company", value: s.companyName ? `${s.companyName} (${s.symbol})` : s.symbol },
    { label: "Current price", value: usd(s.price) },
  ];
  if (s.strategySlug === INSIDER_SLUG) {
    const p = s.payload as InsiderPayload;
    const lead = p.purchases.find((x) => x.isSenior) ?? [...p.purchases].sort((a, b) => b.value - a.value)[0];
    if (lead) {
      rows.push({ label: "Insider", value: `${lead.insider}${lead.title ? `, ${lead.title}` : ""}` });
      rows.push({ label: "Purchase date", value: shortDate(lead.date) });
      rows.push({ label: "Shares purchased", value: int(lead.shares) });
      rows.push({ label: "Purchase price", value: usd(lead.price) });
      rows.push({ label: "Total purchase value", value: usdRound(lead.value) });
    }
    rows.push({ label: "Qualifying insiders", value: `${p.distinctInsiders} (${p.purchases.length} purchase${p.purchases.length === 1 ? "" : "s"}, ${usdRound(p.totalValue)} combined)` });
    rows.push({ label: "Confirmation", value: confirmationLabel(s.confirmation) + (p.volumeRatio ? ` · volume ${p.volumeRatio.toFixed(1)}× 20-day average` : "") });
    if (p.postPurchaseHigh) rows.push({ label: "Post-purchase high", value: usd(p.postPurchaseHigh) });
    if (p.sma50) rows.push({ label: "50-day average", value: usd(p.sma50) });
    const filing = lead?.filingUrl ?? p.purchases.find((x) => x.filingUrl)?.filingUrl;
    if (filing) rows.push({ label: "SEC filing", value: "View the Form 4 on sec.gov", href: filing });
  } else {
    const p = s.payload as AnalystPayload;
    rows.push({ label: "Independent positive actions", value: `${p.firmCount} in the last ${p.windowDays} days${p.spanDays ? ` (all within ${p.spanDays} day${p.spanDays === 1 ? "" : "s"})` : ""}` });
    for (const a of p.actions) {
      const change = a.previousGrade && a.newGrade ? `${a.previousGrade} → ${a.newGrade}` : (a.newGrade ?? "rating not provided");
      rows.push({ label: a.firm, value: `${shortDate(a.date)} · ${change}${a.isTrueUpgrade ? " (upgrade)" : a.action === "initiate" ? " (initiation)" : ""}`, href: a.sourceUrl ?? undefined });
    }
    if (p.minorDowngrades.length) rows.push({ label: "Note", value: `${p.minorDowngrades.length} firm${p.minorDowngrades.length === 1 ? "" : "s"} trimmed a rating but stayed positive` });
    rows.push({ label: "Confirmation", value: analystConfirmationLabel(s.confirmation) + (p.volumeRatio ? ` · volume ${p.volumeRatio.toFixed(1)}× 20-day average` : "") });
    if (p.recentHigh) rows.push({ label: "20-day high", value: usd(p.recentHigh) });
    if (p.sma50) rows.push({ label: "50-day average", value: usd(p.sma50) });
  }
  return rows;
}

/** Written by the scan after the signal is created; absent on signals from before the feature. */
export interface SignalAiContext {
  text: string;
  paragraphs: string[];
  source: "claude" | "fallback";
  model: string | null;
  generatedAt: string;
}

export function signalAiContext(s: SignalLike): SignalAiContext | null {
  const p = s.payload as { aiContext?: SignalAiContext } | null;
  const c = p?.aiContext;
  return c && Array.isArray(c.paragraphs) && c.paragraphs.length ? c : null;
}

export function signalSource(s: SignalLike): string {
  const p = s.payload as { source?: string };
  return `${p.source ?? "Financial Modeling Prep"}. Data as of ${formatDataTimestamp(s.dataAsOf)}.`;
}
