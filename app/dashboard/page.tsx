import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { AlertTable } from "@/components/dashboard/AlertTable";
import { mockAlertHistory, mockAlerts } from "@/lib/mock/alerts";
import { headers } from "next/headers";

const getBaseUrl = () => {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
};

export default async function DashboardPage() {
  let alerts = mockAlerts;
  let history = mockAlertHistory;

  try {
    const res = await fetch(`${getBaseUrl()}/api/alerts?includeHistory=true`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.alerts) {
        alerts = json.data.alerts;
        history = json.data.history ?? [];
      }
    }
  } catch (error) {
    // fall back to mock data
  }

  const activeAlerts = alerts.filter((alert) => alert.isActive);
  const stats = [
    { label: "Active Alerts", value: `${activeAlerts.length} / 50` },
    { label: "Triggered Today", value: "2" },
    { label: "Templates Active", value: "3" },
    { label: "Alerts Fired (All Time)", value: `${history.length}` },
  ];

  const recent = history.slice(0, 5).map((historyItem) => {
    const alert = alerts.find((item) => item.id === historyItem.alertId);
    return {
      ...historyItem,
      companyName: alert?.companyName ?? historyItem.ticker,
      currentPrice: alert?.currentPrice ?? historyItem.priceAtTrigger,
    };
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary">
            Overview of your active alerts and the latest triggers.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/dashboard/alerts/new">Create New Alert</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/templates">Browse Templates</Link>
          </Button>
        </div>
      </div>

      <StatsRow stats={stats} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Recent Triggered Alerts</h2>
          <Link href="/dashboard/history" className="text-sm font-semibold text-primary">
            View All →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
            No alerts have triggered yet. Create your first alert to start tracking moves.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {recent.map((item) => (
              <AlertCard
                key={item.id}
                ticker={item.ticker}
                companyName={item.companyName}
                alertType={item.alertType}
                triggerPrice={item.priceAtTrigger}
                currentPrice={item.currentPrice}
                triggeredAt={item.triggeredAt}
                aiSummary={item.aiSummary}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Your Active Alerts</h2>
          <Link href="/dashboard/alerts" className="text-sm font-semibold text-primary">
            View All Alerts →
          </Link>
        </div>
        {alerts.length === 0 ? (
          <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
            You haven&apos;t created any alerts yet.
          </div>
        ) : (
          <AlertTable alerts={alerts.slice(0, 10)} />
        )}
      </section>
    </div>
  );
}
