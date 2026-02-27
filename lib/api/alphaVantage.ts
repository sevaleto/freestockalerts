const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace("%", ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const fetchAlphaVantageQuote = async (ticker: string) => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  const normalized = ticker.trim().toUpperCase();
  const url = `${ALPHA_VANTAGE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
    normalized
  )}&apikey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    "Global Quote"?: Record<string, string>;
  };

  const quote = data?.["Global Quote"];
  if (!quote || !quote["05. price"]) return null;

  const price = toNumber(quote["05. price"]) ?? 0;
  const dayOpen = toNumber(quote["02. open"]) ?? 0;
  const dayHigh = toNumber(quote["03. high"]) ?? 0;
  const dayLow = toNumber(quote["04. low"]) ?? 0;
  const dayChange = toNumber(quote["09. change"]) ?? 0;
  const dayChangePercent = toNumber(quote["10. change percent"]) ?? 0;
  const volume = toNumber(quote["06. volume"]) ?? 0;

  return {
    ticker: normalized,
    companyName: normalized,
    price,
    dayOpen,
    dayHigh,
    dayLow,
    dayChange,
    dayChangePercent,
    change: dayChange,
    changePercent: dayChangePercent,
    volume,
    avgVolume: 0,
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
  };
};
