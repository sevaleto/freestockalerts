"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ThresholdFormProps {
  alertType?: string;
  currentPrice?: number;
  value: number;
  onChange: (value: number) => void;
}

export function ThresholdForm({ alertType, currentPrice, value, onChange }: ThresholdFormProps) {
  if (!alertType) {
    return (
      <p className="text-sm text-text-secondary">
        Select an alert type to configure the threshold.
      </p>
    );
  }

  if (alertType === "EARNINGS_REMINDER") {
    return (
      <div className="space-y-3">
        <Label>Days before earnings</Label>
        <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Select days" />
          </SelectTrigger>
          <SelectContent>
            {["1", "3", "5", "7", "14"].map((v) => (
              <SelectItem key={v} value={v}>
                {v} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (alertType === "VOLUME_SPIKE") {
    return (
      <div className="space-y-3">
        <Label>Volume multiplier</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={0.1}
        />
        <p className="text-xs text-text-muted">Alert when volume exceeds this multiple of the average.</p>
      </div>
    );
  }

  if (alertType === "RSI_OVERBOUGHT" || alertType === "RSI_OVERSOLD") {
    return (
      <div className="space-y-3">
        <Label>RSI threshold</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  if (alertType === "SMA_CROSS_ABOVE" || alertType === "SMA_CROSS_BELOW") {
    return (
      <div className="space-y-3">
        <Label>SMA period</Label>
        <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {["20", "50", "100", "200"].map((v) => (
              <SelectItem key={v} value={v}>
                {v}-day SMA
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (alertType === "PERCENT_CHANGE_DAY" || alertType === "PERCENT_CHANGE_CUSTOM") {
    return (
      <div className="space-y-3">
        <Label>Percent change threshold</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={0.5}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Price threshold</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={0.01}
      />
      {currentPrice ? (
        <p className="text-xs text-text-muted">Current price: ${currentPrice.toFixed(2)}</p>
      ) : null}
    </div>
  );
}
