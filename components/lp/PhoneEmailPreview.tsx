import { BatteryFull, ChevronLeft, Info, Signal, Wifi, Archive, Trash2, Reply, MoreHorizontal } from "lucide-react";
import type { SampleAlert } from "@/lib/lp/pages";

/**
 * The sample alert rendered as an email open in Mail on an iPhone.
 * Pure CSS frame; no images. Everything inside is the same illustrative
 * SampleAlert data the card uses.
 */
export function PhoneEmailPreview({ alert }: { alert: SampleAlert }) {
  const negative = alert.change.trim().startsWith("-");
  const changeColor = negative ? "text-danger" : "text-lp-green";
  const volumePct = alert.volumeMultiple ? Math.min(100, Math.round((alert.volumeMultiple / 3) * 100)) : 0;

  return (
    <figure className="mx-auto w-full max-w-[380px]">
      <div
        className="relative rounded-[52px] border-[10px] border-[#111214] bg-[#111214] shadow-[0_30px_60px_-30px_rgba(7,27,60,0.45)]"
        aria-label={`Sample alert email for ${alert.ticker}, shown on a phone`}
        role="img"
      >
        {/* Dynamic island */}
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-10 h-7 w-28 -translate-x-1/2 rounded-full bg-[#111214]" aria-hidden />

        <div className="overflow-hidden rounded-[42px] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between px-7 pb-1 pt-3.5 text-[13px] font-semibold text-lp-navy" aria-hidden>
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <Signal className="h-3.5 w-3.5" />
              <Wifi className="h-3.5 w-3.5" />
              <BatteryFull className="h-4 w-4" />
            </span>
          </div>

          {/* Mail toolbar */}
          <div className="flex items-center justify-between px-4 pb-2 pt-1 text-lp-blue" aria-hidden>
            <span className="flex items-center gap-0.5 text-[15px]">
              <ChevronLeft className="h-5 w-5" /> Inbox
            </span>
            <span className="flex items-center gap-4 text-lp-blue">
              <Archive className="h-4.5 w-4.5" />
              <Trash2 className="h-4.5 w-4.5" />
              <Reply className="h-4.5 w-4.5" />
              <MoreHorizontal className="h-4.5 w-4.5" />
            </span>
          </div>

          {/* Email header */}
          <div className="border-b border-lp-border px-4 pb-3 pt-1">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lp-teal text-base font-bold text-white" aria-hidden>
                F
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-lp-navy">FreeStockAlerts.AI</p>
                <p className="text-xs text-lp-muted">to me ›</p>
              </div>
              <span className="shrink-0 text-xs text-lp-muted">{alert.time}</span>
            </div>
            <p className="mt-3 text-[15px] font-semibold leading-snug text-lp-navy">
              {alert.subject ?? `${alert.ticker} alert: ${alert.badge}`}
            </p>
          </div>

          {/* Email body */}
          <div className="space-y-4 px-4 py-4 text-lp-navy">
            <span className="inline-block rounded-md border border-lp-teal/30 bg-lp-mint px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
              {alert.badge}
            </span>
            <div>
              <p className="font-sans text-4xl font-bold leading-none tracking-tight">{alert.ticker}</p>
              {alert.companyName ? <p className="mt-1 text-sm text-lp-muted">{alert.companyName}</p> : null}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-lp-bg p-3 text-sm">
              <div><dt className="text-xs text-lp-muted">{alert.priceLabel}</dt><dd className="font-medium">{alert.price}</dd></div>
              <div><dt className="text-xs text-lp-muted">Change</dt><dd className={`font-medium ${changeColor}`}>{alert.change}</dd></div>
              <div><dt className="text-xs text-lp-muted">Volume</dt><dd className="font-medium">{alert.volume}</dd></div>
              <div><dt className="text-xs text-lp-muted">Alert type</dt><dd className="font-medium text-lp-teal">{alert.alertType}</dd></div>
            </dl>

            {alert.volumeMultiple ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-lp-muted">Volume vs. 30-day avg</span>
                  <span className="font-mono text-base font-bold text-lp-green">{alert.volumeMultiple.toFixed(1)}x</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-lp-mint" aria-hidden>
                  <div className="h-full rounded-full bg-lp-green" style={{ width: `${volumePct}%` }} />
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-sm font-semibold text-lp-teal">{alert.whyTitle}</p>
              <p className="mt-0.5 text-[15px] leading-snug">{alert.why}</p>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-lp-blue/15 bg-[#F1F6FD] p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lp-blue text-white" aria-hidden>
                <Info className="h-3 w-3" strokeWidth={3} />
              </span>
              <div>
                <p className="text-sm font-semibold">Alert Context</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-lp-navy/80">{alert.context}</p>
              </div>
            </div>

            <span className="flex h-11 w-full items-center justify-center rounded-xl bg-lp-teal text-[15px] font-semibold text-white" aria-hidden>
              View alert →
            </span>
            <p className="text-[11px] leading-relaxed text-lp-muted">
              You&apos;re receiving this because you set an alert for {alert.ticker} on FreeStockAlerts.AI. Educational information only.
            </p>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1" aria-hidden>
            <span className="h-1.5 w-32 rounded-full bg-[#111214]/85" />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-lp-muted">
        Illustrative example of an alert email. Not live market data. AI-generated context is educational only.
      </figcaption>
    </figure>
  );
}
