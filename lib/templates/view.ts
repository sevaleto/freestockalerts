/**
 * What a strategy page shows. The catalog supplies the content; the database
 * supplies the alerts a visitor will actually get when they activate, so the
 * "current alert list" always matches activation even if the seed and the
 * catalog are briefly out of step.
 */
import { prisma } from "@/lib/prisma/client";
import { getStrategy, type StrategyDefinition, type TemplateItem } from "./catalog";
import { resolveTemplateSlug } from "./redirects";
import { loadRecentSignals, type RecentSignalsView } from "@/lib/strategies/signals";

export interface StrategyView {
  strategy: StrategyDefinition;
  items: TemplateItem[];
  /** ISO timestamp of the list shown. */
  lastRefreshedAt: string;
  /** Where the items came from; "catalog" means the database has no row yet. */
  source: "database" | "catalog";
  /** Recent output of the daily scan, for signal strategies only. */
  signals: RecentSignalsView | null;
}

export async function loadStrategyView(slug: string): Promise<StrategyView | null> {
  const strategy = getStrategy(resolveTemplateSlug(slug));
  if (!strategy) return null;
  const signals = strategy.kind === "signal" ? await loadRecentSignals(strategy.slug) : null;
  try {
    const row = await prisma.alertTemplate.findUnique({
      where: { slug: strategy.slug },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (row) {
      return {
        strategy,
        items: row.items.map((i) => ({
          ticker: i.ticker,
          companyName: i.companyName ?? undefined,
          alertType: i.alertType as TemplateItem["alertType"],
          triggerDirection: i.triggerDirection,
          triggerValue: i.triggerValue,
          rationale: i.rationale ?? undefined,
          sortOrder: i.sortOrder,
        })),
        lastRefreshedAt: row.lastRefreshedAt?.toISOString() ?? strategy.lastRefreshedAt,
        source: "database",
        signals,
      };
    }
  } catch (err) {
    console.error(`[templates] database read failed for ${strategy.slug}:`, err);
  }
  return { strategy, items: strategy.items, lastRefreshedAt: strategy.lastRefreshedAt, source: "catalog", signals };
}
