"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TickerSearch } from "@/components/dashboard/TickerSearch";
import { AlertTypeSelector } from "@/components/dashboard/AlertTypeSelector";
import { ThresholdForm } from "@/components/dashboard/ThresholdForm";
import { mockQuoteMap } from "@/lib/mock/quotes";
import { formatPrice, formatPercent } from "@/lib/utils/formatters";

export default function NewAlertPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<string | undefined>();

  const quote = selectedTicker ? mockQuoteMap.get(selectedTicker) : undefined;

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
            <ThresholdForm alertType={alertType} currentPrice={quote?.price} />
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
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label>Cooldown period</Label>
              <Select defaultValue="20">
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
              <Input placeholder="Add a note like 'Buy zone'" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Step 5: Review & Create</h2>
        <Card className="border-border">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>
            <Button className="w-full md:w-auto">Create Alert</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
