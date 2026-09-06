import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { AdEditor } from "@/components/admin/AdEditor";
import { BEEHIIV_PUBLICATIONS } from "@/lib/beehiiv/config";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const ad = await prisma.emailAd.findUnique({ where: { id } });
  if (!ad) notFound();
  return (
    <AdEditor
      mode="edit"
      id={ad.id}
      stats={{ impressions: ad.impressions, clicks: ad.clicks, lastShownAt: ad.lastShownAt?.toISOString() ?? null }}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://www.freestockalerts.ai"}
      newsletters={BEEHIIV_PUBLICATIONS.map((p) => ({ key: p.key, name: p.name }))}
      initial={{
        name: ad.name,
        leadIn: ad.leadIn,
        headline: ad.headline,
        headlineColor: ad.headlineColor,
        body: ad.body,
        ctaText: ad.ctaText,
        ctaUrl: ad.ctaUrl,
        imageUrl: ad.imageUrl,
        status: ad.status === "paused" ? "paused" : "active",
        weight: ad.weight,
        startAt: ad.startAt?.toISOString() ?? null,
        endAt: ad.endAt?.toISOString() ?? null,
        valueCents: ad.valueCents,
      }}
    />
  );
}
