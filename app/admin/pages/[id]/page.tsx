import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { requireAdminPage } from "@/lib/auth/admin";
import { LandingPageEditor } from "@/components/admin/LandingPageEditor";
import { strategyOptions } from "@/components/admin/strategyOptions";
import { leadCountsByTag, variantStats } from "@/lib/lp/report";
import { toRecord } from "@/lib/lp/store";

export const dynamic = "force-dynamic";

export default async function EditLandingPagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const row = await prisma.landingPage.findUnique({ where: { id }, include: { variants: true } });
  if (!row) notFound();
  const record = toRecord(row);
  const counts = await leadCountsByTag(prisma);
  return (
    <LandingPageEditor
      mode="edit"
      id={row.id}
      strategies={strategyOptions()}
      initial={{
        slug: record.slug,
        kind: record.kind,
        status: record.status,
        templateSlug: record.templateSlug,
        eyebrow: record.eyebrow,
        logicLine: record.logicLine,
        bullets: record.bullets,
        ctaLabel: record.ctaLabel,
        googleLabel: record.googleLabel,
        proofTitle: record.proofTitle,
        disclosure: record.disclosure,
        afterSignupNote: record.afterSignupNote,
        sampleAlert: record.sampleAlert,
        ogTitle: record.ogTitle,
        ogDescription: record.ogDescription,
        variants: record.variants.map(({ key, headline, subheadline, weight, isActive }) => ({ key, headline, subheadline, weight, isActive })),
      }}
      stats={variantStats(record.slug, record.variants, counts)}
      updatedAt={row.updatedAt.toISOString()}
    />
  );
}
