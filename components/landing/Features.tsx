import { Bell, BrainCircuit, Clock, DollarSign, Layers, Zap } from "lucide-react";

const features = [
  {
    title: "12 alert types",
    description:
      "Price limits, % moves, RSI, SMA crossovers, volume spikes, 52-week highs and lows, earnings reminders. Set the exact trigger you need.",
    icon: Bell,
  },
  {
    title: "AI that reads the tape",
    description:
      "Every triggered alert includes a two-sentence market context summary: volume vs. average, proximity to the 52-week range, upcoming catalysts, in plain English.",
    icon: BrainCircuit,
  },
  {
    title: "One-click templates",
    description:
      "Activate 10 pre-set alerts instantly. Momentum breakouts, screened mid-cap radar, 200-day turnarounds, oversold leaders, sector rotation, and more.",
    icon: Layers,
  },
  {
    title: "60-second setup",
    description:
      "No app to download. No passwords. Enter your email, click the link or type the code, set your first alert. That's it.",
    icon: Zap,
  },
  {
    title: "Free. No asterisk.",
    description:
      "Not a trial. Not \"freemium.\" Not three alerts then pay. Every feature, every alert type, every template, $0 forever.",
    icon: DollarSign,
  },
  {
    title: "No alert spam",
    description:
      "Get alerted once when a level breaks, not every time it bounces around it. Daily-move and volume alerts email you at most once a day.",
    icon: Clock,
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-lp-border/70 bg-lp-bg py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Features</p>
          <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">Everything the paid tools charge for. Free.</h2>
          <p className="text-base leading-relaxed text-lp-navy/75">Plus AI-powered context they don&apos;t offer at any price.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-[18px] border border-lp-border bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lp-mint">
                <feature.icon className="h-5 w-5 text-lp-teal" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold text-lp-navy">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-lp-navy/75">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
