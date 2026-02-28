"use client";

import { useEffect, useRef, useState } from "react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { mockTickers } from "@/lib/mock/tickers";
import { mockQuoteMap } from "@/lib/mock/quotes";
import { formatPrice, formatPercent } from "@/lib/utils/formatters";
import { trackSearch } from "@/lib/tracking/events";

interface TickerSearchProps {
  onSelect: (ticker: string) => void;
}

/** Fire search event when user submits a meaningful query (3+ chars, debounced) */
function useTrackSearch(query: string) {
  const lastTracked = useRef("");
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === lastTracked.current) return;
    const timer = setTimeout(() => {
      trackSearch(trimmed);
      lastTracked.current = trimmed;
    }, 1500); // debounce — only fires after 1.5s of no typing
    return () => clearTimeout(timer);
  }, [query]);
}

export function TickerSearch({ onSelect }: TickerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(mockTickers.slice(0, 12));
  useTrackSearch(query);
  const [quoteLookup, setQuoteLookup] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setResults(mockTickers.slice(0, 12));
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/quotes/search?query=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        if (isMounted && Array.isArray(json?.data)) {
          setResults(json.data.slice(0, 12));
        }
      } catch (error) {
        if (isMounted) {
          const fallback = mockTickers
            .filter(
              (item) =>
                item.ticker.toLowerCase().includes(normalized.toLowerCase()) ||
                item.companyName.toLowerCase().includes(normalized.toLowerCase())
            )
            .slice(0, 12);
          setResults(fallback);
        }
      }
    };

    const timeout = setTimeout(fetchResults, 150);
    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchQuotes = async () => {
      const entries = (await Promise.all(
        results.map(async (item): Promise<[string, any]> => {
          try {
            const res = await fetch(`/api/quotes/${item.ticker}`, { signal: controller.signal });
            if (!res.ok) return [item.ticker, mockQuoteMap.get(item.ticker)];
            const json = await res.json();
            return [item.ticker, json?.data ?? mockQuoteMap.get(item.ticker)];
          } catch (error) {
            return [item.ticker, mockQuoteMap.get(item.ticker)];
          }
        })
      )) as Array<[string, any]>;

      if (isMounted) {
        const filtered = entries.filter((entry): entry is [string, any] => Boolean(entry[1]));
        setQuoteLookup(new Map(filtered));
      }
    };

    fetchQuotes();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [results]);

  return (
    <Card className="border-border p-4">
      <Command shouldFilter={false} className="rounded-2xl">
        <CommandInput
          placeholder="Search ticker or company"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-64">
          <CommandGroup heading="Matching tickers">
            {results.map((item) => {
              const quote = quoteLookup.get(item.ticker) ?? mockQuoteMap.get(item.ticker);
              return (
                <CommandItem
                  key={item.ticker}
                  value={item.ticker}
                  onSelect={() => onSelect(item.ticker)}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{item.ticker}</p>
                    <p className="text-xs text-text-muted">{item.companyName}</p>
                  </div>
                  {quote ? (
                    <div className="text-right text-xs text-text-secondary">
                      <p className="font-semibold text-text-primary">{formatPrice(quote.price)}</p>
                      <p
                        className={
                          quote.dayChangePercent >= 0 ? "text-success" : "text-danger"
                        }
                      >
                        {formatPercent(quote.dayChangePercent)}
                      </p>
                    </div>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </Card>
  );
}
