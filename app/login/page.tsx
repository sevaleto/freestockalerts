"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/Logo";
import { createClient } from "@/lib/supabase/client";
import { sendMagicLink, clientSafeNext } from "@/lib/auth/magicLink";
import { EmailSuggestion } from "@/components/auth/EmailSuggestion";
import { CheckInboxCard } from "@/components/auth/CheckInboxCard";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { trackLead } from "@/lib/tracking/events";

const REASON_MESSAGES: Record<string, string> = {
  otp_expired: "That link has expired or was already used. Request a fresh one below.",
  bad_code_verifier:
    "That link was opened in a different browser than the one you signed up in. Request a new link below and open it here, or use the one-time code.",
  flow_state_not_found:
    "That link was opened in a different browser than the one you signed up in. Request a new link below and open it here, or use the one-time code.",
  flow_state_expired: "That link has expired. Request a fresh one below.",
  access_denied: "Google sign-in was cancelled. Try again.",
  missing_token: "That link was incomplete. Request a fresh one below.",
  invalid_type: "That link was incomplete. Request a fresh one below.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const next = clientSafeNext(searchParams.get("next"));

  // If already logged in, go straight to the destination
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !searchParams.get("error")) {
        window.location.href = next;
      } else {
        setCheckingSession(false);
      }
    });
  }, [searchParams, next]);

  // Show error from URL params (e.g., expired magic link)
  useEffect(() => {
    const urlError = searchParams.get("error");
    const reason = searchParams.get("reason");
    const errorDesc = searchParams.get("error_description");
    // Also check hash params (Supabase sometimes returns errors in hash)
    const hash = window.location.hash;
    if (hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const desc = params.get("error_description");
      if (desc) setError(desc.replace(/\+/g, " "));
    } else if (urlError === "auth_failed" && reason && REASON_MESSAGES[reason]) {
      setError(REASON_MESSAGES[reason]);
    } else if (errorDesc) {
      setError(errorDesc);
    } else if (urlError === "auth_failed") {
      setError("That login link expired or was already used. Request a fresh one below.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await sendMagicLink(email, "login", next);
    if (!result.ok) {
      setError(result.message);
    } else {
      trackLead("email", email);
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="w-full max-w-md rounded-[20px] border border-border bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center py-8 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-text-secondary">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[20px] border border-border bg-white p-8 shadow-sm">
      {!submitted ? (
        <>
          <h1 className="font-serif text-3xl text-lp-navy">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-lp-navy/75">
            No password needed. We&apos;ll email you a secure login link every time.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {/* Google OAuth */}
          <div className="mt-6">
            <GoogleSignInButton label="Continue with Google" next={next} className="h-14 rounded-xl border-lp-border text-base font-semibold text-lp-navy hover:bg-lp-bg" />
          </div>

          <div className="relative mt-5 mb-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-lp-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-lp-muted">or</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            <Input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-14 rounded-xl border-lp-border bg-white text-base"
            />
            <EmailSuggestion email={email} onAccept={setEmail} />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-lp-teal text-base font-semibold hover:bg-lp-teal-dark"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        </>
      ) : (
        <CheckInboxCard
          email={email}
          source="login"
          variant="light"
          purpose="login"
          next={next}
          onChangeEmail={() => { setSubmitted(false); setError(null); }}
          onUseSuggestion={(fixed) => { setEmail(fixed); setSubmitted(false); setError(null); }}
        />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
          ← Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <Suspense fallback={<div className="animate-pulse h-64 w-full max-w-md rounded-[20px] bg-primary/10" />}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
