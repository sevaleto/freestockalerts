import Link from "next/link";
import { Bell, RefreshCw, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SectionChip } from "@/components/templates/SectionChip";
import { strategyIcon } from "@/lib/templates/icons";
import type { StrategySection } from "@/lib/templates/catalog";

interface TemplateCardProps {
  name: string;
  description: string;
  icon: string;
  section: StrategySection;
  triggerSummary?: string | null;
  refreshCadence?: string | null;
  alertsCount: number;
  /** Signal strategies have no fixed alert list. */
  kind?: "watchlist" | "signal";
  isActive: boolean;
  href?: string;
  onToggle?: (value: boolean) => void;
}

export function TemplateCard({
  name,
  description,
  icon,
  section,
  triggerSummary,
  refreshCadence,
  alertsCount,
  kind = "watchlist",
  isActive,
  href,
  onToggle,
}: TemplateCardProps) {
  const Icon = strategyIcon(icon);
  return (
    <div className="flex h-full flex-col rounded-[20px] border border-border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lp-mint text-lp-teal" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <Switch checked={isActive} onCheckedChange={onToggle} aria-label={`${isActive ? "Deactivate" : "Activate"} ${name}`} />
      </div>
      <SectionChip section={section} className="mt-4 w-fit" />
      <h3 className="mt-3 text-lg font-semibold text-text-primary">
        {href ? (
          <Link href={href} className="hover:text-primary">
            {name}
          </Link>
        ) : (
          name
        )}
      </h3>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-text-muted">
        {triggerSummary ? (
          <div className="flex gap-2">
            <dt className="flex items-center"><Zap className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">Trigger</span></dt>
            <dd className="text-text-primary">{triggerSummary}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" aria-hidden />{kind === "signal" ? "Event alerts by email" : `${alertsCount} alerts`}</span>
          {refreshCadence ? <span className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" aria-hidden />{refreshCadence.split(/[,;]/)[0]}</span> : null}
        </div>
      </dl>
      {href ? (
        <Link href={href} className="mt-auto pt-4 text-sm font-semibold text-lp-teal hover:text-lp-teal-dark">
          Preview strategy →
        </Link>
      ) : null}
    </div>
  );
}
