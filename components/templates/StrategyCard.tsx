import Link from "next/link";
import { ArrowRight, Bell, RefreshCw, Zap } from "lucide-react";
import type { StrategyDefinition } from "@/lib/templates/catalog";
import { strategyIcon } from "@/lib/templates/icons";
import { alertCountLabel, formatRefreshDate, shortCadence } from "@/lib/templates/format";
import { SectionChip } from "./SectionChip";

interface StrategyCardProps {
  strategy: StrategyDefinition;
  /** Larger treatment for the three featured idea-discovery strategies. */
  featured?: boolean;
}

/** Index card: category, name, one-line value proposition, trigger, alert count, cadence. */
export function StrategyCard({ strategy, featured = false }: StrategyCardProps) {
  const Icon = strategyIcon(strategy.icon);
  const isSignal = strategy.kind === "signal";
  const refreshed = isSignal ? "" : formatRefreshDate(strategy.lastRefreshedAt);
  return (
    <Link
      href={`/templates/${strategy.slug}`}
      className={`group flex h-full flex-col rounded-[20px] border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-lp-teal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2 ${
        featured ? "border-lp-teal/30" : "border-lp-border"
      }`}
      aria-label={`Preview strategy: ${strategy.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lp-mint text-lp-teal" aria-hidden>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <SectionChip section={strategy.section} />
      </div>

      <h3 className="mt-5 text-lg font-semibold leading-snug text-lp-navy group-hover:text-lp-teal">{strategy.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-lp-navy/75">{strategy.valueProposition}</p>

      <dl className="mt-5 space-y-2 border-t border-lp-border/70 pt-4 text-sm">
        <div className="flex gap-2.5">
          <dt className="flex shrink-0 items-center gap-1.5 text-lp-muted">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Trigger</span>
          </dt>
          <dd className="text-lp-navy">{strategy.triggerSummary}</dd>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-lp-muted">
          <span className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" aria-hidden />
            {isSignal ? "Event alerts" : alertCountLabel(strategy.items.length)}
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            <span>
              <span className="sr-only">Refresh cadence: </span>
              {shortCadence(strategy)}
              {refreshed ? <span className="text-lp-muted/80"> · as of {refreshed}</span> : null}
            </span>
          </span>
        </div>
      </dl>

      <span className="mt-auto flex items-center gap-1 pt-5 text-sm font-semibold text-lp-teal">
        Preview strategy <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
