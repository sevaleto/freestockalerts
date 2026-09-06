import { NextResponse } from "next/server";
import { gatherAlertFacts, writeAlertContext } from "@/lib/ai/alertContext";
import { describeTrigger } from "@/lib/alerts/describe";

export const dynamic = "force-dynamic";

interface SummaryRequest {
  ticker: string;
  alertType: string;
  triggerValue: number;
  currentPrice: number;
  dayChange?: number;
  dayChangePercent?: number;
  volume?: number;
}

/** On-demand context for one alert, using the same writer the cron uses for emails. */
export async function POST(request: Request) {
  const body: SummaryRequest = await request.json().catch(() => ({}) as SummaryRequest);
  if (!body.ticker || !body.currentPrice) {
    return NextResponse.json({ summary: "Alert triggered." }, { status: 200 });
  }
  try {
    const facts = await gatherAlertFacts({
      ticker: body.ticker,
      triggerText: describeTrigger({ ticker: body.ticker, alertType: body.alertType, triggerValue: body.triggerValue }),
      quote: { price: body.currentPrice, changePercent: body.dayChangePercent, dayChange: body.dayChange, volume: body.volume },
    });
    const written = await writeAlertContext(facts);
    return NextResponse.json({ summary: written.text, paragraphs: written.paragraphs, source: written.source });
  } catch (error) {
    console.error("AI summary error:", error);
    return NextResponse.json({ summary: `${body.ticker} alert triggered at $${body.currentPrice}.` });
  }
}
