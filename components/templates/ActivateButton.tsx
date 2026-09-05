"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { trackSubscribe } from "@/lib/tracking/events";

interface ActivateButtonProps {
  slug: string;
  templateName: string;
}

export function ActivateButton({ slug, templateName }: ActivateButtonProps) {
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
      if (!res.ok) throw new Error(body.error || "Failed to activate template");

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
      <div className="flex items-center gap-2 text-sm font-semibold text-lp-green">
        ✅ {templateName} activated! Taking you to your alerts...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleActivate}
        disabled={loading || signedIn === null}
        className="bg-lp-teal hover:bg-lp-teal-dark"
      >
        {loading ? "Activating..." : signedIn ? "Activate this template →" : "Sign in to activate →"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
