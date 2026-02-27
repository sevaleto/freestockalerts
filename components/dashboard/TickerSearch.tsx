"use client";

import { useMemo, useState } from "react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { mockTickers } from "@/lib/mock/tickers";
import { mockQuoteMap } from "@/lib/mock/quotes";
import { formatPrice, formatPercent } from "@/lib/utils/formatters";

interface TickerSearchProps {
  onSelect: (ticker: string) => void;
}

export function TickerSearch({ onSelect }: TickerSearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mockTickers.slice(0, 12);
    return mockTickers
      .filter(
        (item) =>
          item.ticker.toLowerCase().includes(normalized) ||
          item.companyName.toLowerCase().includes(normalized)
      )
      .slice(0, 12);
  }, [query]);

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
              const quote = mockQuoteMap.get(item.ticker);
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
