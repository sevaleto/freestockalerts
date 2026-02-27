import { BadgeCheck, Bell, Brain, Sparkles } from "lucide-react";

const features = [
  {
    title: "125+ Alert Types",
    description:
      "Price, %, SMA, EMA, RSI, MACD, Volume, Earnings, 52-week highs/lows and more.",
    icon: Bell,
  },
  {
    title: "AI-Powered Summaries",
    description:
      "Every alert comes with a plain-English explanation of why it matters.",
    icon: Brain,
  },
  {
    title: "One-Click Templates",
    description:
      "Pre-built alert strategies: Earnings Season, Value Investing, Momentum, Dividends, Macro.",
    icon: Sparkles,
  },
  {
    title: "Actually Free",
    description: "No trials. No freemium bait. No credit card. Free forever.",
    icon: BadgeCheck,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
              Why traders switch
            </p>
            <h2 className="text-3xl font-semibold text-text-primary md:text-4xl">
              Smarter alerts without the price tag
            </h2>
            <p className="text-base text-text-secondary">
              We built FreeStockAlerts.AI to remove the friction from setting alerts and add context
              that explains what happened and what professionals watch next.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
            <p className="text-sm font-semibold text-text-secondary">What you get</p>
            <div className="mt-4 space-y-4">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{feature.title}</h3>
                    <p className="text-sm text-text-secondary">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
