import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { AlertTable } from "@/components/dashboard/AlertTable";
import { mockAlertHistory, mockAlerts } from "@/lib/mock/alerts";

export default function DashboardPage() {
  const activeAlerts = mockAlerts.filter((alert) => alert.isActive);
  const stats = [
    { label: "Active Alerts", value: `${activeAlerts.length} / 50` },
    { label: "Triggered Today", value: "2" },
    { label: "Templates Active", value: "3" },
    { label: "Alerts Fired (All Time)", value: `${mockAlertHistory.length}` },
  ];

  const recent = mockAlertHistory.slice(0, 5).map((history) => {
    const alert = mockAlerts.find((item) => item.id === history.alertId);
    return {
      ...history,
      companyName: alert?.companyName ?? history.ticker,
      currentPrice: alert?.currentPrice ?? history.priceAtTrigger,
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
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Your Active Alerts</h2>
          <Link href="/dashboard/alerts" className="text-sm font-semibold text-primary">
            View All Alerts →
          </Link>
        </div>
        <AlertTable alerts={mockAlerts.slice(0, 10)} />
      </section>
    </div>
  );
}
