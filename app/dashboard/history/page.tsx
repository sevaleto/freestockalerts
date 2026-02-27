import { AlertHistoryItem } from "@/components/dashboard/AlertHistoryItem";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockAlertHistory } from "@/lib/mock/alerts";
import { headers } from "next/headers";

const getBaseUrl = () => {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
};

export default async function AlertHistoryPage() {
  let history = mockAlertHistory;

  try {
    const res = await fetch(`${getBaseUrl()}/api/alerts?includeHistory=true`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.history) history = json.data.history;
    }
  } catch (error) {
    // fall back to mock data
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Alert History</h1>
        <p className="text-sm text-text-secondary">
          Review all triggered alerts with AI summaries.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Input placeholder="Filter by ticker" />
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Filter by alert type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
            <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
            <SelectItem value="VOLUME_SPIKE">Volume Spike</SelectItem>
            <SelectItem value="RSI_OVERSOLD">RSI Oversold</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" />
      </div>

      {history.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
          No alert history yet. Triggered alerts will appear here.
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <AlertHistoryItem key={item.id} {...item} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>Showing 1-20 of {history.length}</span>
        <div className="flex gap-2">
          <button className="rounded-full border border-border px-4 py-2">Previous</button>
          <button className="rounded-full border border-border px-4 py-2">Next</button>
        </div>
      </div>
    </div>
  );
}
