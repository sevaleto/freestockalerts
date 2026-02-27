import { NextResponse } from "next/server";
import { mockTemplates } from "@/lib/mock/templates";

export async function GET() {
  // TODO: Replace with Prisma query.
  return NextResponse.json({ data: mockTemplates });
}
