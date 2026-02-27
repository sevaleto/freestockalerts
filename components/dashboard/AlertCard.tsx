import { Card, CardContent } from "@/components/ui/card";
import { TickerBadge } from "@/components/shared/TickerBadge";
import { formatDateTime, formatPrice } from "@/lib/utils/formatters";

interface AlertCardProps {
  ticker: string;
  companyName: string;
  alertType: string;
  triggerPrice: number;
  currentPrice: number;
  triggeredAt: string;
  aiSummary: string;
}

export function AlertCard({
  ticker,
  companyName,
  alertType,
  triggerPrice,
  currentPrice,
  triggeredAt,
  aiSummary,
}: AlertCardProps) {
  return (
    <Card className="border-border shadow-soft">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TickerBadge ticker={ticker} />
              <span className="text-sm font-semibold text-text-primary">{companyName}</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{alertType.replace(/_/g, " ")}</p>
          </div>
          <div className="text-right text-xs text-text-muted">
            <p>{formatDateTime(triggeredAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Trigger</p>
            <p className="font-semibold text-text-primary">{formatPrice(triggerPrice)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Current</p>
            <p className="font-semibold text-text-primary">{formatPrice(currentPrice)}</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary line-clamp-2">{aiSummary}</p>
      </CardContent>
    </Card>
  );
}
