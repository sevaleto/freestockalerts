import { SECTIONS, type StrategySection } from "@/lib/templates/catalog";
import { SECTION_ICONS } from "@/lib/templates/icons";

interface SectionChipProps {
  section: StrategySection;
  className?: string;
}

/** The catalog section a strategy belongs to, shown on every card and page. */
export function SectionChip({ section, className = "" }: SectionChipProps) {
  const Icon = SECTION_ICONS[section];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-lp-mint px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-lp-teal ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {SECTIONS[section].label}
    </span>
  );
}
