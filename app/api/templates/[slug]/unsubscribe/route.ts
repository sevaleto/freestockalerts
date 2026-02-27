import { NextResponse } from "next/server";

interface RouteProps {
  params: { slug: string };
}

export async function POST(_: Request, { params }: RouteProps) {
  // TODO: Replace with template unsubscribe logic.
  return NextResponse.json({ message: "Template unsubscribed (mock)", slug: params.slug });
}
