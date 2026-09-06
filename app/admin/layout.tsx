import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/shared/Logo";
import { getAuthUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/**
 * Admin shell. Signed-out visitors go to login (middleware does the same);
 * signed-in non-admins get a 404 so the area does not advertise itself.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/admin/ads");
  if (!isAdminEmail(user.email)) notFound();

  return (
    <div className="font-sans-heading min-h-screen bg-lp-bg">
      <header className="border-b border-lp-border bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="rounded-full bg-lp-mint px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-lp-teal">Admin</span>
          </div>
          <nav className="flex items-center gap-5 text-sm font-medium text-lp-navy/80">
            <Link href="/admin/pages" className="hover:text-lp-teal">
              Pages
            </Link>
            <Link href="/admin/ads" className="hover:text-lp-teal">
              Email Ads
            </Link>
            <Link href="/admin/subscribers" className="hover:text-lp-teal">
              Subscribers
            </Link>
            <Link href="/admin/cohorts" className="hover:text-lp-teal">
              Cohorts
            </Link>
            <Link href="/admin/newsletters" className="hover:text-lp-teal">
              Newsletters
            </Link>
            <Link href="/dashboard" className="hover:text-lp-teal">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6">{children}</main>
    </div>
  );
}
