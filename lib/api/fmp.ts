import { mockQuoteMap } from "@/lib/mock/quotes";

export const fetchFmpQuote = async (ticker: string) => {
  // TODO: Replace with live FMP API call
  return mockQuoteMap.get(ticker) ?? null;
};

export const fetchFmpBatchQuotes = async (tickers: string[]) => {
  // TODO: Replace with live FMP batch quote API call
  return tickers
    .map((ticker) => mockQuoteMap.get(ticker))
    .filter(Boolean);
};
