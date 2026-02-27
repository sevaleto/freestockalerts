import Link from "next/link";
import { notFound } from "next/navigation";
import { mockTemplates } from "@/lib/mock/templates";
import { Logo } from "@/components/shared/Logo";
import { Badge } from "@/components/ui/badge";

interface TemplateDetailPageProps {
  params: { slug: string };
}

export default function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const template = mockTemplates.find((item) => item.slug === params.slug);

  if (!template) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo />
        <Link href="/templates" className="text-sm text-text-secondary">
          ← Back to templates
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="rounded-3xl border border-border bg-surface p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{template.iconEmoji}</span>
                <h1 className="text-3xl font-semibold text-text-primary">{template.name}</h1>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-text-secondary">
                {template.longDescription ?? template.description}
              </p>
            </div>
            <Badge className="w-fit bg-primary/10 text-primary">{template.category}</Badge>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Template alerts</h2>
          <div className="overflow-hidden rounded-3xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Alert Type</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {template.items.map((item) => (
                  <tr key={`${item.ticker}-${item.alertType}`} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold text-text-primary">{item.ticker}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.alertType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{item.triggerDirection}</td>
                    <td className="px-4 py-3 text-text-secondary">{item.triggerValue}</td>
                    <td className="px-4 py-3 text-text-secondary">{item.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/login" className="inline-flex text-sm font-semibold text-primary">
            Activate this template →
          </Link>
        </div>
      </main>
    </div>
  );
}
