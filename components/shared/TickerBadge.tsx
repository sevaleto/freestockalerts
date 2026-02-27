interface TickerBadgeProps {
  ticker: string;
}

export function TickerBadge({ ticker }: TickerBadgeProps) {
  return (
    <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-primary">
      {ticker}
    </span>
  );
}
