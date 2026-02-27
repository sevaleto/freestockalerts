import { formatPrice } from "@/lib/utils/formatters";

interface PriceDisplayProps {
  value: number;
  change?: number;
  className?: string;
}

export function PriceDisplay({ value, change, className }: PriceDisplayProps) {
  const colorClass =
    change === undefined ? "text-text-primary" : change >= 0 ? "text-success" : "text-danger";

  return (
    <span className={className ?? colorClass}>
      {formatPrice(value)}
    </span>
  );
}
