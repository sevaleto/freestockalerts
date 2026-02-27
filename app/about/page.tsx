import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo />
        <Link href="/login" className="text-sm font-semibold text-primary">
          Get started
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h1 className="text-3xl font-semibold text-text-primary md:text-4xl">
          A genuinely free alert platform built for traders
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          FreeStockAlerts.AI exists because real-time alerts shouldn&apos;t be locked behind paywalls.
          We monetize through optional newsletter sponsorships, so every alert feature is free.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text-primary">Our promise</h2>
            <p className="mt-2 text-sm text-text-secondary">
              No bait-and-switch pricing. No credit cards. No surprise upsells. You keep full access
              to every alert type, every template, and every AI summary.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text-primary">Built for clarity</h2>
            <p className="mt-2 text-sm text-text-secondary">
              We add context to every alert, so you understand what changed and what professionals
              watch next. It&apos;s the difference between reacting and responding.
            </p>
          </div>
        </div>
        <div className="mt-10 rounded-3xl border border-border bg-white p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-text-primary">Want early access?</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Join the list and help shape the roadmap for FreeStockAlerts.AI.
          </p>
          <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-primary">
            Join free →
          </Link>
        </div>
      </main>
    </div>
  );
}
