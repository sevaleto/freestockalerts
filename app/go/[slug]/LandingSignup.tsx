"use client";

import { useId, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { sendMagicLink } from "@/lib/auth/magicLink";
import { trackLead } from "@/lib/tracking/events";
import { useTurnstile } from "@/components/auth/useTurnstile";
import type { LandingPage } from "@/lib/lp/pages";

type Props = {
  lp: Pick<LandingPage, "slug" | "templateSlug" | "source" | "metaContentName" | "ctaLabel" | "googleLabel">;
};

const REASSURANCE = ["Free forever", "No credit card", "Unsubscribe anytime"];

export function LandingSignup({ lp }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const next = `/welcome/${lp.templateSlug}`;
  const turnstile = useTurnstile("light");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const result = await sendMagicLink(email, lp.source, next, await turnstile.waitForToken());
    if (!result.ok) {
      setError(result.message);
      turnstile.reset();
    } else {
      trackLead("email", email, lp.metaContentName);
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <CheckInboxCard
        email={email}
        source={lp.source}
        next={next}
        variant="light"
        purpose="signup"
        onChangeEmail={() => setSubmitted(false)}
        onUseSuggestion={(fixed) => { setEmail(fixed); setSubmitted(false); }}
      />
    );
  }

  return (
    <div id="signup" className="scroll-mt-24">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
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
          <EmailSuggestion email={email} onAccept={setEmail} className="mt-2" />
        </div>
        <turnstile.Widget />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-lp-teal text-lg font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Mail className="h-5 w-5" aria-hidden />
          {loading ? "Sending…" : lp.ctaLabel}
        </button>

        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger">{error}</p>
        )}
      </form>

      <GoogleSignInButton
        label={lp.googleLabel}
        className="mt-3 h-14 rounded-xl border-lp-border bg-white text-lg font-semibold text-lp-navy hover:bg-lp-bg"
        next={next}
        source={lp.source}
        contentName={lp.metaContentName}
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
  );
}
