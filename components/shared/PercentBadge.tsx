import { formatPercent } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

interface PercentBadgeProps {
  value: number;
}

export function PercentBadge({ value }: PercentBadgeProps) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        isPositive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      )}
    >
      {formatPercent(value)}
    </span>
  );
}
