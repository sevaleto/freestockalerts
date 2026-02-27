"use client";

import Link from "next/link";
import { mockTemplates } from "@/lib/mock/templates";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TemplatePreview() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
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
    <section id="templates" className="bg-surface py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Alert templates
            </p>
            <h2 className="text-3xl font-bold text-text-primary md:text-4xl">
              Pre-built strategies. One click to activate.
            </h2>
            <p className="text-base leading-relaxed text-slate-600">
              Each template sets up 10 alerts based on a specific investing strategy. 
              Customize any alert after activation.
            </p>
          </div>
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Browse all templates <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Show ALL 5 templates */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {mockTemplates.map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{template.iconEmoji}</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                  Preview →
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-text-primary group-hover:text-primary">
                {template.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">
                {template.description}
              </p>

              {/* Show 3 sample tickers from this template */}
              <div className="mt-4 flex flex-wrap gap-2">
                {template.items.slice(0, 4).map((item, i) => (
                  <span
                    key={`${item.ticker}-${i}`}
                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600"
                  >
                    {item.ticker}
                  </span>
                ))}
                {template.items.length > 4 && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-400">
                    +{template.items.length - 4} more
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                <span className="font-semibold">{template.items.length} alerts</span>
                <span className="uppercase tracking-widest">{template.category.replace("_", " ")}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Mid-page CTA */}
        <div className="mt-14 rounded-3xl bg-gradient-to-r from-primary to-blue-700 p-8 text-white md:p-10">
          <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <h3 className="text-2xl font-bold md:text-3xl">
                Activate 50 alerts in under 2 minutes
              </h3>
              <p className="mt-2 text-base text-white/80">
                Sign up, pick your templates, and you&apos;re covered. Every alert includes AI context so you always know why it fired.
              </p>
            </div>
            {!submitted ? (
              <form
                onSubmit={handleSignup}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-0 bg-white text-text-primary shadow-lg"
                  required
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 whitespace-nowrap bg-emerald-600 px-6 font-semibold shadow-lg hover:bg-emerald-700"
                >
                  {loading ? "Sending..." : "Get Started Free →"}
                </Button>
                {error && <p className="text-sm text-red-200">{error}</p>}
              </form>
            ) : (
              <div className="rounded-xl bg-white/10 p-4 text-center font-semibold">
                ✅ Check your inbox for a magic link!
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
