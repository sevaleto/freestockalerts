import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { mockTemplates } from "@/lib/mock/templates";

export function TemplatePreview() {
  const templates = [...mockTemplates].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section id="templates" className="border-t border-lp-border/70 bg-lp-bg py-20">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lp-teal">Alert templates</p>
            <h2 className="font-serif text-3xl text-lp-navy md:text-4xl">Pre-built strategies. One click to activate.</h2>
            <p className="text-base leading-relaxed text-lp-navy/75">
              Each template sets up 10 alerts around a specific strategy. Customize any alert after activation.
            </p>
          </div>
          <Link href="/templates" className="inline-flex items-center gap-2 text-sm font-semibold text-lp-teal hover:text-lp-teal-dark">
            Browse all templates <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.slug}`}
              className="group rounded-[20px] border border-lp-border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-lp-teal/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>{template.iconEmoji}</span>
                <span className="rounded-full bg-lp-mint px-3 py-1 text-xs font-semibold text-lp-teal opacity-0 transition group-hover:opacity-100">
                  Preview →
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-lp-navy group-hover:text-lp-teal">{template.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-lp-navy/75">{template.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {template.items.slice(0, 4).map((item, i) => (
                  <span key={`${item.ticker}-${i}`} className="rounded-md bg-lp-bg px-2 py-1 font-mono text-xs font-medium text-lp-navy">
                    {item.ticker}
                  </span>
                ))}
                {template.items.length > 4 && (
                  <span className="rounded-md bg-lp-bg px-2 py-1 text-xs text-lp-muted">+{template.items.length - 4} more</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-lp-border/70 pt-3 text-xs text-lp-muted">
                <span className="font-semibold">{template.items.length} alerts</span>
                <span className="uppercase tracking-widest">{template.category.replace("_", " ")}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-[20px] border border-lp-teal/20 bg-lp-mint p-8 md:p-10">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <h3 className="font-serif text-2xl text-lp-navy md:text-3xl">Activate 10 alerts in under 2 minutes</h3>
              <p className="mt-2 text-base text-lp-navy/75">
                Sign up, pick a template, and you&apos;re covered. Every alert includes AI context so you always know why it fired.
              </p>
            </div>
            <div className="flex md:justify-end">
              <Link
                href="#signup"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-lp-teal px-8 text-base font-semibold text-white shadow-sm transition-colors hover:bg-lp-teal-dark"
              >
                Get my first alert
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
