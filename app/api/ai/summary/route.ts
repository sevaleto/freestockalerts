import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Replace with Anthropic summary generation.
  return NextResponse.json({
    summary:
      "Alert triggered. Price moved sharply on higher volume than average. Traders often watch for follow-through or mean reversion over the next few sessions.",
  });
}
