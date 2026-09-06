import Link from "next/link";
import { ArrowUpRight, Bell, RefreshCw } from "lucide-react";
import { getStrategy, STRATEGIES, type StrategyDefinition } from "@/lib/templates/catalog";
import { strategyIcon } from "@/lib/templates/icons";
import { shortCadence } from "@/lib/templates/format";
import { TemplateCardLink } from "@/components/landing/TemplateCardLink";
import { SectionChip } from "@/components/templates/SectionChip";

export function TemplatePreview() {
  // The three featured idea-discovery strategies; the rest live on /templates.
  const FEATURED = ["post-earnings-strength-radar", "quality-breakout-radar", "under-the-radar-breakouts"];
  const templates = FEATURED.map(getStrategy).filter((t): t is StrategyDefinition => !!t && t.items.length > 0);
  const remaining = STRATEGIES.length - templates.length;
  return (
    <section id="templates" className="border-t border-lp-border/70 bg-lp-bg py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Alert strategies</p>
            <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">Pick a strategy. Activate a full watchlist.</h2>
            <p className="text-base leading-relaxed text-lp-navy/75">
              Each strategy is a defined setup: a screened list, one specific trigger, and a stated refresh date. Activate every alert in it with one click. {remaining} more strategies wait on your dashboard.
            </p>
          </div>
          <Link href="/templates" className="inline-flex items-center gap-2 text-sm font-semibold text-lp-teal hover:text-lp-teal-dark">
            Browse all strategies <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const Icon = strategyIcon(template.icon);
            const tickers = Array.from(new Set(template.items.map((i) => i.ticker)));
            return (
              <TemplateCardLink
                key={template.id}
                slug={template.slug}
                name={template.name}
                className="group flex h-full flex-col rounded-[20px] border border-lp-border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-lp-teal/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lp-mint text-lp-teal" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-lp-mint px-3 py-1 text-xs font-semibold text-lp-teal">Activate free →</span>
                </div>
                <SectionChip section={template.section} className="mt-4 w-fit" />
                <h3 className="mt-3 text-lg font-semibold text-lp-navy group-hover:text-lp-teal">{template.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-lp-navy/75">{template.valueProposition}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tickers.slice(0, 4).map((ticker) => (
                    <span key={ticker} className="rounded-md bg-lp-bg px-2 py-1 font-mono text-xs font-medium text-lp-navy">
                      {ticker}
                    </span>
                  ))}
                  {tickers.length > 4 && <span className="rounded-md bg-lp-bg px-2 py-1 text-xs text-lp-muted">+{tickers.length - 4} more</span>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-lp-border/70 pt-3 text-xs text-lp-muted">
                  <span className="flex items-center gap-1.5 font-semibold"><Bell className="h-3.5 w-3.5" aria-hidden />{template.items.length} alerts</span>
                  <span className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" aria-hidden />{shortCadence(template)}</span>
                </div>
              </TemplateCardLink>
            );
          })}
        </div>

        <div className="mt-12 rounded-[20px] border border-lp-teal/20 bg-lp-mint p-8 md:p-10">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <h3 className="font-serif text-2xl text-lp-navy md:text-3xl">Activate an entire watchlist in one click</h3>
              <p className="mt-2 text-base text-lp-navy/75">
                Sign up, pick a strategy, and every alert in it goes live at once. Edit or pause any of them from your dashboard.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Link
                href="#signup"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-lp-teal px-8 text-base font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark"
              >
                Set my first free alert
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
