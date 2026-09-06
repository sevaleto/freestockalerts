"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const btn = "rounded-lg border border-lp-border px-2.5 py-1 text-xs font-semibold text-lp-navy hover:border-lp-teal/40 disabled:opacity-50";

/** Queue a build; the server answers at once and works in the background. */
async function postBuild(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) return payload?.error ?? "Request failed.";
  return null;
}

/** Re-render the table every 15 seconds for five minutes so rows appear as slots finish. */
function pollRefresh(refresh: () => void) {
  let n = 0;
  const id = window.setInterval(() => {
    refresh();
    if (++n >= 20) window.clearInterval(id);
  }, 15_000);
}

const KIND_LABEL: Record<number, string> = { 1: "morning brief", 2: "closing recap" };

/** Open in Beehiiv, or rebuild this slot (a new draft; the old one stays in Beehiiv). */
export function IssueRowActions({ issueDate, slot, beehiivPostUrl, status }: { issueDate: string; slot: number; beehiivPostUrl: string | null; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function rebuild() {
    const note = status === "drafted" || status === "needs_review" ? " The current draft stays in Beehiiv; delete it there if you keep the new one." : "";
    if (!window.confirm(`Rebuild the ${KIND_LABEL[slot] ?? `issue ${slot}`} for ${issueDate}? This gathers today's data, writes it and creates a new Beehiiv draft (a few minutes).${note}`)) return;
    setBusy(true);
    try {
      const error = await postBuild({ date: issueDate, slot, force: true });
      if (error) window.alert(error);
      else {
        router.refresh();
        pollRefresh(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      {beehiivPostUrl ? (
        <a href={beehiivPostUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-lp-teal px-2.5 py-1 text-xs font-semibold text-white hover:bg-lp-teal-dark">
          Open in Beehiiv
        </a>
      ) : null}
      <button type="button" disabled={busy} onClick={rebuild} className={btn}>
        {busy ? "Building…" : "Rebuild"}
      </button>
    </div>
  );
}

/** Build either issue on demand (ignores the time window), and pause or resume the crons. */
export function IssuesToolbar({ today, paused }: { today: string; paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"build" | "pause" | null>(null);

  async function buildNow(slot: 1 | 2) {
    if (!window.confirm(`Build today's ${KIND_LABEL[slot]} (${today}) now? If one already exists, a new draft is created and the old one stays in Beehiiv. It shows up here when it finishes (a few minutes); the report is emailed.`)) return;
    setBusy("build");
    try {
      const error = await postBuild({ date: today, slot, force: true });
      if (error) window.alert(error);
      else {
        router.refresh();
        pollRefresh(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function togglePause() {
    setBusy("pause");
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "newsletterBuildPaused", value: paused ? "0" : "1" }) });
      if (!res.ok) window.alert("Could not update the setting.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {paused ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Morning builds paused</span> : null}
      <button type="button" disabled={busy !== null} onClick={togglePause} className={btn}>
        {busy === "pause" ? "Saving…" : paused ? "Resume builds" : "Pause builds"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => buildNow(1)} className="inline-flex h-11 items-center rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white shadow-sm hover:bg-lp-teal-dark disabled:opacity-50">
        {busy === "build" ? "Building…" : "Build morning brief"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => buildNow(2)} className="inline-flex h-11 items-center rounded-xl bg-lp-navy px-5 text-sm font-semibold text-white shadow-sm hover:bg-lp-navy/90 disabled:opacity-50">
        {busy === "build" ? "Building…" : "Build closing recap"}
      </button>
    </div>
  );
}
