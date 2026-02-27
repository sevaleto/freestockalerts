import { formatDateTime, formatPrice } from "@/lib/utils/formatters";

interface AlertHistoryItemProps {
  ticker: string;
  alertType: string;
  priceAtTrigger: number;
  triggeredAt: string;
  aiSummary: string;
}

export function AlertHistoryItem({
  ticker,
  alertType,
  priceAtTrigger,
  triggeredAt,
  aiSummary,
}: AlertHistoryItemProps) {
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{ticker}</p>
          <p className="text-xs text-text-muted">{alertType.replace(/_/g, " ")}</p>
        </div>
        <div className="text-right text-xs text-text-muted">
          {formatDateTime(triggeredAt)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Trigger price</p>
          <p className="font-semibold text-text-primary">{formatPrice(priceAtTrigger)}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-text-secondary">{aiSummary}</p>
    </div>
  );
}
