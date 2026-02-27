import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;
  const includeHistory = searchParams.get("includeHistory") === "true";

  if (includeHistory) {
    const alerts = await prisma.alert.findMany({
      where: userId ? { userId } : undefined,
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
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: alerts });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const {
    userId,
    ticker,
    companyName,
    alertType,
    triggerValue,
    triggerDirection,
    currentPrice,
    cooldownMinutes,
    note,
    templateId,
  } = payload ?? {};

  if (!userId || !ticker || !alertType || triggerValue === undefined || !triggerDirection) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const created = await prisma.alert.create({
    data: {
      userId,
      ticker: String(ticker).toUpperCase(),
      companyName: companyName ? String(companyName) : undefined,
      alertType,
      triggerValue: Number(triggerValue),
      triggerDirection,
      currentPrice: currentPrice !== undefined ? Number(currentPrice) : undefined,
      cooldownMinutes: cooldownMinutes !== undefined ? Number(cooldownMinutes) : undefined,
      note: note ? String(note) : undefined,
      templateId: templateId ? String(templateId) : undefined,
    },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
