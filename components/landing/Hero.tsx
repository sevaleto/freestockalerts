"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/Logo";
import { CheckCircle2, Zap, Shield, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export function Hero() {
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
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-hero-glow" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-12 pt-6 md:gap-14 md:pb-16 md:pt-10">
        {/* Nav */}
        <nav className="flex items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-6 text-sm font-medium text-text-secondary md:flex">
            <a href="#how" className="hover:text-text-primary">How it works</a>
            <a href="#features" className="hover:text-text-primary">Features</a>
            <a href="#templates" className="hover:text-text-primary">Templates</a>
          </div>
          <Button asChild variant="outline">
            <a href="/login">Log in</a>
          </Button>
        </nav>

        {/* Hero content */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            {/* Urgency badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
              <Zap className="h-3.5 w-3.5" />
              Early access — first 5,000 users get priority alert delivery
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-text-primary md:text-[3.5rem]">
                Stop missing trades.<br />
                <span className="text-primary">Start getting context.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600 md:text-xl">
                Every alert tells you <strong>what happened</strong> and <strong>what pros watch next</strong> — 
                not just a price ping. Set up in 60 seconds, free forever.
              </p>
            </div>

            {/* Signup */}
            {!submitted ? (
              <div className="space-y-3">
                {/* Google OAuth — primary CTA */}
                <GoogleSignInButton
                  label="Sign up with Google"
                  className="sm:max-w-sm shadow-lg"
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
                      className="h-13 border-2 border-slate-300 bg-white text-base shadow-sm focus:border-primary sm:max-w-sm"
                      required
                    />
                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-13 bg-emerald-600 px-8 text-base font-semibold shadow-lg hover:bg-emerald-700"
                    >
                      {loading ? "Sending..." : "Get Your First Alert →"}
                    </Button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </form>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No paid tiers, ever</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Unsubscribe anytime</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-900">Check your inbox!</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      We sent a magic link to <strong>{email}</strong>. Click it to set up your first alert.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live alert preview card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Live alert example
                </span>
                <span className="text-xs text-text-muted">Just now</span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-bold text-text-primary">AAPL</span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        Price Above $230
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Apple Inc.</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold text-emerald-600">$231.42</p>
                    <p className="font-mono text-xs text-emerald-600">+1.06%</p>
                  </div>
                </div>

                {/* AI Context - the differentiator */}
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">AI Context</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    AAPL broke above $230 on <strong>1.6× average volume</strong>, now within 3% of its 52-week high. 
                    Earnings are <strong>18 days away</strong>. Traders watch whether breakouts near all-time highs hold into earnings or fade on profit-taking.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Volume", value: "58.9M", sub: "1.6× avg" },
                  { label: "52-Wk Range", value: "$164 – $237", sub: "Near high" },
                  { label: "Next Earnings", value: "May 1", sub: "18 days" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">{item.label}</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-text-primary">{item.value}</p>
                    <p className="text-[10px] text-slate-400">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 border-t border-slate-100 pt-8 md:gap-10">
          {[
            { icon: TrendingUp, text: "12 alert types", sub: "Price, %, RSI, SMA, volume, earnings" },
            { icon: Zap, text: "AI-powered context", sub: "Every alert explains why it matters" },
            { icon: Shield, text: "Free forever", sub: "No credit card required" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <item.icon className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{item.text}</p>
                <p className="text-xs text-slate-500">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
