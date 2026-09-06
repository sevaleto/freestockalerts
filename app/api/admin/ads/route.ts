import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAdminUser } from "@/lib/auth/admin";
import { validateAdInput } from "@/lib/ads/template";

export const dynamic = "force-dynamic";

/** GET /api/admin/ads: every ad with its counters. POST: create one. Admins only. */
export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ads = await prisma.emailAd.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ads });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = validateAdInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const ad = await prisma.emailAd.create({ data: { ...parsed.input, createdBy: admin.email ?? null } });
  return NextResponse.json({ ad }, { status: 201 });
}
