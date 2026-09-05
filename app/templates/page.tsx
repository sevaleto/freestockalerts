import Link from "next/link";
import { mockTemplates } from "@/lib/mock/templates";
import { Logo } from "@/components/shared/Logo";

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo size="lg" />
        <Link href="/login" className="inline-flex h-10 items-center rounded-xl bg-lp-teal px-4 text-sm font-semibold text-white hover:bg-lp-teal-dark">
          Get started
        </Link>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="space-y-3">
          <h1 className="font-serif text-4xl text-lp-navy md:text-5xl">
            Alert Templates
          </h1>
          <p className="text-sm text-text-secondary">
            Preview curated strategies you can activate with one click after signup.
          </p>
        </div>

        {mockTemplates.length === 0 ? (
          <div className="mt-10 rounded-[20px] border border-border bg-white p-6 text-sm text-text-secondary">
            Templates are coming soon.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {mockTemplates.map((template) => (
              <Link
                key={template.id}
                href={`/templates/${template.slug}`}
                className="group rounded-[20px] border border-border bg-white p-6 shadow-sm transition hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{template.iconEmoji}</span>
                  <span className="text-xs text-text-muted">{template.category}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-text-primary group-hover:text-lp-teal">
                  {template.name}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">{template.description}</p>
                <div className="mt-6 flex items-center justify-between text-xs text-text-muted">
                  <span>{template.items.length} alerts</span>
                  <span className="font-semibold text-lp-teal">Preview →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
