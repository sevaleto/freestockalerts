import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

interface RouteProps {
  params: { slug: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  const template = await prisma.alertTemplate.findUnique({
    where: { slug: params.slug },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ data: template });
}
