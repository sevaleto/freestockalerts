"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TickerSearch } from "@/components/dashboard/TickerSearch";
import { AlertTypeSelector } from "@/components/dashboard/AlertTypeSelector";
import { ThresholdForm } from "@/components/dashboard/ThresholdForm";
import { formatPrice, formatPercent } from "@/lib/utils/formatters";
import { createBrowserClient } from "@supabase/ssr";

function getDefaultThreshold(alertType: string | undefined, currentPrice?: number): number {
  switch (alertType) {
    case "PRICE_ABOVE":
    case "PRICE_BELOW":
      return currentPrice ?? 0;
    case "PERCENT_CHANGE_DAY":
    case "PERCENT_CHANGE_CUSTOM":
      return 5;
    case "VOLUME_SPIKE":
      return 2;
    case "RSI_OVERBOUGHT":
      return 70;
    case "RSI_OVERSOLD":
      return 30;
    case "SMA_CROSS_ABOVE":
    case "SMA_CROSS_BELOW":
      return 50;
    case "FIFTY_TWO_WEEK_HIGH":
    case "FIFTY_TWO_WEEK_LOW":
      return 0;
    case "EARNINGS_REMINDER":
      return 3;
    case "PRICE_RECOVERY":
      return currentPrice ?? 0;
    default:
      return 0;
  }
}

function getTriggerDirection(alertType: string | undefined): string {
  switch (alertType) {
    case "PRICE_ABOVE":
    case "FIFTY_TWO_WEEK_HIGH":
    case "RSI_OVERBOUGHT":
    case "SMA_CROSS_ABOVE":
    case "VOLUME_SPIKE":
      return "ABOVE";
    case "PRICE_BELOW":
    case "FIFTY_TWO_WEEK_LOW":
    case "RSI_OVERSOLD":
    case "SMA_CROSS_BELOW":
      return "BELOW";
    default:
      return "BOTH";
  }
}

export default function NewAlertPage() {
  const router = useRouter();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<string | undefined>();
  const [threshold, setThreshold] = useState<number>(0);
  const [cooldownMinutes, setCooldownMinutes] = useState("20");
  const [note, setNote] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [quote, setQuote] = useState<{ ticker: string; companyName: string; price: number; dayChangePercent: number } | undefined>();
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get user on mount
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Fetch quote when ticker changes
  useEffect(() => {
    if (!selectedTicker) {
      setQuote(undefined);
      return;
    }

    let isMounted = true;
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quotes/${selectedTicker}`);
        if (!res.ok) throw new Error("Quote fetch failed");
        const json = await res.json();
        if (isMounted && json?.data) {
          setQuote(json.data);
          setCompanyName(json.data.companyName ?? null);
        }
      } catch {
        // silently fail — quote is nice-to-have
      }
    };

    fetchQuote();
    return () => { isMounted = false; };
  }, [selectedTicker]);

  // Reset threshold when alert type changes
  useEffect(() => {
    setThreshold(getDefaultThreshold(alertType, quote?.price));
  }, [alertType, quote?.price]);

  const handleSubmit = async () => {
    setError(null);

    if (!userId) {
      setError("You must be signed in to create alerts. Please sign in first.");
      return;
    }
    if (!selectedTicker) {
      setError("Please select a ticker.");
      return;
    }
    if (!alertType) {
      setError("Please choose an alert type.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          ticker: selectedTicker,
          companyName: companyName ?? quote?.companyName,
          alertType,
          triggerValue: threshold,
          triggerDirection: getTriggerDirection(alertType),
          currentPrice: quote?.price,
          cooldownMinutes: Number(cooldownMinutes),
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create alert");
      }

      setSuccess(true);
      setTimeout(() => router.push("/dashboard/alerts"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-semibold text-text-primary">Alert Created!</h2>
        <p className="text-sm text-text-secondary">Redirecting to your alerts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Create New Alert</h1>
        <p className="text-sm text-text-secondary">
          Build a custom alert with AI context. No credit card required.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Step 1: Ticker Search</h2>
        <TickerSearch onSelect={(ticker) => setSelectedTicker(ticker)} />
        {quote ? (
          <Card className="border-border">
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {quote.ticker} • {quote.companyName}
                </p>
                <p className="text-xs text-text-muted">Current quote</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Price</p>
                <p className="text-lg font-semibold text-text-primary">
                  {formatPrice(quote.price)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Day change</p>
                <p
                  className={
                    quote.dayChangePercent >= 0 ? "text-success font-semibold" : "text-danger font-semibold"
                  }
                >
                  {formatPercent(quote.dayChangePercent)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Step 2: Choose Alert Type</h2>
        <AlertTypeSelector value={alertType} onSelect={setAlertType} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Step 3: Set Threshold</h2>
        <Card className="border-border">
          <CardContent className="p-5">
            <ThresholdForm
              alertType={alertType}
              currentPrice={quote?.price}
              value={threshold}
              onChange={setThreshold}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Step 4: Notification Settings</h2>
        <Card className="border-border">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Email notification</p>
                <p className="text-xs text-text-secondary">Receive AI-enhanced alerts.</p>
              </div>
              <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>
            <div className="space-y-2">
              <Label>Cooldown period</Label>
              <Select value={cooldownMinutes} onValueChange={setCooldownMinutes}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cooldown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="1440">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Personal note (optional)</Label>
              <Input
                placeholder="Add a note like 'Buy zone'"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Step 5: Review & Create</h2>
        <Card className="border-border">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Ticker</p>
                <p className="text-sm font-semibold text-text-primary">
                  {selectedTicker ?? "Select a ticker"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Alert type</p>
                <p className="text-sm font-semibold text-text-primary">
                  {alertType ? alertType.replace(/_/g, " ") : "Select alert type"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Threshold</p>
                <p className="text-sm font-semibold text-text-primary">
                  {threshold || "—"}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
                {error}
              </div>
            )}

            <Button
              className="w-full md:w-auto"
              onClick={handleSubmit}
              disabled={submitting || !selectedTicker || !alertType}
            >
              {submitting ? "Creating..." : "Create Alert"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
