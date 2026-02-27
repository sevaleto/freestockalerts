import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { AlertTable } from "@/components/dashboard/AlertTable";
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

export default async function DashboardPage() {
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

  const activeAlerts = alerts.filter((alert) => alert.isActive);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const triggeredToday = history.filter(
    (h) => new Date(h.triggeredAt) >= today
  ).length;

  const stats = [
    { label: "Active Alerts", value: `${activeAlerts.length} / 50` },
    { label: "Triggered Today", value: `${triggeredToday}` },
    { label: "Alerts Fired (All Time)", value: `${history.length}` },
  ];

  const recent = history.slice(0, 5);

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
