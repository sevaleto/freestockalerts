export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { Logo } from "@/components/shared/Logo";
import { Badge } from "@/components/ui/badge";
import { ActivateButton } from "@/components/templates/ActivateButton";
import { TrackViewContent } from "@/components/shared/TrackViewContent";
import { AlertProofList } from "@/components/lp/AlertProofList";

interface TemplateDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TemplateDetailPage(props: TemplateDetailPageProps) {
  const params = await props.params;
  const template = await prisma.alertTemplate.findUnique({
    where: { slug: params.slug },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-lp-bg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo size="lg" />
        <Link href="/templates" className="text-sm text-text-secondary">
          ← Back to templates
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20">
        <TrackViewContent name={template.name} slug={template.slug} />
        <div className="rounded-[20px] border border-border bg-surface p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{template.iconEmoji}</span>
                <h1 className="font-serif text-4xl text-lp-navy">{template.name}</h1>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-text-secondary">
                {template.longDescription ?? template.description}
              </p>
            </div>
            <Badge className="w-fit bg-lp-mint text-lp-teal hover:bg-lp-mint">{template.category.replace(/_/g, " ")}</Badge>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <AlertProofList items={template.items} title={`Template alerts (${template.items.length})`} columns={2} />
          <ActivateButton slug={template.slug} templateName={template.name} />
        </div>
      </main>
    </div>
  );
}
