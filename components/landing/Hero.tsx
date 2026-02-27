import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/Logo";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-16 pt-10 md:pt-16">
        <nav className="flex items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-6 text-sm font-medium text-text-secondary md:flex">
            <a href="#how" className="hover:text-text-primary">
              How it works
            </a>
            <a href="#features" className="hover:text-text-primary">
              Features
            </a>
            <a href="#templates" className="hover:text-text-primary">
              Templates
            </a>
            <a href="#testimonials" className="hover:text-text-primary">
              Proof
            </a>
          </div>
          <Button asChild variant="outline">
            <a href="/login">Log in</a>
          </Button>
        </nav>

        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
              100% Free • No credit card • AI context
            </div>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight text-text-primary md:text-6xl">
                Free Stock Alerts. Forever.
              </h1>
              <p className="max-w-xl text-lg text-text-secondary md:text-xl">
                Get real-time price alerts with AI-powered insights delivered to your inbox. No credit
                card. No paid tiers. Just sign up and go.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-12 max-w-sm bg-white"
              />
              <Button className="h-12 px-8 text-base">
                Get Started Free →
              </Button>
            </div>
            <p className="text-sm text-text-muted">
              Join 0 traders already using FreeStockAlerts
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-white p-6 shadow-soft">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-secondary">Live alert example</span>
                <span className="text-xs text-text-muted">Updated just now</span>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xl font-semibold">AAPL • Price Above</p>
                    <p className="text-sm text-text-secondary">Trigger: $230.00</p>
                  </div>
                  <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    Active
                  </span>
                </div>
                <p className="mt-4 text-sm text-text-secondary">
                  AAPL broke above $230 on 1.6x average volume, now trading within 3% of its 52-week high.
                  Traders watch whether the breakout holds into earnings.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: "Price", value: "$223.45" },
                  { label: "Day Change", value: "+1.06%" },
                  { label: "Volume", value: "58.9M" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-white px-4 py-3 text-center"
                  >
                    <p className="text-xs uppercase tracking-wide text-text-muted">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-text-primary">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
