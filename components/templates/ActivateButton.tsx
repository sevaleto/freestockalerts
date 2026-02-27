"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@supabase/ssr";

interface ActivateButtonProps {
  slug: string;
  templateName: string;
}

export function ActivateButton({ slug, templateName }: ActivateButtonProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const handleActivate = async () => {
    if (!userId) {
      // Not logged in — redirect to login, then back here
      router.push(`/login`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Subscribe to template
      const subRes = await fetch(`/api/templates/${slug}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!subRes.ok) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to subscribe");
      }

      // 2. Fetch template items to create individual alerts
      const tplRes = await fetch(`/api/templates/${slug}`);
      if (!tplRes.ok) throw new Error("Failed to load template");
      const tplData = await tplRes.json();
      const items = tplData?.data?.items ?? [];

      // 3. Create alerts from template items
      for (const item of items) {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            ticker: item.ticker,
            companyName: item.companyName,
            alertType: item.alertType,
            triggerValue: item.triggerValue,
            triggerDirection: item.triggerDirection,
            note: item.rationale,
            templateId: tplData.data.id,
          }),
        });
      }

      setActivated(true);
      setTimeout(() => router.push("/dashboard/alerts"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (activated) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
        ✅ {templateName} activated! Redirecting to your alerts...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleActivate}
        disabled={loading}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {loading ? "Activating..." : userId ? "Activate this template →" : "Sign in to activate →"}
      </Button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
