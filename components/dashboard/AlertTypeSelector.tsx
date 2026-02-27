"use client";

import { alertTypeCategories, alertTypeOptions } from "@/lib/mock/alertTypes";
import { cn } from "@/lib/utils";

interface AlertTypeSelectorProps {
  value?: string;
  onSelect: (value: string) => void;
}

export function AlertTypeSelector({ value, onSelect }: AlertTypeSelectorProps) {
  return (
    <div className="space-y-6">
      {alertTypeCategories.map((category) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{category}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {alertTypeOptions
              .filter((option) => option.category === category)
              .map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelect(option.id)}
                  className={cn(
                    "flex items-start gap-4 rounded-2xl border border-border bg-white p-4 text-left transition hover:-translate-y-0.5",
                    value === option.id ? "border-primary bg-primary/5" : ""
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-primary">
                    <option.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{option.name}</p>
                    <p className="text-xs text-text-secondary">{option.description}</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
