import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAuthUser } from "@/lib/supabase/server";
import { resolveTemplateSlug } from "@/lib/templates/redirects";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export async function POST(_: Request, props: RouteProps) {
  const params = await props.params;
  // The session decides who is subscribing; a body userId is ignored.
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  // Old slugs keep working: resolve to the strategy that replaced them.
  const template = await prisma.alertTemplate.findUnique({
    where: { slug: resolveTemplateSlug(params.slug) },
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
