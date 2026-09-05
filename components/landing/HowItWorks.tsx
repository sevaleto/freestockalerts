import { Sparkles, MousePointerClick, BrainCircuit } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Pick a stock. Set a trigger.",
    description:
      "Type any ticker, choose from 12 alert types: price targets, RSI oversold, SMA crossovers, volume spikes, earnings reminders. Set your threshold. Takes 30 seconds.",
    icon: MousePointerClick,
    example: "\"Alert me when NVDA hits a new 52-week high or RSI drops below 30\"",
  },
  {
    step: "02",
    title: "Or activate a proven playbook.",
    description:
      "Don't know where to start? Nine curated templates give you a full set of pre-built alerts in one click: momentum breakouts, screened mid-cap radar, 200-day turnarounds, sector rotation, and more.",
    icon: Sparkles,
    example: "\"Activate Under-the-Radar Breakouts: 10 screened mid-caps, ready to go\"",
  },
  {
    step: "03",
    title: "Get context, not just a ping.",
    description:
      "When your alert fires, AI reads the volume, the 52-week range, and upcoming catalysts, then writes a two-sentence summary. You'll know what happened and what to watch before you open a chart.",
    icon: BrainCircuit,
    example: "\"AAPL hit a new 52-week high on 1.6x volume, 18 days before earnings. Traders watch for breakout continuation or a pre-earnings fade.\"",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-lp-border/70 bg-white py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">How it works</p>
          <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">From signup to first alert in three steps</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.step} className="rounded-[20px] border border-lp-border bg-lp-bg p-7">
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-bold text-lp-border">{step.step}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lp-mint text-lp-teal">
                  <step.icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-lp-navy">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-lp-navy/75">{step.description}</p>
              <div className="mt-4 rounded-xl border border-lp-border/70 bg-white px-4 py-3">
                <p className="text-xs italic text-lp-muted">{step.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
