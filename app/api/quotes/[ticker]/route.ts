import { NextResponse } from "next/server";
import { getQuote } from "@/lib/api/quotes";

interface RouteProps {
  params: { ticker: string };
}

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const quote = await getQuote(params.ticker.toUpperCase());
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    return NextResponse.json({ data: quote });
  } catch (error) {
    console.error("GET /api/quotes/[ticker] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
