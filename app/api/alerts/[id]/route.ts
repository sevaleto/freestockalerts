import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: { id: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
      include: { history: { orderBy: { triggeredAt: "desc" } } },
    });
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    if (alert.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ data: alert });
  } catch (error) {
    console.error("GET /api/alerts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alert" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.alert.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (payload.ticker) data.ticker = String(payload.ticker).toUpperCase();
    if (payload.companyName !== undefined)
      data.companyName = payload.companyName;
    if (payload.alertType) data.alertType = payload.alertType;
    if (payload.triggerValue !== undefined)
      data.triggerValue = Number(payload.triggerValue);
    if (payload.triggerDirection) data.triggerDirection = payload.triggerDirection;
    if (payload.currentPrice !== undefined)
      data.currentPrice = Number(payload.currentPrice);
    if (payload.isActive !== undefined)
      data.isActive = Boolean(payload.isActive);
    if (payload.isTriggered !== undefined)
      data.isTriggered = Boolean(payload.isTriggered);
    if (payload.triggeredAt !== undefined)
      data.triggeredAt = payload.triggeredAt
        ? new Date(payload.triggeredAt)
        : null;
    if (payload.cooldownMinutes !== undefined)
      data.cooldownMinutes = Number(payload.cooldownMinutes);
    if (payload.note !== undefined) data.note = payload.note;
    if (payload.templateId !== undefined) data.templateId = payload.templateId;

    const updated = await prisma.alert.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/alerts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.alert.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.alert.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Alert deleted", id: params.id });
  } catch (error) {
    console.error("DELETE /api/alerts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete alert" },
      { status: 500 }
    );
  }
}
