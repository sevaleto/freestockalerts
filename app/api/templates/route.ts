import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await prisma.alertTemplate.findMany({
      where: { isActive: true },
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
