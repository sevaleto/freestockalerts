"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FIELD_CLASS, LABEL_CLASS } from "@/components/forms/FormField";
import { beehiivSnippetHtml, DEFAULT_CLICK_VALUE_CENTS, HEADLINE_COLORS, LEAD_IN_PRESETS, renderAdHtml, type AdRecordInput } from "@/lib/ads/template";

/**
 * Create / edit form for one email ad with a live preview of the exact HTML
 * the email will carry. The preview renders through the same `renderAdHtml`
 * the sender uses, so what you see is what subscribers get.
 */
interface Props {
  mode: "create" | "edit";
  id?: string;
  initial?: AdRecordInput;
  stats?: { impressions: number; clicks: number; lastShownAt: string | null };
  /** Public origin used in the Beehiiv snippet links. */
  appUrl?: string;
  /** Newsletters that get a "copy snippet" button (the synced Beehiiv publications). */
  newsletters?: { key: "fsa" | "si"; name: string }[];
}

const EMPTY: AdRecordInput = {
  name: "",
  leadIn: LEAD_IN_PRESETS[1],
  headline: "",
  headlineColor: HEADLINE_COLORS[0].value,
  body: "",
  ctaText: "",
  ctaUrl: "",
  imageUrl: null,
  status: "active",
  weight: 1,
  startAt: null,
  endAt: null,
  valueCents: DEFAULT_CLICK_VALUE_CENTS,
};


