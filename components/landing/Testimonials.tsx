import { Star, ArrowRight } from "lucide-react";

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-white py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        {/* Comparison table instead of fake testimonials */}
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Why switch
          </p>
          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">
            More features. Zero cost.
          </h2>
          <p className="text-base leading-relaxed text-slate-600">
            See how FreeStockAlerts.AI compares to the leading paid platform.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 font-semibold text-slate-600">Feature</th>
                <th className="px-6 py-4 text-center">
                  <div className="font-bold text-primary">FreeStockAlerts.AI</div>
                </th>
                <th className="px-6 py-4 text-center">
                  <div className="font-semibold text-slate-400">StockAlarm</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { feature: "Price alerts", us: "✅ Unlimited", them: "✅ Limited free" },
                { feature: "Technical alerts (RSI, SMA)", us: "✅ Free", them: "💰 Premium only" },
                { feature: "Volume spike alerts", us: "✅ Free", them: "💰 Premium only" },
                { feature: "AI-powered context", us: "✅ Every alert", them: "❌ Not available" },
                { feature: "One-click templates", us: "✅ 5 strategies", them: "❌ Not available" },
                { feature: "Email delivery", us: "✅ Free", them: "✅ Free" },
                { feature: "SMS/Call alerts", us: "🔜 Coming soon", them: "💰 Premium only" },
                { feature: "Price", us: "$0/forever", them: "$9.99–$29.99/mo" },
              ].map((row) => (
                <tr key={row.feature} className="hover:bg-slate-50">
                  <td className="px-6 py-3.5 font-medium text-text-primary">{row.feature}</td>
                  <td className="px-6 py-3.5 text-center text-emerald-700 font-medium">{row.us}</td>
                  <td className="px-6 py-3.5 text-center text-slate-500">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats bar */}
        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {[
            { stat: "12", label: "Alert types", sub: "Price, %, RSI, SMA, volume & more" },
            { stat: "5", label: "Ready-made templates", sub: "50 alerts with one click" },
            { stat: "60s", label: "To first alert", sub: "Email signup, no passwords" },
            { stat: "$0", label: "Forever", sub: "Not a trial. Not freemium." },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="font-mono text-4xl font-bold text-primary">{item.stat}</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{item.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
