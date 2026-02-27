import { AlertHistoryItem } from "@/components/dashboard/AlertHistoryItem";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { prisma } from "@/lib/prisma/client";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getUser() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function AlertHistoryPage() {
  const user = await getUser();

  const alerts = user
    ? await prisma.alert.findMany({
        where: { userId: user.id },
        include: { history: { orderBy: { triggeredAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const history = alerts.flatMap((alert) =>
    alert.history.map((item) => ({
      id: item.id,
      alertId: alert.id,
      ticker: alert.ticker,
      companyName: alert.companyName ?? alert.ticker,
      alertType: alert.alertType,
      priceAtTrigger: item.priceAtTrigger,
      currentPrice: alert.currentPrice ?? item.priceAtTrigger,
      triggeredAt: item.triggeredAt.toISOString(),
      aiSummary: item.aiSummary ?? "",
    }))
  );

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
        <span>Showing 1-{Math.min(20, history.length)} of {history.length}</span>
        <div className="flex gap-2">
          <button className="rounded-full border border-border px-4 py-2">Previous</button>
          <button className="rounded-full border border-border px-4 py-2">Next</button>
        </div>
      </div>
    </div>
  );
}
