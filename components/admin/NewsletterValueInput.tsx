"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Dollar input for the newsletter value per unique click; saves on blur or Enter and re-prices the report. */
export function NewsletterValueInput({ valueCents }: { valueCents: number }) {
  const router = useRouter();
  const [value, setValue] = useState((valueCents / 100).toFixed(2));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const dollars = Number(value);
    if (!Number.isFinite(dollars) || dollars < 0) return setState("error");
    setState("saving");
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "newsletterClickValueCents", value: Math.round(dollars * 100) }) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-lp-navy">
      Newsletter value per unique click
      <span className="inline-flex items-center gap-1">
        <span className="text-lp-muted">$</span>
        <input
          type="number"
          min={0}
          step={0.05}
          value={value}
          aria-label="Newsletter value per unique click in dollars"
          onChange={(e) => {
            setValue(e.target.value);
            setState("idle");
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={`h-9 w-24 rounded-lg border px-2 text-right tabular-nums ${state === "error" ? "border-red-400" : state === "saved" ? "border-lp-teal" : "border-lp-border"}`}
        />
      </span>
    </label>
  );
}
