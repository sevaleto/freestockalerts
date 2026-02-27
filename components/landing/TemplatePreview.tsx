import Link from "next/link";
import { mockTemplates } from "@/lib/mock/templates";
import { ArrowUpRight } from "lucide-react";

export function TemplatePreview() {
  const featured = mockTemplates.filter((template) => template.isFeatured).slice(0, 4);

  return (
    <section id="templates" className="bg-surface py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-text-muted">
              Template previews
            </p>
            <h2 className="text-3xl font-semibold text-text-primary md:text-4xl">
              Activate proven alert playbooks in seconds
            </h2>
            <p className="text-base text-text-secondary">
              Start with strategies built by traders, then customize every alert to fit your style.
            </p>
          </div>
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Browse all templates <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {featured.map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.slug}`}
              className="group rounded-3xl border border-border bg-white p-6 shadow-soft transition hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{template.iconEmoji}</span>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Preview →
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-text-primary group-hover:text-primary">
                {template.name}
              </h3>
              <p className="mt-2 text-sm text-text-secondary">{template.description}</p>
              <div className="mt-6 flex items-center justify-between text-xs text-text-muted">
                <span>{template.items.length} alerts</span>
                <span className="uppercase tracking-widest">{template.category}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
