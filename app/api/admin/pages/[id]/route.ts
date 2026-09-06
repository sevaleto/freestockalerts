import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getAdminUser } from "@/lib/auth/admin";
import { validateLandingPageInput } from "@/lib/lp/validate";
import { ALL_PAGES_TAG, pageTag } from "@/lib/lp/store";
import { HOME_SLUG, PAGE_STATUSES, type PageStatus } from "@/lib/lp/view";
import { isVariantKey } from "@/lib/cookies/bucket";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

function invalidate(slug: string) {
  revalidateTag(pageTag(slug));
  revalidateTag(ALL_PAGES_TAG);
}

/**
 * PUT replaces every editable field and the variant list (the edit form):
 * variants are upserted by key and any key missing from the payload is
 * deleted. PATCH with {status} publishes/pauses/archives; PATCH with
 * {winner: "B"} keeps that variant and pauses the rest. DELETE removes the
 * page (never the homepage row); lead rows keep their "<slug>:<key>" tag.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return forbidden();
  const { id } = await params;
  const existing = await prisma.landingPage.findUnique({ where: { id }, select: { slug: true, kind: true } });
  if (!existing) return notFound();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = validateLandingPageInput(body, { existing });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { variants, sampleAlert, slug: _slug, kind: _kind, ...fields } = parsed.input;

  const page = await prisma.$transaction(async (tx) => {
    await tx.landingPage.update({
      where: { id },
      data: { ...fields, sampleAlert: sampleAlert ? (sampleAlert as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
    });
    await tx.headlineVariant.deleteMany({ where: { pageId: id, key: { notIn: variants.map((v) => v.key) } } });
    for (const v of variants) {
      await tx.headlineVariant.upsert({
        where: { pageId_key: { pageId: id, key: v.key } },
        create: { pageId: id, ...v },
        update: { headline: v.headline, subheadline: v.subheadline, weight: v.weight, isActive: v.isActive },
      });
    }
    return tx.landingPage.findUniqueOrThrow({ where: { id }, include: { variants: { orderBy: { key: "asc" } } } });
  });
  invalidate(page.slug);
  return NextResponse.json({ page });
}

export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return forbidden();
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as { status?: unknown; winner?: unknown };
  const status = PAGE_STATUSES.find((s) => s === String(body.status ?? "").toUpperCase()) as PageStatus | undefined;
  const winner = typeof body.winner === "string" && isVariantKey(body.winner.toUpperCase()) ? body.winner.toUpperCase() : null;
  if (!status && !winner) return NextResponse.json({ error: "Send {status} (DRAFT, LIVE, ARCHIVED) or {winner: 'B'}" }, { status: 400 });
  try {
    const page = await prisma.$transaction(async (tx) => {
      if (status) await tx.landingPage.update({ where: { id }, data: { status } });
      if (winner) {
        const hit = await tx.headlineVariant.updateMany({ where: { pageId: id, key: winner }, data: { isActive: true } });
        if (hit.count === 0) throw new Prisma.PrismaClientKnownRequestError("Variant not found", { code: "P2025", clientVersion: Prisma.prismaVersion.client });
        await tx.headlineVariant.updateMany({ where: { pageId: id, key: winner, weight: 0 }, data: { weight: 1 } });
        await tx.headlineVariant.updateMany({ where: { pageId: id, key: { not: winner } }, data: { isActive: false } });
      }
      return tx.landingPage.findUniqueOrThrow({ where: { id }, include: { variants: { orderBy: { key: "asc" } } } });
    });
    invalidate(page.slug);
    return NextResponse.json({ page });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return notFound();
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return forbidden();
  const { id } = await params;
  const existing = await prisma.landingPage.findUnique({ where: { id }, select: { slug: true } });
  if (!existing) return notFound();
  if (existing.slug === HOME_SLUG) return NextResponse.json({ error: "The homepage row cannot be deleted; archive its variants instead." }, { status: 400 });
  await prisma.landingPage.delete({ where: { id } });
  invalidate(existing.slug);
  return NextResponse.json({ ok: true });
}
