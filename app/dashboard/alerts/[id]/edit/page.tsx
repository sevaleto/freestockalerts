"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTypeSelector } from "@/components/dashboard/AlertTypeSelector";
import { ThresholdForm } from "@/components/dashboard/ThresholdForm";
import { formatPrice, formatPercent } from "@/lib/utils/formatters";
import { createBrowserClient } from "@supabase/ssr";

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

interface AlertData {
  id: string;
  ticker: string;
  companyName: string | null;
  alertType: string;
  triggerValue: number;
  triggerDirection: string;
  currentPrice: number | null;
  isActive: boolean;
  cooldownMinutes: number;
  note: string | null;
}

export default function EditAlertPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [alertType, setAlertType] = useState<string | undefined>();
  const [threshold, setThreshold] = useState<number>(0);
  const [cooldownMinutes, setCooldownMinutes] = useState("20");
  const [note, setNote] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [ticker, setTicker] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [quote, setQuote] = useState<{
    ticker: string;
    companyName: string;
    price: number;
    dayChangePercent: number;
  }>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  // Fetch alert data on mount
  useEffect(() => {
    const fetchAlert = async () => {
      try {
        const res = await fetch(`/api/alerts/${alertId}`);
        if (!res.ok) throw new Error("Failed to fetch alert");
        const json = await res.json();
        const alert: AlertData = json.data;

        setTicker(alert.ticker);
        setCompanyName(alert.companyName ?? "");
        setAlertType(alert.alertType);
        setThreshold(alert.triggerValue);
        setCooldownMinutes(String(alert.cooldownMinutes));
        setNote(alert.note ?? "");
      } catch {
        setError("Failed to load alert. It may not exist or you don't have access.");
      } finally {
        setLoading(false);
      }
    };

    fetchAlert();
  }, [alertId]);

  // Fetch quote when ticker is available
  useEffect(() => {
    if (!ticker) return;

    let isMounted = true;
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quotes/${ticker}`);
        if (!res.ok) throw new Error("Quote fetch failed");
        const json = await res.json();
        if (isMounted && json?.data) {
          setQuote(json.data);
        }
      } catch {
        // silently fail — quote is nice-to-have
      }
    };

    fetchQuote();
    return () => {
      isMounted = false;
    };
  }, [ticker]);

  const handleSubmit = async () => {
    setError(null);

    if (!userId) {
      setError("You must be signed in to edit alerts.");
      return;
    }
    if (!alertType) {
      setError("Please choose an alert type.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertType,
          triggerValue: threshold,
          triggerDirection: getTriggerDirection(alertType),
          currentPrice: quote?.price,
          cooldownMinutes: Number(cooldownMinutes),
          note: note || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update alert");
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
        <h2 className="text-xl font-semibold text-text-primary">Alert Updated!</h2>
        <p className="text-sm text-text-secondary">Redirecting to your alerts...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-4xl animate-pulse">⏳</div>
        <p className="text-sm text-text-secondary">Loading alert...</p>
      </div>
    );
  }

  if (error && !alertType) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-4xl">❌</div>
        <p className="text-sm text-danger">{error}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/alerts")}>
          Back to Alerts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Edit Alert</h1>
        <p className="text-sm text-text-secondary">
          Update your alert settings for {ticker}.
        </p>
      </div>

      {/* Ticker display (read-only) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Ticker</h2>
        <Card className="border-border">
          <CardContent className="grid gap-4 p-5 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {ticker} {companyName ? `• ${companyName}` : ""}
              </p>
              <p className="text-xs text-text-muted">
                Ticker cannot be changed — delete and create a new alert instead.
              </p>
            </div>
            {quote && (
              <>
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
                      quote.dayChangePercent >= 0
                        ? "text-success font-semibold"
                        : "text-danger font-semibold"
                    }
                  >
                    {formatPercent(quote.dayChangePercent)}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Alert Type */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Alert Type</h2>
        <AlertTypeSelector value={alertType} onSelect={setAlertType} />
      </section>

      {/* Threshold */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Threshold</h2>
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

      {/* Notification Settings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Notification Settings</h2>
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

      {/* Review & Save */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Review & Save</h2>
        <Card className="border-border">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Ticker</p>
                <p className="text-sm font-semibold text-text-primary">{ticker}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Alert type</p>
                <p className="text-sm font-semibold text-text-primary">
                  {alertType ? alertType.replace(/_/g, " ") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Threshold</p>
                <p className="text-sm font-semibold text-text-primary">{threshold || "—"}</p>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !alertType}
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/alerts")}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
