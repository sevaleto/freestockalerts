import { Bell, BrainCircuit, Clock, DollarSign } from "lucide-react";

const features = [
  {
    title: "One alert—not a flood",
    description:
      "Get alerted once when a level breaks, not every time it bounces around it. Daily-move and volume alerts email you at most once a day.",
    icon: Clock,
  },
  {
    title: "12 alert types",
    description:
      "Price targets, % moves, RSI, SMA crossovers, volume spikes, 52-week highs and lows, earnings reminders. Set the exact trigger you need.",
    icon: Bell,
  },
  {
    title: "Why it fired—in plain English",
    description:
      "Every triggered alert includes a two-sentence market context summary: volume vs. average, proximity to the 52-week range, upcoming catalysts, in plain English. AI-generated and educational only; always verify before you act.",
    icon: BrainCircuit,
  },
  {
    title: "Free. No asterisk.",
    description:
      "Not a trial. Not \"freemium.\" Not three alerts then pay. Every feature, every alert type, every template, $0 forever.",
    icon: DollarSign,
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-lp-border/70 bg-lp-bg py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Features</p>
          <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">The alerts you&apos;d expect from paid tools—free.</h2>
          <p className="text-base leading-relaxed text-lp-navy/75">With plain-English context included whenever an alert fires.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
