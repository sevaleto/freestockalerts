import { NextResponse } from "next/server";
import { searchTickers } from "@/lib/api/quotes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const results = await searchTickers(query);
  return NextResponse.json({ data: results });
}
