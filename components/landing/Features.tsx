import { BarChart3, Bell, BrainCircuit, Clock, DollarSign, Layers, Shield, Zap } from "lucide-react";

const features = [
  {
    title: "12 Alert Types",
    description:
      "Price limits, % moves, RSI, SMA/EMA crossovers, volume spikes, 52-week highs/lows, earnings reminders. Set the exact trigger you need.",
    icon: Bell,
  },
  {
    title: "AI That Reads the Tape",
    description:
      "Every triggered alert includes a 2-sentence market context summary. Volume vs. average, proximity to 52-week range, upcoming catalysts — written in plain English.",
    icon: BrainCircuit,
  },
  {
    title: "One-Click Templates",
    description:
      "Activate 10 pre-set alerts instantly. Earnings season, Buffett value entries, momentum breakouts, dividend yield targets, market fear signals.",
    icon: Layers,
  },
  {
    title: "60-Second Setup",
    description:
      "No app to download. No passwords. Enter your email, click a magic link, set your first alert. That's it.",
    icon: Zap,
  },
  {
    title: "Free. No Asterisk.",
    description:
      "Not a trial. Not \"freemium.\" Not 3 alerts then pay. Every feature, every alert type, every template — $0 forever.",
    icon: DollarSign,
  },
  {
    title: "Smart Cooldowns",
    description:
      "Set cooldown windows so you don't get flooded. Get alerted once when a level breaks, not every time it bounces around it.",
    icon: Clock,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Features
          </p>
          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">
            Everything StockAlarm charges for. Free.
          </h2>
          <p className="text-base leading-relaxed text-slate-600">
            Plus AI-powered context they don&apos;t offer at any price.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-100 bg-white p-6 transition hover:border-slate-200 hover:shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-text-primary">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
