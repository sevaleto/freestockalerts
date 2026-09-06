import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { Footer } from "@/components/shared/Footer";
import { StrategyCard } from "@/components/templates/StrategyCard";
import { groupedBySection, STRATEGIES } from "@/lib/templates/catalog";
import { SECTION_ICONS } from "@/lib/templates/icons";

export const metadata: Metadata = {
  title: "Alert Strategies",
  description:
    "Ten ready-made alert strategies for idea discovery, entry timing and market monitoring. Each one states its universe, qualification rules, trigger and refresh date. Free to activate.",
  alternates: { canonical: "/templates" },
  openGraph: {
    title: "Alert Strategies | FreeStockAlerts.AI",
    description:
      "Ten ready-made alert strategies: screened breakout lists, pullback and reclaim alerts, dividend buy zones, sector leadership and market stress. Free to activate.",
    url: "/templates",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alert Strategies | FreeStockAlerts.AI",
    description: "Ten ready-made alert strategies with stated rules, triggers and refresh dates. Free to activate.",
    images: ["/og-image.png"],
  },
};

export default function TemplatesPage() {
  const groups = groupedBySection();
  const total = STRATEGIES.length;
  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-6 sm:py-8">
        <Logo size="lg" />
        <Link
          href="/login"
          className="inline-flex h-10 shrink-0 items-center rounded-xl bg-lp-teal px-4 text-sm font-semibold text-white hover:bg-lp-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-teal focus-visible:ring-offset-2"
        >
          Get started
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Alert strategies</p>
          <h1 className="font-serif text-4xl text-lp-navy md:text-5xl">{total} alert strategies, each one a defined setup.</h1>
          <p className="text-base leading-relaxed text-lp-navy/75 md:text-lg">
            Every strategy states what it watches, how a company qualifies, the one trigger that sends the email, and when the list was last refreshed. Preview a strategy, then activate every alert in it with one click.
          </p>
          <p className="text-sm text-lp-muted">Educational information only. Strategies surface research candidates; nothing here is a recommendation to buy or sell.</p>
        </div>

        {groups.map(({ section, strategies }) => {
          const Icon = SECTION_ICONS[section.id];
          const featured = section.id === "IDEA_DISCOVERY";
          return (
            <section key={section.id} aria-labelledby={`section-${section.id}`} className="mt-14 first-of-type:mt-12">
              <div className="flex flex-col gap-2 border-b border-lp-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id={`section-${section.id}`} className="flex items-center gap-2.5 font-serif text-2xl text-lp-navy md:text-3xl">
                    <Icon className="h-6 w-6 text-lp-teal" aria-hidden />
                    {section.label}
                  </h2>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-lp-navy/70">{section.blurb}</p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lp-muted">
                  {strategies.length} {strategies.length === 1 ? "strategy" : "strategies"}
                </p>
              </div>
              {strategies.length === 0 ? (
                <p className="mt-6 rounded-[20px] border border-lp-border bg-white p-6 text-sm text-lp-muted">No strategies in this section yet.</p>
              ) : (
                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {strategies.map((s) => (
                    <StrategyCard key={s.id} strategy={s} featured={featured && s.isFeatured} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
