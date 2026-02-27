import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

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

  const subscription = await prisma.templateSubscription.upsert({
    where: { userId_templateId: { userId, templateId: template.id } },
    create: { userId, templateId: template.id, isActive: true },
    update: { isActive: true },
  });

  return NextResponse.json({ message: "Template subscribed", data: subscription });
}
