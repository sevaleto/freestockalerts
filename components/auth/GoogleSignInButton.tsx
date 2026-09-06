"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { trackInitiateSignup } from "@/lib/tracking/events";
import { isInAppBrowser } from "@/lib/auth/inAppBrowser";
import { cn } from "@/lib/utils";
import { getAttribution } from "@/lib/tracking/attributionClient";

interface GoogleSignInButtonProps {
  /** Label text — defaults to "Continue with Google" */
  label?: string;
  /** Extra Tailwind classes on the outer button */
  className?: string;
  /** Dark variant for dark-bg sections */
  dark?: boolean;
  /** Post-login destination (same-origin path). Carried through OAuth via a short-lived cookie. */
  next?: string;
  /** Attribution source, e.g. "lp:radar". Carried the same way. */
  source?: string;
  /** Meta pixel content_name for the Lead event. */
  contentName?: string;
}

function setShortCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=900; SameSite=Lax${secure}`;
}

export function GoogleSignInButton({
  label = "Continue with Google",
  className = "",
  dark = false,
  next,
  source,
  contentName,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google blocks OAuth inside the Facebook/Instagram webview; don't offer a dead end.
  useEffect(() => {
    if (isInAppBrowser()) setHidden(true);
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    trackInitiateSignup(contentName);
    if (next) setShortCookie("fsa_next", next);
    if (source) setShortCookie("fsa_src", source);
    const attribution = getAttribution();
    if (attribution) setShortCookie("fsa_attr", JSON.stringify(attribution));
    const supabase = createClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/api/auth/callback`,
      },
    });

    // Supabase only returns here when it could NOT start the redirect (provider
    // disabled, bad client config, network). Without this the button sat on
    // "Redirecting..." forever and nobody saw the failure.
    if (oauthError) {
      console.error("[auth] Google sign-in could not start:", oauthError);
      setError("Google sign-in isn't available right now. Use your email instead.");
      setLoading(false);
      return;
    }
    // Browser redirects — loading stays true
  };

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg border text-base font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          dark
            ? "border-slate-600 bg-slate-700 text-white hover:bg-slate-600"
            : "border-lp-border bg-white text-lp-navy/75 hover:bg-lp-bg",
          className
        )}
      >
        {/* Google "G" logo */}
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {loading ? "Redirecting..." : label}
      </button>
      {error && (
        <p role="alert" className={cn("mt-2 text-sm", dark ? "text-red-300" : "text-danger")}>
          {error}
        </p>
      )}
    </>
  );
}
