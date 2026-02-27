import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

interface RouteProps {
  params: { id: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  const alert = await prisma.alert.findUnique({
    where: { id: params.id },
    include: { history: { orderBy: { triggeredAt: "desc" } } },
  });
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
  return NextResponse.json({ data: alert });
}

export async function PUT(request: Request, { params }: RouteProps) {
  const payload = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (payload.ticker) data.ticker = String(payload.ticker).toUpperCase();
  if (payload.companyName !== undefined) data.companyName = payload.companyName;
  if (payload.alertType) data.alertType = payload.alertType;
  if (payload.triggerValue !== undefined) data.triggerValue = Number(payload.triggerValue);
  if (payload.triggerDirection) data.triggerDirection = payload.triggerDirection;
  if (payload.currentPrice !== undefined) data.currentPrice = Number(payload.currentPrice);
  if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);
  if (payload.isTriggered !== undefined) data.isTriggered = Boolean(payload.isTriggered);
  if (payload.triggeredAt !== undefined)
    data.triggeredAt = payload.triggeredAt ? new Date(payload.triggeredAt) : null;
  if (payload.cooldownMinutes !== undefined) data.cooldownMinutes = Number(payload.cooldownMinutes);
  if (payload.note !== undefined) data.note = payload.note;
  if (payload.templateId !== undefined) data.templateId = payload.templateId;

  try {
    const updated = await prisma.alert.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    await prisma.alert.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Alert deleted", id: params.id });
  } catch (error) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }
}
