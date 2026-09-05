import { Info, TrendingUp } from "lucide-react";
import type { SampleAlert } from "@/lib/lp/pages";

/** Simple green sparkline. Purely decorative. */
function Sparkline({ negative = false }: { negative?: boolean }) {
  const points = negative
    ? "0,14 22,20 40,16 58,30 76,26 96,40 118,36 140,52 162,46 184,60 206,56 228,70"
    : "0,70 22,58 40,64 58,44 76,50 96,36 118,42 140,26 162,32 184,18 206,24 228,6";
  const color = negative ? "#DC2626" : "#07875F";
  return (
    <svg viewBox="0 0 228 76" className="h-20 w-full" aria-hidden focusable="false">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 228,76 0,76`} fill="url(#spark-fill)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={negative ? 228 : 228} cy={negative ? 70 : 6} r="4" fill={color} />
    </svg>
  );
}

export function SampleAlertCard({ alert }: { alert: SampleAlert }) {
  const negative = alert.change.trim().startsWith("-");
  const changeColor = negative ? "text-danger" : "text-lp-green";
  const rows: Array<[string, string, string?]> = [
    ["Alert type", alert.alertType, "text-lp-teal font-medium"],
    [alert.priceLabel, alert.price],
    ["Change", alert.change, `${changeColor} font-medium`],
    ["Time", alert.time],
    ["Volume", alert.volume],
    ["Market cap", alert.marketCap],
  ];

  return (
    <article
      aria-label={`Sample alert for ${alert.ticker}`}
      className="rounded-[20px] border border-lp-border bg-white p-6 shadow-[0_12px_40px_-24px_rgba(7,27,60,0.25)] md:p-8"
    >
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
          {rows.map(([label, value, cls]) => (
            <div key={label} className="contents">
              <dt className="text-lp-muted">{label}</dt>
              <dd className={`text-lp-navy ${cls ?? ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-lp-border pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <Sparkline negative={negative} />
          <p className="mt-3 text-base font-semibold text-lp-teal">{alert.whyTitle}</p>
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

      <p className="mt-4 text-xs text-lp-muted">Illustrative example of an alert email. Not live market data.</p>
    </article>
  );
}
