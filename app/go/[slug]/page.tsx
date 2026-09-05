import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { mockTemplates } from "@/lib/mock/templates";
import { getBatchQuotes } from "@/lib/api/quotes";
import { fetchFmpAvgVolume, fetchFmpRsi } from "@/lib/api/fmp";
import { watchlistMetric, type WatchlistQuote } from "@/lib/lp/watchlistMetric";
import { getLandingPage, LP_SLUGS } from "@/lib/lp/pages";
import { Logo } from "@/components/shared/Logo";
import { TrackViewContent } from "@/components/shared/TrackViewContent";
import { AlertProofList } from "@/components/lp/AlertProofList";
import type { DescribableItem } from "@/lib/alerts/describe";
import { PhoneEmailPreview } from "@/components/lp/PhoneEmailPreview";
import { WatchlistPreview, type WatchlistRow } from "@/components/lp/WatchlistPreview";
import { MemberBenefits } from "@/components/lp/MemberBenefits";
import { HonestAnswer } from "@/components/lp/HonestAnswer";
import { LpFooter } from "@/components/lp/LpFooter";
import { LandingSignup } from "./LandingSignup";

// Ad pages: static, refreshed hourly, unknown slugs 404.
export const revalidate = 3600;
export const dynamicParams = false;

const WATCHLIST_ROWS = 5;

interface LpPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LP_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: LpPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const lp = getLandingPage(slug);
  if (!lp) return {};
  const title = lp.ogTitle ?? lp.headline.replace(/\n/g, " ");
  const description = lp.ogDescription ?? lp.subheadline;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, url: `/go/${lp.slug}`, images: ["/og-image.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  };
}

/** Prisma first (matches what activation creates); mock fallback so an ad page never 404s. */
async function loadTemplate(templateSlug: string) {
  try {
    const t = await prisma.alertTemplate.findUnique({
      where: { slug: templateSlug },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (t) return t;
  } catch (err) {
    console.error(`[lp] template load failed for ${templateSlug}:`, err);
  }
  return mockTemplates.find((t) => t.slug === templateSlug) ?? null;
}

/**
 * Live price + "distance to trigger" for each watchlist row. Refreshed with
 * the page (hourly). Rows degrade to ticker + rationale if data is missing.
 */
async function loadWatchlistRows(items: DescribableItem[]): Promise<WatchlistRow[]> {
  let quotes: Record<string, WatchlistQuote> = {};
  try {
    const raw = (await getBatchQuotes(items.map((i) => i.ticker), { skipMock: true })) as Array<
      WatchlistQuote & { ticker: string }
    >;
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

export default async function LandingPage(props: LpPageProps) {
  const { slug } = await props.params;
  const lp = getLandingPage(slug);
  if (!lp) notFound();
  const template = await loadTemplate(lp.templateSlug);
  if (!template) notFound();

  const watchlist = template.items
    .filter((i) => i.ticker.toUpperCase() !== lp.sampleAlert.ticker.toUpperCase())
    .slice(0, WATCHLIST_ROWS);
  const rows = await loadWatchlistRows(watchlist);

  const disclosure = <p className="text-sm text-lp-muted">{lp.disclosure}</p>;

  return (
    <div className="flex min-h-screen flex-col bg-lp-bg text-lp-navy">
      <TrackViewContent name={lp.metaContentName} slug={lp.slug} contentType="landing_page" />

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
            <WatchlistPreview rows={rows} title={lp.proofTitle} />
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
          <AlertProofList items={template.items} title={`All ${template.items.length} alerts`} columns={2} className="mt-8" />
          <p className="mt-6 text-center text-sm text-lp-muted">{lp.afterSignupNote}</p>
        </div>
      </section>

      <MemberBenefits templateName={template.name} ctaLabel={lp.ctaLabel} />
      <HonestAnswer ctaLabel={lp.ctaLabel} />
      <LpFooter />
    </div>
  );
}
