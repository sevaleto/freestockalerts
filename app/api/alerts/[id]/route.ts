import { NextResponse } from "next/server";
import { mockAlerts } from "@/lib/mock/alerts";

interface RouteProps {
  params: { id: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  const alert = mockAlerts.find((item) => item.id === params.id);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
  return NextResponse.json({ data: alert });
}

export async function PUT(request: Request, { params }: RouteProps) {
  // TODO: Replace with update logic.
  const payload = await request.json().catch(() => ({}));
  return NextResponse.json({ message: "Alert updated (mock)", id: params.id, data: payload });
}

export async function DELETE(_: Request, { params }: RouteProps) {
  // TODO: Replace with delete logic.
  return NextResponse.json({ message: "Alert deleted (mock)", id: params.id });
}
