import { NextResponse } from "next/server";
import { mockAlerts } from "@/lib/mock/alerts";

export async function GET() {
  // TODO: Replace with authenticated Prisma query.
  return NextResponse.json({ data: mockAlerts });
}

export async function POST(request: Request) {
  // TODO: Replace with create alert logic.
  const payload = await request.json().catch(() => ({}));
  return NextResponse.json({ message: "Alert created (mock)", data: payload }, { status: 201 });
}
