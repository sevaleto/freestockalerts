import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma/client";
import { getStrategy } from "@/lib/templates/catalog";
import { getBatchQuotes } from "@/lib/api/quotes";
import { fetchFmpAvgVolume, fetchFmpRsi } from "@/lib/api/fmp";
import { watchlistMetric, type WatchlistQuote } from "@/lib/lp/watchlistMetric";
import { getLandingPageView } from "@/lib/lp/store";
import { BUCKET_COOKIE, bucketFromCookie, isPageSlug } from "@/lib/cookies/bucket";
import { getAdminUser } from "@/lib/auth/admin";
import { Logo } from "@/components/shared/Logo";
import { TrackViewContent } from "@/components/shared/TrackViewContent";
import { HeadlineExposure } from "@/components/ab/HeadlineExposure";
import { AlertProofList } from "@/components/lp/AlertProofList";
import type { DescribableItem } from "@/lib/alerts/describe";
import { PhoneEmailPreview } from "@/components/lp/PhoneEmailPreview";
import { WatchlistPreview, type WatchlistRow } from "@/components/lp/WatchlistPreview";
import { MemberBenefits } from "@/components/lp/MemberBenefits";
import { HonestAnswer } from "@/components/lp/HonestAnswer";
import { LpFooter } from "@/components/lp/LpFooter";
import { LandingSignup } from "./LandingSignup";
import { SignalList } from "@/components/templates/SignalList";
import { loadRecentSignals } from "@/lib/strategies/signals";
import { CheckCircle2 } from "lucide-react";

/**
 * Ad landing pages, managed in /admin/pages. Rendered per request (the
 * headline variant depends on the visitor's bucket cookie); page copy and the
 * watchlist proof data come from the data cache, so the database and the
 * market-data provider are hit at most once an hour per page.
 *
 *   /go/<slug>             live pages only, unknown or unpublished → 404
 *   /go/<slug>?v=B         force a variant (previews; views are not counted)
 *   /go/<slug>?preview=1   admins can view DRAFT / ARCHIVED pages
 */

const WATCHLIST_ROWS = 5;
const PROOF_REVALIDATE_SEC = 3600;

type Param = string | string[] | undefined;
interface LpPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: Param; preview?: Param }>;
}

const single = (v: Param) => (typeof v === "string" ? v : null);

async function resolvePage(props: LpPageProps) {
  const [{ slug }, sp, jar] = await Promise.all([props.params, props.searchParams, cookies()]);
  if (!isPageSlug(slug)) return null;
  const forceKey = single(sp.v)?.toUpperCase() ?? null;
  const allowDraft = single(sp.preview) === "1" ? !!(await getAdminUser()) : false;
  const bucket = bucketFromCookie(jar.get(BUCKET_COOKIE)?.value);
  return getLandingPageView(slug, bucket, { forceKey, allowDraft });
}

export async function generateMetadata(props: LpPageProps): Promise<Metadata> {
  const resolved = await resolvePage(props);
  if (!resolved) return {};
  const { view } = resolved;
  return {
    title: view.ogTitle,
    description: view.ogDescription,
    robots: { index: false, follow: false },
    openGraph: { title: view.ogTitle, description: view.ogDescription, url: `/go/${view.slug}`, images: ["/og-image.png"] },
    twitter: { card: "summary_large_image", title: view.ogTitle, description: view.ogDescription, images: ["/og-image.png"] },
  };
}

interface ProofItem extends DescribableItem {
  sortOrder: number;
}
interface Proof {
  name: string;
  slug: string;
  items: ProofItem[];
  /** Live price + distance to trigger for the first few items (one more than shown, so the sample ticker can be skipped). */
  rows: WatchlistRow[];
}

