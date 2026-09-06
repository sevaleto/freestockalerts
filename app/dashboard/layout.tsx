import { Sidebar } from "@/components/dashboard/Sidebar";
import { getAdminUser } from "@/lib/auth/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  return (
    <div className="font-sans-heading flex min-h-screen bg-lp-bg">
      <Sidebar showAdmin={!!admin} />
      <main className="flex-1 px-6 py-8 md:px-10">
        {children}
      </main>
    </div>
  );
}
