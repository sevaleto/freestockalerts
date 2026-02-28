"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/Logo";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2 } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !searchParams.get("error")) {
        window.location.href = "/dashboard";
      } else {
        setCheckingSession(false);
      }
    });
  }, [searchParams]);

  // Show error from URL params (e.g., expired magic link)
  useEffect(() => {
    const urlError = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    // Also check hash params (Supabase sometimes returns errors in hash)
    const hash = window.location.hash;
    if (hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const desc = params.get("error_description");
      if (desc) setError(desc.replace(/\+/g, " "));
    } else if (errorDesc) {
      setError(errorDesc);
    } else if (urlError === "auth_failed") {
      setError("Login link expired or was already used. Please request a new one.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/api/auth/callback`,
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

  if (checkingSession) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center py-8 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-text-secondary">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-white p-8 shadow-soft">
      {!submitted ? (
        <>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome to FreeStockAlerts
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            No password needed. We&apos;ll email you a secure login link every time.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {/* Google OAuth */}
          <div className="mt-6">
            <GoogleSignInButton label="Sign in with Google" />
          </div>

          <div className="relative mt-5 mb-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400">or</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            <Input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 border-2 text-base"
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        </>
      ) : (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-4 text-xl font-bold text-text-primary">Check your inbox!</h2>
          <p className="mt-2 text-sm text-slate-600">
            We sent a magic link to <strong>{email}</strong>.<br />
            Click it to access your dashboard.
          </p>
          <p className="mt-6 text-xs text-slate-400">
            Didn&apos;t get it? Check spam, or{" "}
            <button
              onClick={() => { setSubmitted(false); setEmail(""); setError(null); }}
              className="font-semibold text-primary underline"
            >
              try again
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
          ← Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <Suspense fallback={<div className="animate-pulse h-64 w-full max-w-md rounded-3xl bg-primary/10" />}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
