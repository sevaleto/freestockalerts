"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
import { sendMagicLink } from "@/lib/auth/magicLink";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { trackLead } from "@/lib/tracking/events";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    const result = await sendMagicLink(email, "final-cta");
    if (!result.ok) {
      setError(result.message);
    } else {
      trackLead("email", email);
      setSubmitted(true);
    }
    setLoading(false);
  };

  return (
    <section className="bg-slate-900 py-20 text-white">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">
              Your next trade shouldn&apos;t catch you off guard.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Set your alerts tonight. Wake up to AI-powered market context tomorrow.
              No credit card. No commitment. Just better information.
            </p>
            <div className="mt-6 flex flex-col gap-3 text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                12 alert types including RSI, SMA, volume, and earnings
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                AI summary with every triggered alert
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                5 one-click templates — 50 alerts in 2 minutes
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800 p-8">
            {!submitted ? (
              <div className="space-y-4">
                <p className="text-lg font-semibold">Get your first alert free</p>
                <GoogleSignInButton label="Sign up with Google" dark />
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-600" />
                  <span className="text-xs text-slate-500">or use email</span>
                  <div className="h-px flex-1 bg-slate-600" />
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-13 border-slate-600 bg-slate-700 text-base text-white placeholder:text-slate-400"
                    required
                  />
                  <EmailSuggestion email={email} onAccept={setEmail} variant="dark" />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-13 w-full bg-emerald-600 text-base font-semibold shadow-lg hover:bg-emerald-700"
                  >
                    {loading ? "Sending..." : "Get Your First Alert →"}
                  </Button>
                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                </form>
                <p className="text-center text-xs text-slate-500">
                  Free forever. Unsubscribe anytime.
                </p>
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
