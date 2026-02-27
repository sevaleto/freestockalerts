import Anthropic from "@anthropic-ai/sdk";

interface AlertContext {
  ticker: string;
  companyName: string;
  alertType: string;
  triggerValue: number;
  currentPrice: number;
  priceAtTrigger: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  nextEarningsDate?: string;
  dayChangePercent: number;
}

export async function generateAlertSummary(context: AlertContext): Promise<string> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 200,
    system: `You are a concise stock market analyst writing alert notifications for retail traders. 
Write exactly 2-3 sentences explaining why this alert matters. Be factual, specific, and actionable. 
Never give buy/sell recommendations. Never use phrases like "This could mean" or hedge excessively. 
Just state what happened, add relevant context (volume, proximity to 52-week range, upcoming events), 
and note what experienced traders typically watch for in this situation. 
Keep it under 50 words.`,
    messages: [
      {
        role: "user",
        content: `Alert triggered for ${context.ticker} (${context.companyName}):
- Alert type: ${context.alertType}
- Trigger value: $${context.triggerValue}
- Price at trigger: $${context.priceAtTrigger}
- Today's range: $${context.dayLow} - $${context.dayHigh} (opened at $${context.dayOpen})
- Day change: ${context.dayChangePercent > 0 ? "+" : ""}${context.dayChangePercent.toFixed(2)}%
- Volume: ${context.volume.toLocaleString()} (avg: ${context.avgVolume.toLocaleString()})
- 52-week range: $${context.fiftyTwoWeekLow} - $${context.fiftyTwoWeekHigh}
${context.nextEarningsDate ? `- Next earnings: ${context.nextEarningsDate}` : ""}

Write 2-3 sentences of context for this alert.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock?.text ?? "Alert triggered. Check current market conditions for context.";
}
