import { CheckCircle2 } from "lucide-react";
import type { DescribableItem } from "@/lib/alerts/describe";
import type { WatchlistMetric } from "@/lib/lp/watchlistMetric";
import { formatPrice } from "@/lib/utils/formatters";

export interface WatchlistRow {
  item: DescribableItem;
  price?: number;
  metric?: WatchlistMetric | null;
}

interface WatchlistPreviewProps {
  rows: WatchlistRow[];
  title?: string;
}

/**
 * Compact watchlist: ticker, why it's on the list, current price, and how far
 * it is from its trigger. Rows are not links, so no chevrons.
 */
export function WatchlistPreview({ rows, title = "Watchlist preview" }: WatchlistPreviewProps) {
  return (
    <div className="rounded-[20px] border border-lp-border bg-white shadow-[0_12px_40px_-28px_rgba(7,27,60,0.25)]">
      <h2 className="sr-only">{title}</h2>
      <div
        className="hidden grid-cols-[auto_4.5rem_1fr_5.5rem_11rem] items-center gap-x-4 border-b border-lp-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-lp-muted sm:grid"
        aria-hidden
      >
        <span className="w-2.5" />
        <span>Ticker</span>
        <span>Why it&apos;s on the list</span>
        <span className="text-right">Price</span>
        <span className="text-right">Distance to trigger</span>
      </div>
      <ul className="divide-y divide-lp-border">
        {rows.map(({ item, price, metric }) => (
          <li
            key={`${item.ticker}-${item.alertType}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-4 py-3.5 sm:grid-cols-[auto_4.5rem_1fr_5.5rem_11rem] sm:gap-x-4 sm:px-5"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-lp-green" role="img" aria-label="Active alert" />
            <span className="font-sans text-base font-bold tracking-tight text-lp-navy">{item.ticker}</span>
            <span className="hidden text-sm leading-snug text-lp-navy/80 sm:line-clamp-2">{shortRationale(item)}</span>
            <span className="text-right text-sm font-medium tabular-nums text-lp-navy">
              {price !== undefined ? formatPrice(price) : "—"}
            </span>
            <span
              className={`hidden items-center justify-end gap-1 text-right text-sm font-semibold tabular-nums sm:flex ${
                metric?.met ? "text-lp-green" : "text-lp-navy"
              }`}
            >
              {metric?.met ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
              {metric?.label ?? "—"}
            </span>
            <span className="col-span-3 mt-1 pl-[1.375rem] text-xs leading-snug text-lp-muted sm:hidden">
              {shortRationale(item)}
              {metric ? (
                <>
                  {" · "}
                  <span className={metric.met ? "font-semibold text-lp-green" : "font-medium text-lp-navy"}>{metric.label}</span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Rationales read "TICKER at a new high — reason". The reason alone fits a row. */
export function shortRationale(item: DescribableItem): string {
  const r = item.rationale ?? "";
  const idx = r.indexOf(" — ");
  return capitalize((idx >= 0 ? r.slice(idx + 3) : r).trim());
}
