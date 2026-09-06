"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Pause / resume / delete for one row of the ads table. */
export function AdRowActions({ id, status, name }: { id: string; status: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const paused = status === "paused";

  async function call(init: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ads/${id}`, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(payload?.error ?? "Request failed.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => call({ method: "PATCH", body: JSON.stringify({ status: paused ? "active" : "paused" }) })}
        className="rounded-lg border border-lp-border px-2.5 py-1 text-xs font-semibold text-lp-navy hover:border-lp-teal/40 disabled:opacity-50"
      >
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Delete "${name}"? Its impression and click history goes with it.`)) void call({ method: "DELETE" });
        }}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
