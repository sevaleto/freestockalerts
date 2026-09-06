"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FIELD_CLASS, LABEL_CLASS } from "@/components/forms/FormField";
import type { SampleAlert } from "@/lib/lp/pages";
import { DEFAULTS, HOME_SLUG, type PageKind, type PageStatus } from "@/lib/lp/view";
import { complianceWarnings, LIMITS, nextVariantKey, type VariantInput } from "@/lib/lp/validate";
import type { VariantStats } from "@/lib/lp/report";
import { pct } from "@/lib/lp/report";
import type { StrategyOption } from "@/components/admin/strategyOptions";

/**
 * Create / edit form for one landing page and its headline variants.
 * Headline + subheadline live on the variants (that is what gets tested);
 * the rest of the copy is optional and falls back to the strategy's own
 * text, so a new page needs only a slug, a strategy and one headline.
 */
export interface PageForm {
  slug: string;
  kind: PageKind;
  status: PageStatus;
  templateSlug: string;
  eyebrow: string | null;
  logicLine: string | null;
  bullets: string[];
  ctaLabel: string | null;
  googleLabel: string | null;
  proofTitle: string | null;
  disclosure: string | null;
  afterSignupNote: string | null;
  sampleAlert: SampleAlert | null;
  ogTitle: string | null;
  ogDescription: string | null;
  variants: VariantInput[];
}

interface Props {
  mode: "create" | "edit";
  id?: string;
  strategies: StrategyOption[];
  initial?: PageForm;
  stats?: VariantStats[];
  updatedAt?: string;
}

const EMPTY: PageForm = {
  slug: "",
  kind: "GO",
  status: "DRAFT",
  templateSlug: "",
  eyebrow: null,
  logicLine: null,
  bullets: [],
  ctaLabel: null,
  googleLabel: null,
  proofTitle: null,
  disclosure: null,
  afterSignupNote: null,
  sampleAlert: null,
  ogTitle: null,
  ogDescription: null,
  variants: [{ key: "A", headline: "", subheadline: "", weight: 1, isActive: true }],
};

const SAMPLE_FIELDS: Array<{ key: keyof SampleAlert; label: string; wide?: boolean }> = [
  { key: "ticker", label: "Ticker" },
  { key: "companyName", label: "Company" },
  { key: "subject", label: "Email subject", wide: true },
  { key: "badge", label: "Badge" },
  { key: "alertType", label: "Alert type" },
  { key: "priceLabel", label: "Price label" },
  { key: "price", label: "Price" },
  { key: "change", label: "Change" },
  { key: "time", label: "Time" },
  { key: "volume", label: "Volume" },
  { key: "marketCap", label: "Market cap" },
  { key: "volumeMultiple", label: "Volume × average" },
  { key: "whyTitle", label: "Why title" },
  { key: "why", label: "Why (one line)", wide: true },
  { key: "context", label: "Context paragraph", wide: true },
];

const CARD = "rounded-[20px] border border-lp-border bg-white p-5 shadow-sm";
const SMALL_BTN = "rounded-lg border border-lp-border px-2.5 py-1 text-xs font-semibold text-lp-navy hover:border-lp-teal/40 disabled:opacity-50";

