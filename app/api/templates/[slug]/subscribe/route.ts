import { NextResponse } from "next/server";

interface RouteProps {
  params: { slug: string };
}

export async function POST(_: Request, { params }: RouteProps) {
  // TODO: Replace with template subscription logic.
  return NextResponse.json({ message: "Template subscribed (mock)", slug: params.slug });
}
