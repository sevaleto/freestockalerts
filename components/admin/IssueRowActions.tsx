"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const btn = "rounded-lg border border-lp-border px-2.5 py-1 text-xs font-semibold text-lp-navy hover:border-lp-teal/40 disabled:opacity-50";

async function postBuild(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => null)) as { error?: string; slots?: { slot: number; status: string; error?: string; reviewReason?: string }[] } | null;
  if (!res.ok) return payload?.error ?? "Request failed.";
  const bad = payload?.slots?.filter((s) => s.status === "failed") ?? [];
  return bad.length ? bad.map((s) => `Issue ${s.slot}: ${s.error ?? "failed"}`).join("\n") : null;
}

/** Open in Beehiiv, or rebuild this slot (a new draft; the old one stays in Beehiiv). */
export function IssueRowActions({ issueDate, slot, beehiivPostUrl, status }: { issueDate: string; slot: number; beehiivPostUrl: string | null; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function rebuild() {
    const note = status === "drafted" || status === "needs_review" ? " The current draft stays in Beehiiv; delete it there if you keep the new one." : "";
    if (!window.confirm(`Rebuild issue ${slot} for ${issueDate}? This picks a topic, writes the article and creates a new Beehiiv draft (about a minute).${note}`)) return;
    setBusy(true);
    try {
      const error = await postBuild({ date: issueDate, slot, force: true });
      if (error) window.alert(error);
      router.refresh();
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

/** Build today's two issues on demand, and pause or resume the morning cron. */
export function IssuesToolbar({ today, paused }: { today: string; paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"build" | "pause" | null>(null);

  async function buildToday() {
    if (!window.confirm(`Build today's issues (${today}) now? Slots that already have a draft are skipped. This takes a minute or two.`)) return;
    setBusy("build");
    try {
      const error = await postBuild({ date: today });
      if (error) window.alert(error);
      router.refresh();
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
      <button type="button" disabled={busy !== null} onClick={buildToday} className="inline-flex h-11 items-center rounded-xl bg-lp-teal px-5 text-sm font-semibold text-white shadow-sm hover:bg-lp-teal-dark disabled:opacity-50">
        {busy === "build" ? "Building…" : "Build today"}
      </button>
    </div>
  );
}
