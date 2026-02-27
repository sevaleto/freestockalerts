"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { AlertHistoryItem } from "@/components/dashboard/AlertHistoryItem";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HistoryEntry {
  id: string;
  alertId: string;
  ticker: string;
  companyName: string;
  alertType: string;
  priceAtTrigger: number;
  currentPrice: number;
  triggeredAt: string;
  aiSummary: string;
}

const PAGE_SIZE = 20;

export default function AlertHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [tickerFilter, setTickerFilter] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/alerts?includeHistory=true");
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data?.history) {
          setHistory(json.data.history);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [tickerFilter, alertTypeFilter, dateFilter]);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      // Ticker filter (case-insensitive contains)
      if (
        tickerFilter &&
        !item.ticker.toLowerCase().includes(tickerFilter.toLowerCase())
      ) {
        return false;
      }
      // Alert type filter
      if (alertTypeFilter !== "ALL" && item.alertType !== alertTypeFilter) {
        return false;
      }
      // Date filter (match by date string YYYY-MM-DD)
      if (dateFilter) {
        const itemDate = item.triggeredAt.split("T")[0];
        if (itemDate !== dateFilter) return false;
      }
      return true;
    });
  }, [history, tickerFilter, alertTypeFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Alert History
          </h1>
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Alert History
        </h1>
        <p className="text-sm text-text-secondary">
          Review all triggered alerts with AI summaries.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Input
          placeholder="Filter by ticker"
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
        />
        <Select value={alertTypeFilter} onValueChange={setAlertTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by alert type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
            <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
            <SelectItem value="PERCENT_CHANGE_DAY">% Change Day</SelectItem>
            <SelectItem value="VOLUME_SPIKE">Volume Spike</SelectItem>
            <SelectItem value="RSI_OVERBOUGHT">RSI Overbought</SelectItem>
            <SelectItem value="RSI_OVERSOLD">RSI Oversold</SelectItem>
            <SelectItem value="SMA_CROSS_ABOVE">SMA Cross Above</SelectItem>
            <SelectItem value="SMA_CROSS_BELOW">SMA Cross Below</SelectItem>
            <SelectItem value="FIFTY_TWO_WEEK_HIGH">52-Week High</SelectItem>
            <SelectItem value="FIFTY_TWO_WEEK_LOW">52-Week Low</SelectItem>
            <SelectItem value="EARNINGS_REMINDER">Earnings Reminder</SelectItem>
            <SelectItem value="PRICE_RECOVERY">Price Recovery</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
          {history.length === 0
            ? "No alert history yet. Triggered alerts will appear here."
            : "No results match your filters."}
        </div>
      ) : (
        <div className="space-y-4">
          {paginated.map((item) => (
            <AlertHistoryItem key={item.id} {...item} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>
          Showing {filtered.length === 0 ? 0 : startIdx + 1}-
          {Math.min(startIdx + PAGE_SIZE, filtered.length)} of{" "}
          {filtered.length}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-border px-4 py-2 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            className="rounded-full border border-border px-4 py-2 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
