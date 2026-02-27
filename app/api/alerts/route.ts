import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get("includeHistory") === "true";

  try {
    if (includeHistory) {
      const alerts = await prisma.alert.findMany({
        where: { userId: user.id },
        include: { history: { orderBy: { triggeredAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      });
      const history = alerts.flatMap((alert) =>
        alert.history.map((item) => ({
          id: item.id,
          alertId: alert.id,
          ticker: alert.ticker,
          alertType: alert.alertType,
          priceAtTrigger: item.priceAtTrigger,
          triggeredAt: item.triggeredAt.toISOString(),
          aiSummary: item.aiSummary ?? "",
        }))
      );
      return NextResponse.json({ data: { alerts, history } });
    }

    const alerts = await prisma.alert.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: alerts });
  } catch (error) {
    console.error("GET /api/alerts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const {
    ticker,
    companyName,
    alertType,
    triggerValue,
    triggerDirection,
    currentPrice,
    cooldownMinutes,
    note,
    templateId,
    emailEnabled,
  } = payload ?? {};

  if (!ticker || !alertType || triggerValue === undefined || !triggerDirection) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.alert.create({
      data: {
        userId: user.id,
        ticker: String(ticker).toUpperCase(),
        companyName: companyName ? String(companyName) : undefined,
        alertType,
        triggerValue: Number(triggerValue),
        triggerDirection,
        currentPrice:
          currentPrice !== undefined ? Number(currentPrice) : undefined,
        cooldownMinutes:
          cooldownMinutes !== undefined ? Number(cooldownMinutes) : undefined,
        note: note ? String(note) : undefined,
        templateId: templateId ? String(templateId) : undefined,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/alerts error:", error);
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}
