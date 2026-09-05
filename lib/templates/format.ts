/** Small display helpers shared by the index, the cards and the detail page. */
import type { StrategyDefinition } from "./catalog";

/** "Sep 5, 2026" in US market time; empty string when unknown. */
export function formatRefreshDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(d);
}

/** First clause of the cadence for cards: "Monthly", "Weekly", "Fixed list". */
export const shortCadence = (s: Pick<StrategyDefinition, "refreshCadence">) =>
  s.refreshCadence.split(/[,;]/)[0].replace(/ during earnings season$/i, " in earnings season").trim();

export const alertCountLabel = (n: number) => `${n} alert${n === 1 ? "" : "s"}`;
