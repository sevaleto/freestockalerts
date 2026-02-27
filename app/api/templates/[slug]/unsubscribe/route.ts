import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: { slug: string };
}

export async function POST(request: Request, { params }: RouteProps) {
  const payload = await request.json().catch(() => ({}));
  const userId = payload?.userId as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const template = await prisma.alertTemplate.findUnique({
    where: { slug: params.slug },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    const subscription = await prisma.templateSubscription.update({
      where: { userId_templateId: { userId, templateId: template.id } },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Template unsubscribed", data: subscription });
  } catch (error) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }
}
