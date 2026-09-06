import { orderedStrategies } from "@/lib/templates/catalog";
import { defaultsFromStrategy } from "@/lib/lp/view";

/** Compact, serializable strategy list for the editor's dropdown and prefill (server → client prop). */
export interface StrategyOption {
  slug: string;
  name: string;
  kind: "watchlist" | "signal";
  section: string;
  defaults: ReturnType<typeof defaultsFromStrategy>;
}

export function strategyOptions(): StrategyOption[] {
  return orderedStrategies().map((s) => ({ slug: s.slug, name: s.name, kind: s.kind, section: s.section, defaults: defaultsFromStrategy(s) }));
}
