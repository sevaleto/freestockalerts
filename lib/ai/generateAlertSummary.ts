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
  // TODO: Wire up Anthropic API once credentials are available.
  const direction = context.dayChangePercent >= 0 ? "up" : "down";
  const changePct = Math.abs(context.dayChangePercent).toFixed(2);
  const volumeRatio =
    context.avgVolume > 0 ? (context.volume / context.avgVolume).toFixed(1) : "n/a";

  const rangeSpan = context.fiftyTwoWeekHigh - context.fiftyTwoWeekLow;
  const rangePosition =
    rangeSpan > 0 ? (context.currentPrice - context.fiftyTwoWeekLow) / rangeSpan : 0.5;
  const rangeTag =
    rangePosition >= 0.85
      ? "near its 52-week high"
      : rangePosition <= 0.15
        ? "near its 52-week low"
        : "in the middle of its 52-week range";

  const alertLead = (() => {
    switch (context.alertType) {
      case "PRICE_ABOVE":
        return `${context.ticker} pushed above $${context.triggerValue.toFixed(2)}.`;
      case "PRICE_BELOW":
        return `${context.ticker} slipped below $${context.triggerValue.toFixed(2)}.`;
      case "PERCENT_CHANGE_DAY":
        return `${context.ticker} moved ${changePct}% ${direction} on the day.`;
      case "VOLUME_SPIKE":
        return `${context.ticker} volume is running about ${volumeRatio}x average.`;
      case "RSI_OVERBOUGHT":
        return `${context.ticker} is flashing overbought momentum at $${context.currentPrice.toFixed(
          2
        )}.`;
      case "RSI_OVERSOLD":
        return `${context.ticker} is showing oversold momentum at $${context.currentPrice.toFixed(
          2
        )}.`;
      case "SMA_CROSS_ABOVE":
        return `${context.ticker} crossed above its moving average near $${context.currentPrice.toFixed(
          2
        )}.`;
      case "SMA_CROSS_BELOW":
        return `${context.ticker} crossed below its moving average near $${context.currentPrice.toFixed(
          2
        )}.`;
      case "FIFTY_TWO_WEEK_HIGH":
        return `${context.ticker} tagged a new 52-week high around $${context.currentPrice.toFixed(
          2
        )}.`;
      case "FIFTY_TWO_WEEK_LOW":
        return `${context.ticker} tagged a new 52-week low around $${context.currentPrice.toFixed(
          2
        )}.`;
      case "EARNINGS_REMINDER":
        return `${context.ticker} earnings are approaching; alert window triggered.`;
      case "PRICE_RECOVERY":
        return `${context.ticker} recovered back toward $${context.currentPrice.toFixed(2)}.`;
      default:
        return `${context.ticker} alert triggered at $${context.currentPrice.toFixed(2)}.`;
    }
  })();

  const sentenceTwo = `Price is ${direction} ${changePct}% today and ${rangeTag}. Volume is ${
    volumeRatio === "n/a" ? "not available" : `${volumeRatio}x its average`
  }.`;
  const sentenceThree = context.nextEarningsDate
    ? `Next earnings date: ${context.nextEarningsDate}.`
    : "";

  return [alertLead, sentenceTwo, sentenceThree].filter(Boolean).join(" ");
}
