export function Testimonials() {
  const rows = [
    { feature: "Price alerts", us: "Up to 50, free", them: "Limited on free plans" },
    { feature: "RSI, SMA, volume alerts", us: "Free", them: "Usually paid tiers" },
    { feature: "Plain-English context with each alert", us: "Every alert", them: "Rare" },
    { feature: "One-click strategy templates", us: "9", them: "Rare" },
    { feature: "Price", us: "$0, forever", them: "$10–$30 / mo" },
  ];
  const stats = [
    { stat: "12", label: "Alert types", sub: "Price, %, RSI, SMA, volume, and more" },
    { stat: "9", label: "Ready-made templates", sub: "10 alerts each, one click" },
    { stat: "5 min", label: "Check interval", sub: "During market hours" },
    { stat: "50", label: "Alerts per account", sub: "Not three, then a paywall" },
    { stat: "$0", label: "Forever", sub: "Not a trial. Not freemium." },
  ];

  return (
    <section id="testimonials" className="border-t border-lp-border/70 bg-white py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Compare</p>
          <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">What you&apos;d normally pay for this</h2>
          <p className="text-base leading-relaxed text-lp-navy/75">Same alerts. No tier to upgrade to.</p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-[20px] border border-lp-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-lp-border bg-lp-bg">
                <th className="px-3 py-4 sm:px-6 font-semibold text-lp-muted">Feature</th>
                <th className="px-3 py-4 sm:px-6 text-center font-semibold text-lp-teal">FreeStockAlerts.AI</th>
                <th className="px-3 py-4 sm:px-6 text-center font-semibold text-lp-muted">Typical paid alert tools</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-border">
              {rows.map((row) => (
                <tr key={row.feature}>
                  <td className="px-3 py-3.5 sm:px-6 font-medium text-lp-navy">{row.feature}</td>
                  <td className="px-3 py-3.5 sm:px-6 text-center font-medium text-lp-green">{row.us}</td>
                  <td className="px-3 py-3.5 sm:px-6 text-center text-lp-muted">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          {stats.map((item) => (
            <div key={item.label} className="rounded-[18px] border border-lp-border bg-lp-bg p-5 text-center">
              <p className="font-serif text-4xl text-lp-navy">{item.stat}</p>
              <p className="mt-1 text-sm font-semibold text-lp-navy">{item.label}</p>
              <p className="mt-0.5 text-xs text-lp-muted">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
