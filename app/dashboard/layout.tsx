import { Sidebar } from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-sans-heading flex min-h-screen bg-lp-bg">
      <Sidebar />
      <main className="flex-1 px-6 py-8 md:px-10">
        {children}
      </main>
    </div>
  );
}
