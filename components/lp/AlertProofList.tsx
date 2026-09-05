import { describeTrigger, type DescribableItem } from "@/lib/alerts/describe";

interface AlertProofListProps {
  items: DescribableItem[];
  title: string;
  className?: string;
  /** Two columns on wide screens for long lists. */
  columns?: 1 | 2;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Rationales read "TICKER at a new high — reason". The reason alone avoids restating the trigger. */
const shortRationale = (item: DescribableItem) => {
  const r = item.rationale ?? "";
  const idx = r.indexOf(" — ");
  return capitalize((idx >= 0 ? r.slice(idx + 3) : r).trim());
};

/** The template's alerts, rendered as concrete proof of what the visitor gets. */
export function AlertProofList({ items, title, className = "", columns = 1 }: AlertProofListProps) {
  const triggers = new Set(items.map(describeTrigger));
  const sharedTrigger = triggers.size === 1 ? capitalize(items[0] ? describeTrigger(items[0]) : "") : null;

  return (
    <div className={`rounded-[20px] border border-lp-border bg-white p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-semibold text-lp-navy">{title}</h2>
          {sharedTrigger ? (
            <p className="mt-0.5 text-sm text-lp-muted">
              Every alert fires when the stock <span className="font-medium text-lp-navy">{sharedTrigger.toLowerCase()}</span>.
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-lp-mint px-3 py-1 text-xs font-semibold text-lp-teal">{items.length} alerts</span>
      </div>
      <ol className={`mt-4 grid gap-2 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
        {items.map((item, i) => (
          <li
            key={`${item.ticker}-${item.alertType}-${i}`}
            className="flex gap-3 rounded-xl border border-lp-border/70 bg-lp-bg px-3 py-2.5"
          >
            <span className="mt-0.5 inline-flex h-7 min-w-[3.5rem] shrink-0 items-center justify-center rounded-md bg-white px-2 font-mono text-xs font-bold text-lp-navy shadow-sm">
              {item.ticker}
            </span>
            <div className="min-w-0">
              {sharedTrigger ? (
                <p className="text-sm leading-snug text-lp-navy">{shortRationale(item) || capitalize(describeTrigger(item))}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-lp-navy">
                    {item.companyName ? `${item.companyName} ` : ""}
                    {describeTrigger(item)}
                  </p>
                  {item.rationale ? <p className="mt-0.5 text-xs leading-relaxed text-lp-muted">{shortRationale(item)}</p> : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