/** Prisma first (matches what activation creates); catalog fallback so an ad page never 404s. */
async function loadTemplate(templateSlug: string): Promise<{ name: string; slug: string; items: ProofItem[] } | null> {
  try {
    const t = await prisma.alertTemplate.findUnique({
      where: { slug: templateSlug },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (t) return { name: t.name, slug: t.slug, items: t.items.map(toProofItem) };
  } catch (err) {
    console.error(`[lp] template load failed for ${templateSlug}:`, err);
  }
  const strategy = getStrategy(templateSlug);
  return strategy ? { name: strategy.name, slug: strategy.slug, items: strategy.items.map(toProofItem) } : null;
}

function toProofItem(i: { ticker: string; companyName?: string | null; alertType: string; triggerValue: number; triggerDirection: string; rationale?: string | null; sortOrder: number }): ProofItem {
  return { ticker: i.ticker, companyName: i.companyName ?? null, alertType: i.alertType, triggerValue: i.triggerValue, triggerDirection: i.triggerDirection, rationale: i.rationale ?? null, sortOrder: i.sortOrder };
}

/** Live price + "distance to trigger" for each watchlist row. Rows degrade to ticker + rationale if data is missing. */
async function loadWatchlistRows(items: ProofItem[]): Promise<WatchlistRow[]> {
  let quotes: Record<string, WatchlistQuote> = {};
  try {
    const raw = (await getBatchQuotes(items.map((i) => i.ticker), { skipMock: true })) as Array<WatchlistQuote & { ticker: string }>;
    quotes = Object.fromEntries(raw.filter((q) => q.price > 0).map((q) => [q.ticker.toUpperCase(), q]));
  } catch (err) {
    console.error("[lp] quotes failed:", err);
  }

  // Only fetch the extra indicator a row actually needs.
  await Promise.all(
    items.map(async (item) => {
      const q = quotes[item.ticker.toUpperCase()];
      if (!q) return;
      try {
        if (item.alertType.startsWith("RSI_")) {
          const rsi = await fetchFmpRsi(item.ticker);
          if (rsi) q.rsi = rsi.rsi;
        } else if (item.alertType === "VOLUME_SPIKE" && !q.avgVolume) {
          q.avgVolume = (await fetchFmpAvgVolume(item.ticker)) ?? undefined;
        }
      } catch (err) {
        console.error(`[lp] indicator failed for ${item.ticker}:`, err);
      }
    })
  );

  return items.map((item) => {
    const q = quotes[item.ticker.toUpperCase()];
    return { item, price: q?.price, metric: q ? watchlistMetric(item, q) : null };
  });
}

/**
 * Template + watchlist quotes, cached per strategy for an hour. This is what
 * keeps per-visitor rendering from turning every ad click into FMP calls.
 */
const loadProofCached = (templateSlug: string): Promise<Proof | null> =>
  unstable_cache(
    async () => {
      const template = await loadTemplate(templateSlug);
      if (!template) return null;
      const isSignal = getStrategy(templateSlug)?.kind === "signal";
      const rows = isSignal ? [] : await loadWatchlistRows(template.items.slice(0, WATCHLIST_ROWS + 1));
      return { ...template, rows };
    },
    ["lp-proof", templateSlug],
    { revalidate: PROOF_REVALIDATE_SEC, tags: ["lp:proof"] }
  )();

export default async function LandingPage(props: LpPageProps) {
  const resolved = await resolvePage(props);
  if (!resolved) notFound();
  const { view: lp, forced } = resolved;
  const proof = await loadProofCached(lp.templateSlug);
  if (!proof) notFound();
  const strategy = getStrategy(lp.templateSlug);
  const isSignal = strategy?.kind === "signal";

  const sampleTicker = lp.sampleAlert.ticker.toUpperCase();
  const rows = isSignal ? [] : proof.rows.filter((r) => r.item.ticker.toUpperCase() !== sampleTicker).slice(0, WATCHLIST_ROWS);
  const recent = isSignal ? await loadRecentSignals(lp.templateSlug, 3) : null;

  const disclosure = <p className="text-sm text-lp-muted">{lp.disclosure}</p>;

  return (
    <div className="flex min-h-screen flex-col bg-lp-bg text-lp-navy">
      <TrackViewContent name={lp.metaContentName} slug={lp.slug} contentType="landing_page" />
      <HeadlineExposure tag={lp.variantTag} count={!forced && lp.status === "LIVE"} />
      {lp.status !== "LIVE" ? (
        <p className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
          Admin preview: this page is {lp.status.toLowerCase()} and not visible to the public. Variant {lp.variantKey}.
        </p>
      ) : null}

      <section className="mx-auto w-full max-w-[1440px] px-5 pb-16 pt-7 sm:px-8 md:pt-12 lg:px-12 lg:pb-24 xl:pt-14">
        <header className="mb-10 md:mb-14 xl:mb-16">
          <Logo linked={false} size="lg" />
        </header>

        <div className="grid gap-12 lg:grid-cols-[44fr_56fr] lg:gap-14 xl:gap-20">
          {/* Brand promise + signup */}
          <div className="flex flex-col">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-lp-blue sm:text-sm sm:tracking-[0.18em]">{lp.eyebrow}</p>
            <h1 className="mt-4 font-serif text-[clamp(2.625rem,10vw,3.25rem)] leading-[1.02] tracking-[-0.01em] text-lp-navy md:text-[clamp(3.25rem,4.45vw,4.5rem)] lg:-mr-10 lg:whitespace-pre-line xl:-mr-16">
              <span className="lg:hidden">{lp.headline.replace(/\n/g, " ")}</span>
              <span className="hidden lg:inline">{lp.headline}</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-xl leading-relaxed text-lp-navy/80 md:text-[1.3rem]">{lp.subheadline}</p>

            <div className="mt-7">
              <LandingSignup lp={lp} />
            </div>

            <div className="mt-8 hidden lg:block">{disclosure}</div>
          </div>

          {/* Product proof */}
          <div className="flex flex-col gap-6">
            <PhoneEmailPreview alert={lp.sampleAlert} />
            {isSignal && strategy ? (
              <SignalList signals={recent?.signals ?? []} lastScanAt={recent?.lastScan?.finishedAt ?? recent?.lastScan?.startedAt ?? null} strategyName={strategy.name} title="Latest confirmed signals" compact />
            ) : (
              <WatchlistPreview rows={rows} title={lp.proofTitle} />
            )}
            <div className="lg:hidden">{disclosure}</div>
          </div>
        </div>
      </section>

      <section className="border-t border-lp-border/70 bg-white py-16">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">What you&apos;ll be watching</p>
              <h2 className="mt-3 font-serif text-3xl text-lp-navy md:text-4xl">{lp.proofTitle}</h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-lp-navy/75">{lp.logicLine}</p>
            </div>
            <ul className="grid gap-2 text-[15px] text-lp-navy sm:grid-cols-3 lg:grid-cols-1">
              {lp.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 rounded-xl border border-lp-border/70 bg-lp-bg px-3.5 py-2.5">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-lp-teal" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          {isSignal && strategy ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-[20px] border border-lp-border bg-lp-bg p-6">
                <h3 className="text-base font-semibold text-lp-navy">How a stock qualifies</h3>
                <ul className="mt-3 space-y-2 text-sm text-lp-navy/85">
                  {strategy.qualificationRules.map((r) => (
                    <li key={r} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lp-green" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[20px] border border-lp-border bg-lp-bg p-6">
                <h3 className="text-base font-semibold text-lp-navy">What is left out</h3>
                <ul className="mt-3 space-y-2 text-sm text-lp-navy/85">
                  {strategy.disqualifiers.map((r) => (
                    <li key={r} className="flex items-start gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lp-teal" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-lp-muted">
                  Full rules, scoring and data limits:{" "}
                  <span className="underline underline-offset-2">freestockalerts.ai/templates/{strategy.slug}</span>
                </p>
              </div>
            </div>
          ) : (
            <AlertProofList items={proof.items} title={`All ${proof.items.length} alerts`} columns={2} className="mt-8" />
          )}
          <p className="mt-6 text-center text-sm text-lp-muted">{lp.afterSignupNote}</p>
        </div>
      </section>

      <MemberBenefits templateName={proof.name} ctaLabel={lp.ctaLabel} />
      <HonestAnswer ctaLabel={lp.ctaLabel} />
      <LpFooter />
    </div>
  );
}
