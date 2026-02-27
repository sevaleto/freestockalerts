import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTable } from "@/components/dashboard/AlertTable";
import { mockAlerts } from "@/lib/mock/alerts";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">My Alerts</h1>
          <p className="text-sm text-text-secondary">
            Manage your custom alerts and template-based subscriptions.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/alerts/new">Create New Alert</Link>
        </Button>
      </div>

      {mockAlerts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
          No alerts yet. Create one to start monitoring prices.
        </div>
      ) : (
        <AlertTable alerts={mockAlerts} />
      )}
    </div>
  );
}
