"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ThresholdFormProps {
  alertType?: string;
  currentPrice?: number;
}

export function ThresholdForm({ alertType, currentPrice }: ThresholdFormProps) {
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
        <Select defaultValue="3">
          <SelectTrigger>
            <SelectValue placeholder="Select days" />
          </SelectTrigger>
          <SelectContent>
            {["1", "3", "5", "7", "14"].map((value) => (
              <SelectItem key={value} value={value}>
                {value} days
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
        <Input type="number" defaultValue={2} step={0.1} />
        <p className="text-xs text-text-muted">Current average volume: 45.2M</p>
      </div>
    );
  }

  if (alertType === "RSI_OVERBOUGHT" || alertType === "RSI_OVERSOLD") {
    return (
      <div className="space-y-3">
        <Label>RSI threshold</Label>
        <Input type="number" defaultValue={alertType === "RSI_OVERBOUGHT" ? 70 : 30} />
        <p className="text-xs text-text-muted">Current RSI: 58</p>
      </div>
    );
  }

  if (alertType === "SMA_CROSS_ABOVE" || alertType === "SMA_CROSS_BELOW") {
    return (
      <div className="space-y-3">
        <Label>SMA period</Label>
        <Select defaultValue="50">
          <SelectTrigger>
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {["20", "50", "100", "200"].map((value) => (
              <SelectItem key={value} value={value}>
                {value}-day SMA
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-text-muted">Current SMA: $218.40</p>
      </div>
    );
  }

  if (alertType === "PERCENT_CHANGE_DAY" || alertType === "PERCENT_CHANGE_CUSTOM") {
    return (
      <div className="space-y-3">
        <Label>Percent change threshold</Label>
        <Input type="number" defaultValue={5} step={0.5} />
        <p className="text-xs text-text-muted">Current change: +1.2%</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Price threshold</Label>
      <Input type="number" defaultValue={currentPrice ?? 0} step={0.01} />
      <p className="text-xs text-text-muted">Current price: ${currentPrice?.toFixed(2) ?? "--"}</p>
    </div>
  );
}
