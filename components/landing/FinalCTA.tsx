"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSubmitted(true);
      setLoading(false);
    }
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
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-lg font-semibold">Get your first alert free</p>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-13 border-slate-600 bg-slate-700 text-base text-white placeholder:text-slate-400"
                  required
                />
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
                <p className="text-center text-xs text-slate-500">
                  Free forever. Unsubscribe anytime.
                </p>
              </form>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="mt-3 text-lg font-semibold">Check your inbox!</p>
                <p className="mt-1 text-sm text-slate-400">
                  We sent a magic link to <strong className="text-white">{email}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
