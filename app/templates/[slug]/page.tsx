export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Logo } from "@/components/shared/Logo";
import { Footer } from "@/components/shared/Footer";
import { TrackViewContent } from "@/components/shared/TrackViewContent";
import { StrategyDetail } from "@/components/templates/StrategyDetail";
import { getStrategy, SECTIONS } from "@/lib/templates/catalog";
import { isLegacyTemplateSlug, resolveTemplateSlug } from "@/lib/templates/redirects";
import { loadStrategyView } from "@/lib/templates/view";

interface TemplateDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: TemplateDetailPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const strategy = getStrategy(resolveTemplateSlug(slug));
  if (!strategy) return { title: "Strategy not found", robots: { index: false } };
  const url = `/templates/${strategy.slug}`;
  return {
    title: strategy.seo.title,
    description: strategy.seo.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${strategy.seo.title} | FreeStockAlerts.AI`,
      description: strategy.seo.description,
      url,
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: strategy.seo.title,
      description: strategy.seo.description,
      images: ["/og-image.png"],
    },
  };
}

export default async function TemplateDetailPage(props: TemplateDetailPageProps) {
  const { slug } = await props.params;
  // Old template URLs (bookmarks, ads, emails) land on the strategy that replaced them.
  if (isLegacyTemplateSlug(slug)) permanentRedirect(`/templates/${resolveTemplateSlug(slug)}`);

  const view = await loadStrategyView(slug);
  if (!view) notFound();
  const { strategy, items, lastRefreshedAt, signals } = view;

  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-6 sm:py-8">
        <Logo size="lg" />
        <Link href="/templates" className="shrink-0 text-sm text-text-secondary hover:text-text-primary">
          ← All strategies
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6">
        <TrackViewContent name={strategy.name} slug={strategy.slug} />
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-lp-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/templates" className="hover:text-lp-navy">
                Strategies
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>{SECTIONS[strategy.section].label}</li>
            <li aria-hidden>/</li>
            <li className="text-lp-navy" aria-current="page">
              {strategy.name}
            </li>
          </ol>
        </nav>
        <StrategyDetail strategy={strategy} items={items} lastRefreshedAt={lastRefreshedAt} signals={signals} />
      </main>
      <Footer />
    </div>
  );
}
