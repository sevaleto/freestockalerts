"use client";

import { useState, useEffect, useId } from "react";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { SampleAlertCard } from "@/components/lp/SampleAlertCard";
import { sendMagicLink } from "@/lib/auth/magicLink";
import { trackLead } from "@/lib/tracking/events";
import { ACTIVE_TESTS, HERO_HEADLINES } from "@/lib/ab/variants";
import { usePendingTemplate } from "@/lib/landing/pendingTemplate";
import { X } from "lucide-react";
import { assignVariant } from "@/lib/ab/assign";
import type { SampleAlert } from "@/lib/lp/pages";

const HOME_SAMPLE: SampleAlert = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  subject: "AAPL broke above $230 — here's what moved it",
  volumeMultiple: 1.6,
  badge: "Price above $230",
  alertType: "Price Alert",
  priceLabel: "Price",
  price: "$231.42",
  change: "+1.06%",
  time: "10:12 AM ET",
  volume: "58.9M (1.6x avg)",
  marketCap: "$3.5T",
  whyTitle: "Why it triggered",
  why: "Broke $230 on 1.6x average volume",
  context:
    "AAPL broke above $230 on 1.6x average volume and is within 3% of its 52-week high, 18 days before earnings. Traders watch whether breakouts near highs hold into earnings or fade on profit-taking.",
};

const REASSURANCE = ["Free forever", "No credit card", "Unsubscribe anytime"];

export function Hero() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<string>("A");
  const inputId = useId();
  const errorId = useId();
  const [pending, setPending] = usePendingTemplate();
  const next = pending ? `/welcome/${pending.slug}` : undefined;

  useEffect(() => {
    setVariant(assignVariant(ACTIVE_TESTS.hero_headline));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const result = await sendMagicLink(email, "hero", next);
    if (!result.ok) {
      setError(result.message);
    } else {
      trackLead("email", email, "home_hero");
      setSubmitted(true);
    }
    setLoading(false);
  };

  const headline = HERO_HEADLINES[variant];

  return (
    <section className="relative overflow-hidden bg-lp-bg">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-16 pt-6 sm:px-8 md:pt-8 lg:px-12 lg:pb-24">
        <nav className="flex items-center justify-between gap-3" aria-label="Primary">
          <Logo size="lg" />
          <div className="hidden items-center gap-7 text-sm font-medium text-text-secondary md:flex">
            <a href="#how" className="hover:text-text-primary">How it works</a>
            <a href="#features" className="hover:text-text-primary">Features</a>
            <a href="#templates" className="hover:text-text-primary">Templates</a>
          </div>
          <Link
            href="/login"
            className="shrink-0 whitespace-nowrap text-sm font-medium text-lp-muted underline-offset-4 hover:text-lp-navy hover:underline md:inline-flex md:h-10 md:items-center md:rounded-xl md:border md:border-lp-border md:bg-white md:px-4 md:font-semibold md:text-lp-navy md:no-underline md:hover:bg-lp-mint"
          >
            Log in
          </Link>
        </nav>

        <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-[44fr_56fr] lg:gap-14 xl:gap-20">
          <div className="flex flex-col">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-lp-blue sm:text-sm sm:tracking-[0.18em]">
              Free forever • Set up in 60 seconds
            </p>
            <h1 className="mt-4 font-serif text-[clamp(2.625rem,10vw,3.25rem)] leading-[1.02] tracking-[-0.01em] text-lp-navy md:text-[clamp(3.25rem,4.45vw,4.5rem)] lg:-mr-10 xl:-mr-16">
              {headline.line1}
              <br />
              <span className="text-lp-teal">{headline.line2}</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-xl leading-relaxed text-lp-navy/80 md:text-[1.3rem]">{headline.sub}</p>

            <div className="mt-7">
              {!submitted ? (
                <div id="signup" className="scroll-mt-24">
                  {pending ? (
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-lp-teal/30 bg-lp-mint px-4 py-2.5 text-sm text-lp-navy">
                      <span>
                        <span className="font-semibold">Activating:</span> {pending.name}. Where should I send it?
                      </span>
                      <button type="button" onClick={() => setPending(null)} className="text-lp-muted hover:text-lp-navy" aria-label="Clear selected template">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                    <label htmlFor={inputId} className="sr-only">Email address</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-lp-muted" aria-hidden />
                      <input
                        id={inputId}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        aria-invalid={!!error}
                        aria-describedby={error ? errorId : undefined}
                        className="h-14 w-full rounded-xl border border-lp-border bg-white pl-12 pr-4 text-lg text-lp-navy placeholder:text-lp-muted/70 shadow-sm transition focus:border-lp-teal focus:outline-none focus:ring-2 focus:ring-lp-teal/30"
                      />
                    </div>
                    <EmailSuggestion email={email} onAccept={setEmail} />
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-lp-teal text-lg font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Mail className="h-5 w-5" aria-hidden />
                      {loading ? "Sending…" : "Get my first alert"}
                    </button>
                    {error && <p id={errorId} role="alert" className="text-sm text-danger">{error}</p>}
                  </form>
                  <GoogleSignInButton
                    label="Continue with Google"
                    className="mt-3 h-12 rounded-xl border-lp-border bg-white text-base font-medium text-lp-navy hover:bg-lp-bg"
                    source="hero"
                    contentName="home_hero"
                    next={next}
                  />
                  <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-lp-navy sm:gap-x-2" aria-label="Reassurance">
                    {REASSURANCE.map((item, i) => (
                      <li key={item} className="flex items-center gap-2">
                        {i > 0 ? <span className="mr-2 hidden text-lp-muted sm:inline" aria-hidden>·</span> : null}
                        <CheckCircle2 className="h-5 w-5 text-lp-green" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <CheckInboxCard
                  email={email}
                  source="hero"
                  next={next}
                  variant="light"
                  purpose="signup"
                  onChangeEmail={() => setSubmitted(false)}
                  onUseSuggestion={(fixed) => { setEmail(fixed); setSubmitted(false); }}
                />
              )}
            </div>
            <p className="mt-8 hidden text-sm text-lp-muted lg:block">Educational information only. Not investment advice.</p>
          </div>

          <div className="flex flex-col gap-4">
            <SampleAlertCard alert={HOME_SAMPLE} />
            <p className="text-sm text-lp-muted lg:hidden">Educational information only. Not investment advice.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
