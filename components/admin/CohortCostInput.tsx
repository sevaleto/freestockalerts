"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Inline dollar input for one cohort-month; saves on blur or Enter. */
export function CohortCostInput({ cohortKey, month, costCents }: { cohortKey: string; month: string; costCents: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(costCents === null ? "" : (costCents / 100).toFixed(2));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const dollars = value.trim() === "" ? null : Number(value);
    if (dollars !== null && (!Number.isFinite(dollars) || dollars < 0)) return setState("error");
    setState("saving");
    const res = await fetch("/api/admin/cohorts/cost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cohortKey, month, costCents: dollars === null ? null : Math.round(dollars * 100) }) });
    setState(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-lp-muted">$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        placeholder="0.00"
        aria-label={`Cost for ${cohortKey} in ${month}`}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`h-8 w-24 rounded-lg border px-2 text-right text-sm tabular-nums text-lp-navy ${state === "error" ? "border-red-400" : state === "saved" ? "border-lp-teal" : "border-lp-border"}`}
      />
    </span>
  );
}
