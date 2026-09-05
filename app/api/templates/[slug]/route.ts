import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { resolveTemplateSlug } from "@/lib/templates/redirects";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export async function GET(_: Request, props: RouteProps) {
  const params = await props.params;
  const slug = resolveTemplateSlug(params.slug);
  const template = await prisma.alertTemplate.findUnique({
    where: { slug },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ data: template, ...(slug !== params.slug ? { redirectedFrom: params.slug } : {}) });
}
