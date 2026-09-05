/**
 * Shape of lib/templates/screened.json, the point-in-time output of
 * scripts/refresh-strategies.ts. Read by the catalog to fill in constituents.
 */
import type { Snapshot } from "./screens";
import data from "./screened.json";

export interface ScreenedConstituent {
  ticker: string;
  companyName: string;
  alertType: "PRICE_ABOVE" | "PRICE_BELOW" | "FIFTY_TWO_WEEK_HIGH" | "SMA_CROSS_ABOVE";
  triggerValue: number;
  triggerDirection: "ABOVE" | "BELOW";
  rationale: string;
  sortOrder: number;
  /** The data the rules saw when the list was built. */
  snapshot: Snapshot;
}

export interface ScreenedStrategy {
  refreshedAt: string;
  universeSize: number;
  qualifiedCount: number;
  constituents: ScreenedConstituent[];
}

export interface ScreenedFile {
  generatedAt: string;
  strategies: Partial<Record<string, ScreenedStrategy>>;
}

export const screened = data as ScreenedFile;

export const getScreened = (slug: string): ScreenedStrategy | null => screened.strategies[slug] ?? null;
