import { mockQuoteMap } from "@/lib/mock/quotes";

export const fetchAlphaVantageQuote = async (ticker: string) => {
  // TODO: Replace with live Alpha Vantage API call
  return mockQuoteMap.get(ticker) ?? null;
};
