import { BellPlus, Brain, Mail } from "lucide-react";

const steps = [
  {
    title: "Sign up with your email",
    description: "No password, no credit card. Just a magic link to get started.",
    icon: Mail,
  },
  {
    title: "Set alerts or activate a template",
    description: "Pick from dozens of alert types or activate proven strategies with one click.",
    icon: BellPlus,
  },
  {
    title: "Get notified with AI-powered context",
    description: "Every alert includes a clear summary of why it matters, not just a price.",
    icon: Brain,
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-surface py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
            How it works
          </p>
          <h2 className="text-3xl font-semibold text-text-primary md:text-4xl">
            Alerts in minutes, not hours
          </h2>
          <p className="text-base text-text-secondary">
            FreeStockAlerts.AI is built to save you time and help you respond faster to market moves.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-3xl border border-border bg-white p-6 shadow-soft">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
