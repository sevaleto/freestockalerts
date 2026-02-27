import { Sparkles, MousePointerClick, BrainCircuit } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Pick a stock. Set a trigger.",
    description:
      "Type any ticker, choose from 12 alert types — price targets, RSI oversold, SMA crossovers, volume spikes, earnings reminders — and set your threshold. Takes 30 seconds.",
    icon: MousePointerClick,
    example: "\"Alert me when NVDA drops below $800 or RSI hits 30\"",
  },
  {
    step: "02",
    title: "Or activate a proven playbook.",
    description:
      "Don't know where to start? Our curated templates give you 10 pre-built alerts in one click. Earnings season, Buffett-style value entries, momentum breakouts, dividend yield targets.",
    icon: Sparkles,
    example: "\"Activate the Value Watchlist — 10 blue-chip buy zones, ready to go\"",
  },
  {
    step: "03",
    title: "Get context, not just a ping.",
    description:
      "When your alert fires, AI reads the volume, the 52-week range, upcoming catalysts, and writes a 2-sentence summary. You'll know what happened and what to watch — before you open a chart.",
    icon: BrainCircuit,
    example: "\"AAPL broke $230 on 1.6× volume, 18 days before earnings. Traders watch for breakout continuation or pre-earnings fade.\"",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-surface py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            How it works
          </p>
          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">
            From signup to first alert in 60 seconds
          </h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.step}
              className="group relative rounded-3xl border border-slate-200 bg-white p-7 shadow-soft transition hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-bold text-slate-200">{step.step}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-bold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs italic text-slate-500">{step.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
