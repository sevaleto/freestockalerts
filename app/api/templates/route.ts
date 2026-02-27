import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const templates = await prisma.alertTemplate.findMany({
    where: { isActive: true },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ data: templates });
}
