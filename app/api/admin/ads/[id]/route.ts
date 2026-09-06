import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getAdminUser } from "@/lib/auth/admin";
import { AD_STATUSES, validateAdInput, type AdStatus } from "@/lib/ads/template";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT replaces every editable field (the edit form). PATCH with {status} only
 * flips pause/resume (the list page). DELETE removes the ad and its click log.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = validateAdInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const ad = await prisma.emailAd.update({ where: { id }, data: parsed.input });
    return NextResponse.json({ ad });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as { status?: unknown };
  const status = AD_STATUSES.find((s) => s === body.status) as AdStatus | undefined;
  if (!status) return NextResponse.json({ error: "status must be active or paused" }, { status: 400 });
  try {
    const ad = await prisma.emailAd.update({ where: { id }, data: { status } });
    return NextResponse.json({ ad });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.emailAd.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
