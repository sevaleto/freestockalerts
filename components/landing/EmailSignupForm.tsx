"use client";

import { useId, useState } from "react";
import { Mail } from "lucide-react";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { sendMagicLink } from "@/lib/auth/magicLink";
import { trackLead } from "@/lib/tracking/events";

interface EmailSignupFormProps {
  source: string;
  contentName: string;
  ctaLabel?: string;
  next?: string;
  /** Single-row layout for narrow bands. */
  inline?: boolean;
  className?: string;
}

/** The email-only signup used by mid-page bands. Same handlers as the hero. */
export function EmailSignupForm({ source, contentName, ctaLabel = "Get my first alert", next, inline = false, className = "" }: EmailSignupFormProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const result = await sendMagicLink(email, source, next);
    if (!result.ok) setError(result.message);
    else {
      trackLead("email", email, contentName);
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <CheckInboxCard
        email={email}
        source={source}
        next={next}
        variant="light"
        purpose="signup"
        onChangeEmail={() => setSubmitted(false)}
        onUseSuggestion={(fixed) => { setEmail(fixed); setSubmitted(false); }}
        className={className}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-2 ${className}`} noValidate>
      <div className={inline ? "flex flex-col gap-3 sm:flex-row" : "space-y-3"}>
        <label htmlFor={inputId} className="sr-only">Email address</label>
        <div className="relative flex-1">
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
            className="h-14 w-full rounded-xl border border-lp-border bg-white pl-12 pr-4 text-lg text-lp-navy placeholder:text-lp-muted/70 shadow-sm transition focus:border-lp-teal focus:outline-none focus:ring-2 focus:ring-lp-teal/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-lp-teal px-7 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2 disabled:opacity-70"
        >
          {loading ? "Sending…" : ctaLabel}
        </button>
      </div>
      <EmailSuggestion email={email} onAccept={setEmail} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
