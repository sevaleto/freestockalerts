import Link from "next/link";
import { Button } from "@/components/ui/button";
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

export default async function AlertsPage() {
  const user = await getUser();

  const alerts = user
    ? await prisma.alert.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

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

      {alerts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-6 text-sm text-text-secondary">
          No alerts yet. Create one to start monitoring prices.
        </div>
      ) : (
        <AlertTable alerts={alerts} />
      )}
    </div>
  );
}
