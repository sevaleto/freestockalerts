import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

interface SummaryRequest {
  ticker: string;
  alertType: string;
  triggerValue: number;
  currentPrice: number;
  dayChange?: number;
  dayChangePercent?: number;
  volume?: number;
}

export async function POST(request: Request) {
  const body: SummaryRequest = await request.json().catch(() => ({} as SummaryRequest));

  if (!body.ticker || !body.currentPrice) {
    return NextResponse.json({ summary: "Alert triggered." }, { status: 200 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are a concise stock alert analyst. Write a 1-2 sentence summary explaining why this price movement matters. Be specific, actionable, and avoid fluff. No disclaimers.",
        },
        {
          role: "user",
          content: `Stock: ${body.ticker}\nAlert type: ${body.alertType}\nTrigger price: $${body.triggerValue}\nCurrent price: $${body.currentPrice}${body.dayChange !== undefined ? `\nDay change: ${body.dayChange > 0 ? "+" : ""}$${body.dayChange} (${body.dayChangePercent ?? 0}%)` : ""}${body.volume ? `\nVolume: ${body.volume.toLocaleString()}` : ""}\n\nWrite a brief, insightful summary of this alert trigger.`,
        },
      ],
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ??
      "Alert triggered. Price crossed your target level.";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("AI summary error:", error);
    return NextResponse.json({
      summary: `${body.ticker} crossed $${body.triggerValue}, now trading at $${body.currentPrice}. Monitor for follow-through.`,
    });
  }
}
