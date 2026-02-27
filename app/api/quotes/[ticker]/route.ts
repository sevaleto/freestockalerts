import { NextResponse } from "next/server";
import { getQuote } from "@/lib/api/quotes";

interface RouteProps {
  params: { ticker: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  const quote = await getQuote(params.ticker.toUpperCase());
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  return NextResponse.json({ data: quote });
}
