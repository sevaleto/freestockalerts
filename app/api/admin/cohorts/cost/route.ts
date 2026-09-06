import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/** POST { cohortKey, month: "YYYY-MM", costCents | null } — upsert or clear one cohort-month cost. Admins only. */
export async function POST(request: Request) {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = ((await request.json().catch(() => null)) ?? {}) as { cohortKey?: unknown; month?: unknown; costCents?: unknown; note?: unknown };
  const cohortKey = typeof body.cohortKey === "string" ? body.cohortKey.slice(0, 700) : "";
  const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : "";
  if (!cohortKey || !month) return NextResponse.json({ error: "cohortKey and month (YYYY-MM) are required" }, { status: 400 });
  if (body.costCents === null) {
    await prisma.cohortCost.deleteMany({ where: { cohortKey, month } });
    return NextResponse.json({ ok: true, cleared: true });
  }
  const costCents = typeof body.costCents === "number" && Number.isInteger(body.costCents) && body.costCents >= 0 && body.costCents <= 1_000_000_000 ? body.costCents : null;
  if (costCents === null) return NextResponse.json({ error: "costCents must be a non-negative integer" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.slice(0, 300) : undefined;
  const row = await prisma.cohortCost.upsert({ where: { cohortKey_month: { cohortKey, month } }, create: { cohortKey, month, costCents, note }, update: { costCents, ...(note !== undefined ? { note } : {}) } });
  return NextResponse.json({ ok: true, row });
}
