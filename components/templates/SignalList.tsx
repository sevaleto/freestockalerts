import { ExternalLink, Inbox } from "lucide-react";
import { formatDataTimestamp, maxScoreFor, signalAiContext, signalRows, type SignalLike } from "@/lib/strategies/present";

interface SignalListProps {
  signals: SignalLike[];
  /** When the scan last completed, if ever. */
  lastScanAt?: Date | string | null;
  strategyName: string;
  title?: string;
  className?: string;
  /** Rows to show per signal on compact layouts. */
  compact?: boolean;
}

/**
 * Real output of an event strategy: the most recent confirmed signals, each
 * with the facts the email carried. When there are none, says so plainly.
 */
export function SignalList({ signals, lastScanAt, strategyName, title = "Recent confirmed signals", className = "", compact = false }: SignalListProps) {
  const scanned = lastScanAt ? formatDataTimestamp(lastScanAt) : null;
  return (
    <div className={`rounded-[20px] border border-lp-border bg-white p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-semibold text-lp-navy">{title}</h2>
          <p className="mt-0.5 text-sm text-lp-muted">
            {scanned ? `Last scan ${scanned}.` : "No scan has completed yet."} Live output of the daily scan, not a sample.
          </p>
        </div>
        <span className="rounded-full bg-lp-mint px-3 py-1 text-xs font-semibold text-lp-teal">
          {signals.length === 0 ? "0 signals" : `${signals.length} signal${signals.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-lp-border/70 bg-lp-bg px-4 py-4 text-sm text-lp-navy/80">
          <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-lp-teal" aria-hidden />
          <p>
            No confirmed signals right now. {strategyName} only alerts when every rule holds, and that can mean days with nothing to send. Activate it and the next confirmed signal lands in your inbox.
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {signals.map((s) => {
            const rows = signalRows(s);
            const shown = compact ? rows.slice(0, 5) : rows;
            const max = maxScoreFor(s.strategySlug);
            return (
              <li key={`${s.strategySlug}-${s.symbol}-${String(s.createdAt ?? s.dataAsOf)}`} className="rounded-xl border border-lp-border/70 bg-lp-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 min-w-[3.5rem] items-center justify-center rounded-md bg-white px-2 font-mono text-xs font-bold text-lp-navy shadow-sm">{s.symbol}</span>
                    <span className="text-sm font-medium text-lp-navy">{s.companyName ?? s.symbol}</span>
                  </div>
                  <span className="text-xs text-lp-muted">
                    {formatDataTimestamp(s.createdAt ?? s.dataAsOf)}
                    {max ? ` · strength ${s.score}/${max}` : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-lp-navy">{s.explanation}</p>
                {!compact && signalAiContext(s) ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-lp-blue/15 bg-[#F1F6FD] p-3 text-sm leading-relaxed text-lp-navy/85">
                    {signalAiContext(s)!.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : null}
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {shown
                    .filter((r) => r.label !== "Company")
                    .map((r) => (
                      <div key={`${r.label}-${r.value}`} className="flex gap-2">
                        <dt className="shrink-0 text-lp-muted">{r.label}</dt>
                        <dd className="min-w-0 text-lp-navy">
                          {r.href ? (
                            <a href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-lp-teal underline underline-offset-2 hover:text-lp-teal-dark">
                              {r.value} <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : (
                            r.value
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-xs text-lp-muted">Source: SEC filings and analyst rating data via Financial Modeling Prep. Educational information only, not investment advice.</p>
    </div>
  );
}
