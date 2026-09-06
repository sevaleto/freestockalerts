"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { trackSubscribe } from "@/lib/tracking/events";

interface ActivateButtonProps {
  slug: string;
  templateName: string;
  /** Button text when signed in; defaults to "Activate this strategy". */
  label?: string;
  /** Disable activation (e.g. the strategy has no constituents right now). */
  disabled?: boolean;
}

export function ActivateButton({ slug, templateName, label, disabled = false }: ActivateButtonProps) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setSignedIn(!!user));
  }, []);

  const loginWithReturn = () =>
    router.push(`/login?next=${encodeURIComponent(`/welcome/${slug}`)}`);

  const handleActivate = async () => {
    if (!signedIn) {
      // Sign in first; the welcome page activates the template on arrival.
      loginWithReturn();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${slug}/activate`, { method: "POST" });
      if (res.status === 401) {
        loginWithReturn();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to activate strategy");

      trackSubscribe(templateName, body.data?.alertCount ?? 0);
      setActivated(true);
      setTimeout(() => router.push("/dashboard/alerts"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (activated) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-lp-green" role="status">
        <CheckCircle2 className="h-5 w-5" aria-hidden />
        {templateName} activated. Taking you to your alerts…
      </div>
    );
  }

  const text = loading
    ? "Activating…"
    : signedIn
      ? `${label ?? "Activate this strategy"} →`
      : `${label ?? "Activate this strategy"} (sign in first) →`;

  return (
    <div className="space-y-2">
      <Button
        onClick={handleActivate}
        disabled={disabled || loading || signedIn === null}
        className="h-auto min-h-12 w-full whitespace-normal rounded-xl bg-lp-teal px-6 py-3 text-center text-base font-semibold leading-snug hover:bg-lp-teal-dark sm:w-auto"
      >
        {text}
      </Button>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
