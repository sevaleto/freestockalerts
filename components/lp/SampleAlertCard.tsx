import { Info, Mail, TrendingUp } from "lucide-react";
import type { SampleAlert } from "@/lib/lp/pages";

/** Relative-volume bar. Reads as a fact ("1.6x average"), not a fabricated price chart. */
function VolumeBar({ multiple }: { multiple: number }) {
  const pct = Math.min(100, Math.round((multiple / 3) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-lp-muted">Volume vs. 30-day avg</span>
        <span className="font-mono text-lg font-bold text-lp-green">{multiple.toFixed(1)}x</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-lp-mint" role="img" aria-label={`${multiple.toFixed(1)} times average volume`}>
        <div className="h-full rounded-full bg-lp-green" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-lp-muted"><span>0x</span><span>avg</span><span>3x</span></div>
    </div>
  );
}

export function SampleAlertCard({ alert }: { alert: SampleAlert }) {
  const negative = alert.change.trim().startsWith("-");
  const changeColor = negative ? "text-danger" : "text-lp-green";
  const rows: Array<[string, string, string?, boolean?]> = [
    ["Alert type", alert.alertType, "text-lp-teal font-medium"],
    [alert.priceLabel, alert.price],
    ["Change", alert.change, `${changeColor} font-medium`],
    ["Time", alert.time, undefined, true],
    ["Volume", alert.volume],
    ["Market cap", alert.marketCap, undefined, true],
  ];

  return (
    <article
      aria-label={`Sample alert email for ${alert.ticker}`}
      className="overflow-hidden rounded-[20px] border border-lp-border bg-white shadow-[0_12px_40px_-24px_rgba(7,27,60,0.25)]"
    >
      {alert.subject ? (
        <div className="flex items-start gap-3 border-b border-lp-border bg-lp-bg px-5 py-3 text-xs text-lp-muted md:px-8">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-lp-teal" aria-hidden />
          <div className="min-w-0">
            <p><span className="font-semibold text-lp-navy">From:</span> FreeStockAlerts.AI &lt;alerts@freestockalerts.ai&gt;</p>
            <p className="truncate"><span className="font-semibold text-lp-navy">Subject:</span> {alert.subject}</p>
          </div>
          <span className="ml-auto shrink-0">{alert.time}</span>
        </div>
      ) : null}

      <div className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lp-teal text-white" aria-hidden>
              <TrendingUp className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <div>
              <p className="font-sans text-4xl font-bold leading-none tracking-tight text-lp-navy md:text-5xl">{alert.ticker}</p>
              {alert.companyName ? <p className="mt-1 text-sm text-lp-muted">{alert.companyName}</p> : null}
            </div>
          </div>
          <span className="rounded-md border border-lp-teal/30 bg-lp-mint px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-lp-navy">
            {alert.badge}
          </span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.35fr_1fr] md:gap-8">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[15px]">
            {rows.map(([label, value, cls, secondary]) => (
              <div key={label} className={secondary ? "hidden md:contents" : "contents"}>
                <dt className="text-lp-muted">{label}</dt>
                <dd className={`text-lp-navy ${cls ?? ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-lp-border pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            {alert.volumeMultiple ? <VolumeBar multiple={alert.volumeMultiple} /> : null}
            <p className="mt-4 text-base font-semibold text-lp-teal">{alert.whyTitle}</p>
            <p className="mt-1 text-lg leading-snug text-lp-navy">{alert.why}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-2xl border border-lp-blue/15 bg-[#F1F6FD] p-4">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lp-blue text-white" aria-hidden>
            <Info className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <div>
            <p className="text-base font-semibold text-lp-navy">Alert Context</p>
            <p className="mt-1 text-[15px] leading-relaxed text-lp-navy/80">{alert.context}</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-lp-muted">Illustrative example of an alert email. Not live market data. AI-generated context is educational only.</p>
      </div>
    </article>
  );
}
