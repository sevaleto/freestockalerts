import { NextResponse } from "next/server";
import { mockTemplates } from "@/lib/mock/templates";

interface RouteProps {
  params: { slug: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  const template = mockTemplates.find((item) => item.slug === params.slug);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ data: template });
}