/** ISO → value for <input type="datetime-local"> in the browser's zone; "" when unset. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const PREVIEW_FRAME = (inner: string) =>
  `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:Inter,Arial,sans-serif;">${inner}</body></html>`;

export function AdEditor({ mode, id, initial, stats, appUrl = "https://www.freestockalerts.ai", newsletters = [{ key: "fsa", name: "FreeStockAlerts.AI" }, { key: "si", name: "The Smart Investor" }] }: Props) {
  const router = useRouter();
  const [ad, setAd] = useState<AdRecordInput>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copySnippet(channel: "fsa" | "si") {
    if (!id) return;
    const html = beehiivSnippetHtml({ ...ad, id }, channel, appUrl);
    try {
      await navigator.clipboard.writeText(html);
      setCopied(channel);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy the snippet:", html);
    }
  }

  const set = <K extends keyof AdRecordInput>(key: K, value: AdRecordInput[K]) => setAd((a) => ({ ...a, [key]: value }));

  const previewHtml = useMemo(() => {
    const filled = {
      ...ad,
      leadIn: ad.leadIn || "Special Report",
      headline: ad.headline || "Your headline goes here",
      body: ad.body || "Body copy appears here. Blank lines start a new paragraph.",
      ctaText: ad.ctaText || "Read the full story",
      ctaUrl: ad.ctaUrl || "https://example.com",
    };
    return PREVIEW_FRAME(renderAdHtml(filled, filled.ctaUrl));
  }, [ad]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/ads" : `/api/admin/ads/${id}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ad),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Could not save the ad.");
        return;
      }
      router.push("/admin/ads");
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/ads" className="text-sm font-medium text-lp-teal hover:underline">
            ← All ads
          </Link>
          <h1 className="mt-2 font-serif text-4xl text-lp-navy">{mode === "create" ? "New email ad" : "Edit email ad"}</h1>
        </div>
        {stats ? (
          <p className="text-sm text-lp-navy/70">
            {stats.impressions.toLocaleString("en-US")} impressions · {stats.clicks.toLocaleString("en-US")} clicks
            {stats.lastShownAt ? ` · last sent ${new Date(stats.lastShownAt).toLocaleString("en-US")}` : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className={LABEL_CLASS}>
              Internal name *
            </label>
            <input id="name" required maxLength={120} className={FIELD_CLASS} value={ad.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Trading Tips — 5 Stocks report, Sept" />
            <p className="mt-1 text-xs text-lp-muted">Only you see this. Use the advertiser and campaign.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="leadIn" className={LABEL_CLASS}>
                Lead-in *
              </label>
              <input id="leadIn" required maxLength={80} list="lead-in-presets" className={FIELD_CLASS} value={ad.leadIn} onChange={(e) => set("leadIn", e.target.value)} />
              <datalist id="lead-in-presets">
                {LEAD_IN_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="headlineColor" className={LABEL_CLASS}>
                Headline color
              </label>
              <select id="headlineColor" className={FIELD_CLASS} value={ad.headlineColor} onChange={(e) => set("headlineColor", e.target.value)}>
                {HEADLINE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="headline" className={LABEL_CLASS}>
              Headline *
            </label>
            <input id="headline" required maxLength={160} className={FIELD_CLASS} value={ad.headline} onChange={(e) => set("headline", e.target.value)} />
          </div>

          <div>
            <label htmlFor="body" className={LABEL_CLASS}>
              Body *
            </label>
            <textarea id="body" required maxLength={2000} rows={6} className={`${FIELD_CLASS} h-auto py-2`} value={ad.body} onChange={(e) => set("body", e.target.value)} />
            <p className="mt-1 text-xs text-lp-muted">Plain text. A blank line starts a new paragraph. Keep claims hedged: no guarantees, no &quot;risk-free&quot;, no &quot;secret&quot;.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ctaText" className={LABEL_CLASS}>
                Link text *
              </label>
              <input id="ctaText" required maxLength={120} className={FIELD_CLASS} value={ad.ctaText} onChange={(e) => set("ctaText", e.target.value)} placeholder="Get the free report" />
            </div>
            <div>
              <label htmlFor="ctaUrl" className={LABEL_CLASS}>
                Link URL *
              </label>
              <input id="ctaUrl" required type="url" maxLength={1000} className={FIELD_CLASS} value={ad.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="https://" />
            </div>
          </div>

          <div>
            <label htmlFor="imageUrl" className={LABEL_CLASS}>
              Image URL
            </label>
            <input id="imageUrl" type="url" maxLength={1000} className={FIELD_CLASS} value={ad.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value || null)} placeholder="https://… (optional, shown 230px wide)" />
          </div>

          <fieldset className="rounded-[16px] border border-lp-border bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-lp-navy">Rotation</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="status" className={LABEL_CLASS}>
                  Status
                </label>
                <select id="status" className={FIELD_CLASS} value={ad.status} onChange={(e) => set("status", e.target.value === "paused" ? "paused" : "active")}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div>
                <label htmlFor="weight" className={LABEL_CLASS}>
                  Weight (1–100)
                </label>
                <input id="weight" type="number" min={1} max={100} className={FIELD_CLASS} value={ad.weight} onChange={(e) => set("weight", Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
                <p className="mt-1 text-xs text-lp-muted">Weight 2 gets twice the share of weight 1.</p>
              </div>
              <div>
                <label htmlFor="valueDollars" className={LABEL_CLASS}>
                  Value per click ($)
                </label>
                <input
                  id="valueDollars"
                  type="number"
                  min={0}
                  max={1000}
                  step={0.05}
                  className={FIELD_CLASS}
                  value={(ad.valueCents / 100).toFixed(2)}
                  onChange={(e) => set("valueCents", Math.max(0, Math.min(100_000, Math.round((Number(e.target.value) || 0) * 100))))}
                />
                <p className="mt-1 text-xs text-lp-muted">Credited to the subscriber on each counted click. Stamped at click time, so changing it later does not rewrite history.</p>
              </div>
              <div>
                <label htmlFor="startAt" className={LABEL_CLASS}>
                  Start (optional)
                </label>
                <input id="startAt" type="datetime-local" className={FIELD_CLASS} value={toLocalInput(ad.startAt)} onChange={(e) => set("startAt", fromLocalInput(e.target.value))} />
              </div>
              <div>
                <label htmlFor="endAt" className={LABEL_CLASS}>
                  End (optional)
                </label>
                <input id="endAt" type="datetime-local" className={FIELD_CLASS} value={toLocalInput(ad.endAt)} onChange={(e) => set("endAt", fromLocalInput(e.target.value))} />
              </div>
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex h-11 items-center rounded-xl bg-lp-teal px-6 text-sm font-semibold text-white shadow-sm hover:bg-lp-teal-dark disabled:opacity-60">
              {saving ? "Saving…" : mode === "create" ? "Create ad" : "Save changes"}
            </button>
            <Link href="/admin/ads" className="text-sm font-medium text-lp-navy/70 hover:text-lp-navy">
              Cancel
            </Link>
          </div>
        </form>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-lp-teal">Live preview</p>
            <div className="flex gap-1 rounded-lg border border-lp-border bg-white p-0.5 text-xs font-semibold">
              <button type="button" onClick={() => setNarrow(false)} className={`rounded-md px-2.5 py-1 ${!narrow ? "bg-lp-mint text-lp-teal" : "text-lp-navy/70"}`}>
                Desktop
              </button>
              <button type="button" onClick={() => setNarrow(true)} className={`rounded-md px-2.5 py-1 ${narrow ? "bg-lp-mint text-lp-teal" : "text-lp-navy/70"}`}>
                Phone
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-[20px] border border-lp-border bg-slate-100 p-4">
            <iframe title="Ad preview" srcDoc={previewHtml} sandbox="" className="mx-auto block h-[420px] rounded-xl bg-white shadow-sm" style={{ width: narrow ? 375 : "100%" }} />
          </div>
          <p className="mt-2 text-xs text-lp-muted">Exactly the HTML the email carries, in a plain frame. Real emails show it below the alert body, above the footer.</p>

          <div className="mt-6 rounded-[16px] border border-lp-border bg-white p-4">
            <p className="text-sm font-semibold text-lp-navy">Use in a Beehiiv post</p>
            {mode === "create" ? (
              <p className="mt-1 text-xs text-lp-muted">Save the ad first; the snippet needs its id for click tracking.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-lp-muted">
                  Optional. Newsletter clicks are already counted by Beehiiv for every link in every issue, so nothing needs to be created here for tracking. These buttons copy this card as HTML with tracked links if you want an issue to carry the same ad as the alerts; paste it into an HTML block in the Beehiiv editor.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {newsletters.map((n) => (
                    <button key={n.key} type="button" onClick={() => copySnippet(n.key)} className="rounded-lg border border-lp-border px-3 py-1.5 text-xs font-semibold text-lp-navy hover:border-lp-teal/40">
                      {copied === n.key ? "Copied" : `Copy for ${n.name}`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-lp-muted">Unsaved edits above are included in the copy; save them too so the record matches.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
