"use client";

import { useState, useId } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { sendMagicLink } from "@/lib/auth/magicLink";
import { trackLead } from "@/lib/tracking/events";
import { useTurnstile } from "@/components/auth/useTurnstile";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const turnstile = useTurnstile("dark");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const result = await sendMagicLink(email, "final-cta", undefined, await turnstile.waitForToken());
    if (!result.ok) {
      setError(result.message);
      turnstile.reset();
    } else {
      trackLead("email", email, "home_final_cta");
      setSubmitted(true);
    }
    setLoading(false);
  };

  return (
    <section className="bg-lp-navy py-20 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="font-serif text-3xl leading-tight md:text-[2.75rem]">
              Your next trade shouldn&apos;t catch you off guard.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/75">
              Set your alerts tonight. Wake up to AI-powered market context tomorrow.
              No credit card. No commitment. Just better information.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-[15px] text-white/85">
              {[
                "12 alert types including RSI, SMA, volume, and earnings",
                "AI summary with every triggered alert",
                "9 one-click templates, screened from market data",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-lp-mint" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/5 p-6 md:p-8">
            {!submitted ? (
              <div className="space-y-3">
                <p className="text-lg font-semibold">Get your first alert free</p>
                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                  <label htmlFor={inputId} className="sr-only">Email address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" aria-hidden />
                    <input
                      id={inputId}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-14 w-full rounded-xl border border-white/20 bg-white/10 pl-12 pr-4 text-lg text-white placeholder:text-white/50 transition focus:border-lp-mint focus:outline-none focus:ring-2 focus:ring-lp-mint/40"
                    />
                  </div>
                  <EmailSuggestion email={email} onAccept={setEmail} variant="dark" />
                  <turnstile.Widget />
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-lp-teal text-lg font-semibold text-white transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-mint disabled:opacity-70"
                  >
                    <Mail className="h-5 w-5" aria-hidden />
                    {loading ? "Sending…" : "Get my first alert"}
                  </button>
                  {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                </form>
                <GoogleSignInButton
                  label="Continue with Google"
                  className="h-12 rounded-xl border-white/20 bg-white/10 text-base font-medium text-white hover:bg-white/20"
                  source="final-cta"
                  contentName="home_final_cta"
                />
                <p className="text-center text-xs text-white/60">Free forever. Unsubscribe anytime.</p>
              </div>
            ) : (
              <CheckInboxCard
                email={email}
                source="final-cta"
                variant="dark"
                purpose="signup"
                onChangeEmail={() => setSubmitted(false)}
                onUseSuggestion={(fixed) => { setEmail(fixed); setSubmitted(false); }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
