import { AlertHistoryItem } from "@/components/dashboard/AlertHistoryItem";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockAlertHistory } from "@/lib/mock/alerts";

export default function AlertHistoryPage() {
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

      <div className="space-y-4">
        {mockAlertHistory.map((item) => (
          <AlertHistoryItem key={item.id} {...item} />
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>Showing 1-20 of {mockAlertHistory.length}</span>
        <div className="flex gap-2">
          <button className="rounded-full border border-border px-4 py-2">Previous</button>
          <button className="rounded-full border border-border px-4 py-2">Next</button>
        </div>
      </div>
    </div>
  );
}
