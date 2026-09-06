import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getAdminUser } from "@/lib/auth/admin";
import { validateLandingPageInput } from "@/lib/lp/validate";
import { ALL_PAGES_TAG, pageTag } from "@/lib/lp/store";

export const dynamic = "force-dynamic";

/** GET /api/admin/pages: every landing page with its variants. POST: create one. Admins only. */
export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const pages = await prisma.landingPage.findMany({ include: { variants: { orderBy: { key: "asc" } } }, orderBy: [{ kind: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ pages });
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
  const parsed = validateLandingPageInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { variants, sampleAlert, ...fields } = parsed.input;
  try {
    const page = await prisma.landingPage.create({
      data: {
        ...fields,
        sampleAlert: sampleAlert ? (sampleAlert as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        createdBy: admin.email ?? null,
        variants: { create: variants },
      },
      include: { variants: { orderBy: { key: "asc" } } },
    });
    revalidateTag(pageTag(page.slug));
    revalidateTag(ALL_PAGES_TAG);
    return NextResponse.json({ page }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ error: "A page with that slug already exists." }, { status: 409 });
    throw err;
  }
}
