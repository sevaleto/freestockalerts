"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PageKind, PageStatus } from "@/lib/lp/view";

/** Publish / pause / archive / delete for one row of the landing pages table. */
export function PageRowActions({ id, slug, kind, status }: { id: string; slug: string; kind: PageKind; status: PageStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(init: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pages/${id}`, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(payload?.error ?? "Request failed.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (next: PageStatus) => call({ method: "PATCH", body: JSON.stringify({ status: next }) });
  const btn = "rounded-lg border border-lp-border px-2.5 py-1 text-xs font-semibold text-lp-navy hover:border-lp-teal/40 disabled:opacity-50";

  if (kind === "HOME") {
    return (
      <div className="flex justify-end gap-2">
        <span className="text-xs text-lp-muted">Always live</span>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      {status !== "LIVE" ? (
        <button type="button" disabled={busy} onClick={() => setStatus("LIVE")} className={btn}>
          Publish
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => setStatus("DRAFT")} className={btn}>
          Unpublish
        </button>
      )}
      {status !== "ARCHIVED" ? (
        <button type="button" disabled={busy} onClick={() => setStatus("ARCHIVED")} className={btn}>
          Archive
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Delete /go/${slug}? Its variants and view counts go with it. Leads keep their attribution.`)) void call({ method: "DELETE" });
        }}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
