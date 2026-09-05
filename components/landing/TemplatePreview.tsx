import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { mockTemplates } from "@/lib/mock/templates";
import { TemplateCardLink } from "@/components/landing/TemplateCardLink";

export function TemplatePreview() {
  // Three concrete strategies on the homepage; the rest live on /templates.
  const FEATURED = ["momentum-breakout-alerts", "under-the-radar-breakouts", "sector-rotation-radar"];
  const templates = FEATURED.map((slug) => mockTemplates.find((t) => t.slug === slug)!).filter(Boolean);
  return (
    <section id="templates" className="border-t border-lp-border/70 bg-lp-bg py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Alert templates</p>
            <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">Pick a strategy. Activate a full watchlist.</h2>
            <p className="text-base leading-relaxed text-lp-navy/75">
              Choose a ready-made template and add an entire set of alerts to your account in one click. Six more strategies wait on your dashboard.
            </p>
          </div>
          <Link href="/templates" className="inline-flex items-center gap-2 text-sm font-semibold text-lp-teal hover:text-lp-teal-dark">
            Browse all templates <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCardLink
              key={template.id}
              slug={template.slug}
              name={template.name}
              className="group rounded-[20px] border border-lp-border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-lp-teal/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>{template.iconEmoji}</span>
                <span className="rounded-full bg-lp-mint px-3 py-1 text-xs font-semibold text-lp-teal">
                  Activate free →
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-lp-navy group-hover:text-lp-teal">{template.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-lp-navy/75">{template.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from(new Set(template.items.map((i) => i.ticker))).slice(0, 4).map((ticker) => (
                  <span key={ticker} className="rounded-md bg-lp-bg px-2 py-1 font-mono text-xs font-medium text-lp-navy">
                    {ticker}
                  </span>
                ))}
                {new Set(template.items.map((i) => i.ticker)).size > 4 && (
                  <span className="rounded-md bg-lp-bg px-2 py-1 text-xs text-lp-muted">+{new Set(template.items.map((i) => i.ticker)).size - 4} more</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-lp-border/70 pt-3 text-xs text-lp-muted">
                <span className="font-semibold">{template.items.length} alerts</span>
                <span className="uppercase tracking-widest">{template.category.replace("_", " ")}</span>
              </div>
            </TemplateCardLink>
          ))}
        </div>

        <div className="mt-12 rounded-[20px] border border-lp-teal/20 bg-lp-mint p-8 md:p-10">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <h3 className="font-serif text-2xl text-lp-navy md:text-3xl">Activate an entire watchlist in one click</h3>
              <p className="mt-2 text-base text-lp-navy/75">
                Sign up, pick a template, and every alert in it goes live at once. Edit or pause any of them from your dashboard.
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
