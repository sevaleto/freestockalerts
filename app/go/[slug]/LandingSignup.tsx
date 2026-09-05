"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { sendMagicLink } from "@/lib/auth/magicLink";
import { trackLead } from "@/lib/tracking/events";
import type { LandingPage } from "@/lib/lp/pages";

type Props = {
  lp: Pick<LandingPage, "slug" | "templateSlug" | "source" | "metaContentName" | "ctaLabel">;
};

export function LandingSignup({ lp }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = `/welcome/${lp.templateSlug}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const result = await sendMagicLink(email, lp.source, next);
    if (!result.ok) {
      setError(result.message);
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
    <div className="space-y-3">
      <GoogleSignInButton
        label="Sign up with Google"
        className="sm:max-w-sm shadow-lg"
        next={next}
        source={lp.source}
        contentName={lp.metaContentName}
      />
      <div className="flex items-center gap-3 sm:max-w-sm">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">or use email</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 border-2 border-slate-300 bg-white text-base shadow-sm focus:border-primary sm:max-w-sm"
            required
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-12 bg-emerald-600 px-8 text-base font-semibold shadow-lg hover:bg-emerald-700"
          >
            {loading ? "Sending..." : lp.ctaLabel}
          </Button>
        </div>
        <EmailSuggestion email={email} onAccept={setEmail} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No paid tiers, ever</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Unsubscribe anytime</span>
      </div>
    </div>
  );
}