export function LandingPageEditor({ mode, id, strategies, initial, stats = [], updatedAt }: Props) {
  const router = useRouter();
  const [page, setPage] = useState<PageForm>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isHome = page.kind === "HOME";
  const strategy = strategies.find((s) => s.slug === page.templateSlug) ?? null;
  const statsByKey = useMemo(() => new Map(stats.map((s) => [s.key, s])), [stats]);
  const activeWeight = page.variants.filter((v) => v.isActive && v.weight > 0).reduce((n, v) => n + v.weight, 0);
  const warnings = page.variants.map((v) => ({ key: v.key, terms: complianceWarnings(`${v.headline} ${v.subheadline}`) })).filter((w) => w.terms.length);
  const publicPath = isHome ? "/" : `/go/${page.slug || "<slug>"}`;
  const sample = page.sampleAlert;

  const set = <K extends keyof PageForm>(key: K, value: PageForm[K]) => {
    setSaved(false);
    setPage((p) => ({ ...p, [key]: value }));
  };
  const setVariant = (key: string, patch: Partial<VariantInput>) => set("variants", page.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const textOrNull = (v: string) => (v.trim() ? v : null);

  /** Copy the strategy's landing copy into every blank field (and, when forced, into filled ones too). */
  function prefillFromStrategy(slug: string, force = false) {
    const s = strategies.find((x) => x.slug === slug);
    if (!s) return;
    setSaved(false);
    setPage((p) => {
      const d = s.defaults;
      const variants = p.variants.map((v, i) =>
        i === 0 && (force || (!v.headline && !v.subheadline)) ? { ...v, headline: d.headline, subheadline: d.subheadline } : v
      );
      return {
        ...p,
        templateSlug: slug,
        logicLine: force || !p.logicLine ? d.logicLine : p.logicLine,
        bullets: force || p.bullets.length === 0 ? d.bullets : p.bullets,
        ogTitle: force || !p.ogTitle ? null : p.ogTitle,
        ogDescription: force || !p.ogDescription ? null : p.ogDescription,
        sampleAlert: force ? null : p.sampleAlert,
        variants,
      };
    });
  }

  function addVariant() {
    const key = nextVariantKey(page.variants.map((v) => v.key));
    if (!key) return;
    const base = page.variants[page.variants.length - 1];
    set("variants", [...page.variants, { key, headline: base?.headline ?? "", subheadline: base?.subheadline ?? "", weight: base?.weight || 1, isActive: true }]);
  }

  function removeVariant(key: string) {
    if (page.variants.length <= 1) return;
    const s = statsByKey.get(key);
    if (s && (s.views > 0 || s.leads > 0) && !window.confirm(`Variant ${key} has ${s.views} views and ${s.leads} leads. Removing it deletes its view count (leads keep their tag). Continue?`)) return;
    set("variants", page.variants.filter((v) => v.key !== key));
  }

  function declareWinner(key: string) {
    set("variants", page.variants.map((v) => (v.key === key ? { ...v, isActive: true, weight: v.weight || 1 } : { ...v, isActive: false })));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/pages" : `/api/admin/pages/${id}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; page?: { id: string } } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Could not save the page.");
        return;
      }
      if (mode === "create" && payload?.page?.id) {
        // The edit page is force-dynamic, so it loads fresh data; a refresh() here would cancel the navigation.
        router.replace(`/admin/pages/${payload.page.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const previewHref = (key: string) => (isHome ? `/?v=${key}` : `/go/${page.slug}?preview=1&v=${key}`);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/pages" className="text-sm font-medium text-lp-teal hover:underline">
            ← All pages
          </Link>
          <h1 className="mt-2 font-serif text-4xl text-lp-navy">
            {mode === "create" ? "New landing page" : isHome ? "Homepage hero" : `/go/${page.slug}`}
          </h1>
          {mode === "edit" ? (
            <p className="mt-2 text-sm text-lp-navy/70">
              <a href={publicPath} target="_blank" rel="noreferrer" className="text-lp-teal hover:underline">
                {publicPath}
              </a>
              {updatedAt ? ` · last saved ${new Date(updatedAt).toLocaleString("en-US")}` : ""}
            </p>
          ) : null}
        </div>
        {saved ? <p className="rounded-full bg-lp-mint px-3 py-1 text-xs font-semibold text-lp-teal">Saved. Live on the next page load.</p> : null}
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {!isHome ? (
          <section className={CARD}>
            <h2 className="font-sans-heading text-lg font-semibold text-lp-navy">Page</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="slug" className={LABEL_CLASS}>
                  URL slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-lp-muted">/go/</span>
                  <input
                    id="slug"
                    required
                    disabled={mode === "edit"}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={40}
                    className={`${FIELD_CLASS} disabled:bg-lp-bg disabled:text-lp-navy/70`}
                    value={page.slug}
                    onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="breakouts-v2"
                  />
                </div>
                <p className="mt-1 text-xs text-lp-muted">{mode === "edit" ? "Fixed once created so ad links and attribution never break." : `Lowercase letters, digits and hyphens. "${HOME_SLUG}" is reserved.`}</p>
              </div>
              <div>
                <label htmlFor="status" className={LABEL_CLASS}>
                  Status
                </label>
                <select id="status" className={FIELD_CLASS} value={page.status} onChange={(e) => set("status", e.target.value as PageStatus)}>
                  <option value="DRAFT">Draft (admins only, via ?preview=1)</option>
                  <option value="LIVE">Live</option>
                  <option value="ARCHIVED">Archived (404 publicly)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="templateSlug" className={LABEL_CLASS}>
                  Strategy *
                </label>
                <select
                  id="templateSlug"
                  required
                  className={FIELD_CLASS}
                  value={page.templateSlug}
                  onChange={(e) => (mode === "create" ? prefillFromStrategy(e.target.value) : set("templateSlug", e.target.value))}
                >
                  <option value="">Pick a strategy…</option>
                  {strategies.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name} ({s.kind === "signal" ? "signal alerts" : "watchlist"})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-lp-muted">
                  Its alerts are shown as proof and activated for everyone who signs up on this page. Signups land on{" "}
                  <span className="font-mono">/welcome/{page.templateSlug || "<strategy>"}</span>.
                  {strategy ? (
                    <>
                      {" "}
                      <button type="button" onClick={() => prefillFromStrategy(strategy.slug, true)} className="font-semibold text-lp-teal hover:underline">
                        Reset copy from this strategy
                      </button>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-lp-border bg-white px-4 py-3 text-sm text-lp-navy/80">
            The homepage is always live. Only the hero headline and subheadline are managed here; the first line renders navy, the second line (after a line break) teal.
          </p>
        )}

        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-sans-heading text-lg font-semibold text-lp-navy">Headline variants</h2>
              <p className="mt-1 text-sm text-lp-navy/70">
                Visitors are split by weight and stay on the variant they first saw. Weight 0 or inactive removes a variant from rotation; its stats stay.
              </p>
            </div>
            <button type="button" onClick={addVariant} disabled={page.variants.length >= 26} className={SMALL_BTN}>
              + Add variant
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {page.variants.map((v) => {
              const s = statsByKey.get(v.key);
              const share = v.isActive && v.weight > 0 && activeWeight > 0 ? Math.round((v.weight / activeWeight) * 100) : 0;
              const test = s?.vsControl ?? null;
              return (
                <div key={v.key} className={`rounded-2xl border p-4 ${v.isActive && v.weight > 0 ? "border-lp-border bg-lp-bg" : "border-dashed border-lp-border bg-white opacity-80"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-lp-navy font-serif text-lg text-white">{v.key}</span>
                      <span className="text-sm text-lp-navy/80">{v.isActive && v.weight > 0 ? `${share}% of traffic` : "Paused"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mode === "edit" ? (
                        <a href={previewHref(v.key)} target="_blank" rel="noreferrer" className={SMALL_BTN}>
                          Preview
                        </a>
                      ) : null}
                      {page.variants.length > 1 ? (
                        <button type="button" onClick={() => declareWinner(v.key)} className={SMALL_BTN} title="Keep this variant, pause the others (saved with the form)">
                          Declare winner
                        </button>
                      ) : null}
                      {page.variants.length > 1 ? (
                        <button type="button" onClick={() => removeVariant(v.key)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <label htmlFor={`headline-${v.key}`} className={LABEL_CLASS}>
                        Headline *
                      </label>
                      <textarea
                        id={`headline-${v.key}`}
                        required
                        rows={3}
                        maxLength={LIMITS.headline}
                        className={`${FIELD_CLASS} h-auto py-2 font-serif text-lg`}
                        value={v.headline}
                        onChange={(e) => setVariant(v.key, { headline: e.target.value })}
                      />
                      <p className="mt-1 text-xs text-lp-muted">{isHome ? "Line break = teal second line." : "Line breaks are kept on desktop, joined with spaces on phones."}</p>
                    </div>
                    <div>
                      <label htmlFor={`sub-${v.key}`} className={LABEL_CLASS}>
                        Subheadline *
                      </label>
                      <textarea
                        id={`sub-${v.key}`}
                        required
                        rows={3}
                        maxLength={LIMITS.subheadline}
                        className={`${FIELD_CLASS} h-auto py-2`}
                        value={v.subheadline}
                        onChange={(e) => setVariant(v.key, { subheadline: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-5">
                    <div>
                      <label htmlFor={`weight-${v.key}`} className={LABEL_CLASS}>
                        Weight (0–100)
                      </label>
                      <input
                        id={`weight-${v.key}`}
                        type="number"
                        min={0}
                        max={100}
                        className={`${FIELD_CLASS} w-28`}
                        value={v.weight}
                        onChange={(e) => setVariant(v.key, { weight: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
                      />
                    </div>
                    <label className="flex h-11 items-center gap-2 text-sm text-lp-navy">
                      <input type="checkbox" checked={v.isActive} onChange={(e) => setVariant(v.key, { isActive: e.target.checked })} className="h-4 w-4 accent-lp-teal" />
                      Active
                    </label>
                    {s ? (
                      <dl className="ml-auto grid grid-cols-4 gap-x-6 text-right text-sm tabular-nums text-lp-navy sm:grid-cols-5">
                        <div>
                          <dt className="text-[11px] uppercase tracking-[0.12em] text-lp-muted">Views</dt>
                          <dd className="font-semibold">{s.views.toLocaleString("en-US")}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-[0.12em] text-lp-muted">Leads</dt>
                          <dd className="font-semibold">{s.leads.toLocaleString("en-US")}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-[0.12em] text-lp-muted">Confirmed</dt>
                          <dd className="font-semibold">{s.confirmed.toLocaleString("en-US")}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-[0.12em] text-lp-muted">Lead rate</dt>
                          <dd className="font-semibold">{pct(s.conversion)}</dd>
                        </div>
                        <div className="col-span-4 sm:col-span-1">
                          <dt className="text-[11px] uppercase tracking-[0.12em] text-lp-muted">vs A</dt>
                          <dd className="font-semibold">
                            {test ? (
                              <span className={test.label === "significant" ? (test.lift !== null && test.lift > 0 ? "text-lp-green" : "text-red-700") : "text-lp-navy/80"}>
                                {test.lift !== null ? `${test.lift >= 0 ? "+" : ""}${(test.lift * 100).toFixed(0)}%` : "—"}
                                <span className="ml-1 font-normal text-lp-muted">
                                  {test.label}
                                  {test.confidence !== null ? ` (${test.confidence.toFixed(0)}%)` : ""}
                                </span>
                              </span>
                            ) : (
                              <span className="text-lp-muted">control</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {warnings.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Compliance check</p>
              <ul className="mt-1 list-disc pl-5">
                {warnings.map((w) => (
                  <li key={w.key}>
                    Variant {w.key} uses {w.terms.map((t) => `"${t}"`).join(", ")}. No guarantees or &quot;risk-free&quot;; &quot;secret&quot; and &quot;insider&quot; only in the SEC Form 4 sense.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-lp-muted">
            Read the test after at least 30 leads per variant. &quot;Significant&quot; means less than a 5% chance the difference is noise (two-proportion z-test on lead rate). Changing weights reshuffles some visitors between variants.
          </p>
        </section>

        {!isHome ? (
          <section className={CARD}>
            <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex w-full items-center justify-between text-left">
              <span>
                <span className="font-sans-heading text-lg font-semibold text-lp-navy">Advanced copy</span>
                <span className="mt-1 block text-sm text-lp-navy/70">Optional. Blank fields use the shared defaults or the strategy&apos;s own copy.</span>
              </span>
              <span className="text-sm font-semibold text-lp-teal">{showAdvanced ? "Hide" : "Show"}</span>
            </button>
            {showAdvanced ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="eyebrow" className={LABEL_CLASS}>
                      Eyebrow
                    </label>
                    <input id="eyebrow" maxLength={LIMITS.eyebrow} className={FIELD_CLASS} value={page.eyebrow ?? ""} onChange={(e) => set("eyebrow", textOrNull(e.target.value))} placeholder={DEFAULTS.eyebrow} />
                  </div>
                  <div>
                    <label htmlFor="ctaLabel" className={LABEL_CLASS}>
                      Button label
                    </label>
                    <input id="ctaLabel" maxLength={LIMITS.ctaLabel} className={FIELD_CLASS} value={page.ctaLabel ?? ""} onChange={(e) => set("ctaLabel", textOrNull(e.target.value))} placeholder={DEFAULTS.ctaLabel} />
                  </div>
                  <div>
                    <label htmlFor="googleLabel" className={LABEL_CLASS}>
                      Google button label
                    </label>
                    <input id="googleLabel" maxLength={LIMITS.googleLabel} className={FIELD_CLASS} value={page.googleLabel ?? ""} onChange={(e) => set("googleLabel", textOrNull(e.target.value))} placeholder={DEFAULTS.googleLabel} />
                  </div>
                  <div>
                    <label htmlFor="proofTitle" className={LABEL_CLASS}>
                      Proof section title
                    </label>
                    <input id="proofTitle" maxLength={LIMITS.proofTitle} className={FIELD_CLASS} value={page.proofTitle ?? ""} onChange={(e) => set("proofTitle", textOrNull(e.target.value))} placeholder={DEFAULTS.proofTitle} />
                  </div>
                </div>
                <div>
                  <label htmlFor="logicLine" className={LABEL_CLASS}>
                    Why this works (one paragraph under the proof title)
                  </label>
                  <textarea id="logicLine" rows={3} maxLength={LIMITS.logicLine} className={`${FIELD_CLASS} h-auto py-2`} value={page.logicLine ?? ""} onChange={(e) => set("logicLine", textOrNull(e.target.value))} placeholder={strategy?.defaults.logicLine ?? ""} />
                </div>
                <div>
                  <label htmlFor="bullets" className={LABEL_CLASS}>
                    Bullets (one per line, up to {LIMITS.bullets})
                  </label>
                  <textarea
                    id="bullets"
                    rows={4}
                    className={`${FIELD_CLASS} h-auto py-2`}
                    value={page.bullets.join("\n")}
                    onChange={(e) => set("bullets", e.target.value.split("\n").slice(0, LIMITS.bullets))}
                    placeholder={strategy?.defaults.bullets.join("\n") ?? ""}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ogTitle" className={LABEL_CLASS}>
                      Share title (OG)
                    </label>
                    <input id="ogTitle" maxLength={LIMITS.og} className={FIELD_CLASS} value={page.ogTitle ?? ""} onChange={(e) => set("ogTitle", textOrNull(e.target.value))} placeholder="Defaults to variant A's headline" />
                  </div>
                  <div>
                    <label htmlFor="ogDescription" className={LABEL_CLASS}>
                      Share description (OG)
                    </label>
                    <input id="ogDescription" maxLength={LIMITS.og} className={FIELD_CLASS} value={page.ogDescription ?? ""} onChange={(e) => set("ogDescription", textOrNull(e.target.value))} placeholder="Defaults to variant A's subheadline" />
                  </div>
                  <div>
                    <label htmlFor="disclosure" className={LABEL_CLASS}>
                      Disclosure line
                    </label>
                    <input id="disclosure" maxLength={LIMITS.disclosure} className={FIELD_CLASS} value={page.disclosure ?? ""} onChange={(e) => set("disclosure", textOrNull(e.target.value))} placeholder={DEFAULTS.disclosure} />
                  </div>
                  <div>
                    <label htmlFor="afterSignupNote" className={LABEL_CLASS}>
                      After-signup note
                    </label>
                    <input id="afterSignupNote" maxLength={LIMITS.afterSignupNote} className={FIELD_CLASS} value={page.afterSignupNote ?? ""} onChange={(e) => set("afterSignupNote", textOrNull(e.target.value))} placeholder={DEFAULTS.afterSignupNote} />
                  </div>
                </div>

                <fieldset className="rounded-[16px] border border-lp-border bg-lp-bg p-4">
                  <legend className="px-1 text-sm font-semibold text-lp-navy">Sample alert (the email inside the phone)</legend>
                  {sample ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {SAMPLE_FIELDS.map((f) => (
                          <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
                            <label htmlFor={`sample-${f.key}`} className={LABEL_CLASS}>
                              {f.label}
                            </label>
                            {f.key === "context" ? (
                              <textarea
                                id={`sample-${f.key}`}
                                rows={3}
                                maxLength={LIMITS.sampleField}
                                className={`${FIELD_CLASS} h-auto py-2`}
                                value={String(sample[f.key] ?? "")}
                                onChange={(e) => set("sampleAlert", { ...sample, [f.key]: e.target.value })}
                              />
                            ) : (
                              <input
                                id={`sample-${f.key}`}
                                maxLength={LIMITS.sampleField}
                                className={FIELD_CLASS}
                                value={String(sample[f.key] ?? "")}
                                onChange={(e) => set("sampleAlert", { ...sample, [f.key]: f.key === "volumeMultiple" ? (e.target.value as unknown as number) : e.target.value })}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => set("sampleAlert", null)} className={`${SMALL_BTN} mt-4`}>
                        Use the strategy&apos;s own sample instead
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-lp-navy/80">Using {strategy ? `${strategy.name}'s` : "the strategy's"} built-in sample alert ({strategy?.defaults.sampleAlert.ticker ?? "…"}).</p>
                      <button type="button" disabled={!strategy} onClick={() => strategy && set("sampleAlert", { ...strategy.defaults.sampleAlert })} className={SMALL_BTN}>
                        Customize
                      </button>
                    </div>
                  )}
                </fieldset>
              </div>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center rounded-xl bg-lp-teal px-6 text-sm font-semibold text-white shadow-sm hover:bg-lp-teal-dark disabled:opacity-60">
            {saving ? "Saving…" : mode === "create" ? "Create page" : "Save changes"}
          </button>
          <Link href="/admin/pages" className="text-sm font-medium text-lp-navy/70 hover:text-lp-navy">
            {mode === "create" ? "Cancel" : "Back to pages"}
          </Link>
        </div>
      </form>
    </div>
  );
}
