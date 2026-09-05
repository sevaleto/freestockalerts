import { describeTrigger, type DescribableItem } from "@/lib/alerts/describe";

interface AlertProofListProps {
  items: DescribableItem[];
  title: string;
  className?: string;
}

/** The template's alerts, rendered as concrete proof of what the visitor gets. */
export function AlertProofList({ items, title, className = "" }: AlertProofListProps) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {items.length} alerts
        </span>
      </div>
      <ol className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.ticker}-${item.alertType}-${i}`}
            className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
          >
            <span className="mt-0.5 inline-flex h-7 min-w-[3.5rem] shrink-0 items-center justify-center rounded-md bg-white px-2 font-mono text-xs font-bold text-text-primary shadow-sm">
              {item.ticker}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {item.companyName ? `${item.companyName} ` : ""}
                {describeTrigger(item)}
              </p>
              {item.rationale ? (
                <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{item.rationale}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
