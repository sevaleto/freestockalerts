import { NextResponse } from "next/server";
import { searchTickers } from "@/lib/api/quotes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? searchParams.get("q") ?? "";

  try {
    const results = await searchTickers(query);
    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("GET /api/quotes/search error:", error);
    return NextResponse.json(
      { error: "Failed to search tickers" },
      { status: 500 }
    );
  }
}
