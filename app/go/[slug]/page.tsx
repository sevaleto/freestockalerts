import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma/client";
import { mockTemplates } from "@/lib/mock/templates";
import { getLandingPage, LP_SLUGS } from "@/lib/lp/pages";
import { Logo } from "@/components/shared/Logo";
import { TrackViewContent } from "@/components/shared/TrackViewContent";
import { AlertProofList } from "@/components/lp/AlertProofList";
import { LpFooter } from "@/components/lp/LpFooter";
import { LandingSignup } from "./LandingSignup";

// Ad pages: static, refreshed hourly, unknown slugs 404.
export const revalidate = 3600;
export const dynamicParams = false;

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
  const title = lp.ogTitle ?? lp.headline;
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

export default async function LandingPage(props: LpPageProps) {
  const { slug } = await props.params;
  const lp = getLandingPage(slug);
  if (!lp) notFound();
  const template = await loadTemplate(lp.templateSlug);
  if (!template) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TrackViewContent name={lp.metaContentName} slug={lp.slug} contentType="landing_page" />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-12 pt-6 md:pb-16 md:pt-8">
          <header className="flex items-center justify-between">
            <Logo linked={false} />
            <span className="hidden text-xs font-medium text-slate-500 sm:block">Free stock alerts with AI context</span>
          </header>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                <Zap className="h-3.5 w-3.5" />
                {lp.badge}
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-text-primary md:text-[3.25rem]">
                  {lp.headline}
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-slate-600 md:text-xl">{lp.subheadline}</p>
                <p className="max-w-xl rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-relaxed text-slate-700">
                  <span className="mr-1 font-semibold uppercase tracking-wider text-primary">Why it works</span>
                  {lp.logicLine}
                </p>
              </div>

              <ul className="space-y-2">
                {lp.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {b}
                  </li>
                ))}
              </ul>

              <LandingSignup lp={lp} />
            </div>

            <AlertProofList items={template.items} title={lp.proofTitle} />
          </div>

          <p className="text-center text-sm text-slate-500">{lp.afterSignupNote}</p>
        </div>
      </section>

      <div className="flex-1" />
      <LpFooter />
    </div>
  );
}
