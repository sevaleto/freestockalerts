"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LayoutDashboard,
  Grid2X2,
  History,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { createBrowserClient } from "@supabase/ssr";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/alerts", label: "My Alerts", icon: Bell },
  { href: "/dashboard/templates", label: "Templates", icon: Grid2X2 },
  { href: "/dashboard/history", label: "Alert History", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/");
  };

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:bg-surface"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="hidden h-screen w-72 flex-col border-r border-border bg-white px-6 py-6 md:flex">
        <div className="flex items-center justify-between">
          <Logo />
        </div>
        <div className="mt-10 flex flex-1 flex-col gap-6">
          {navLinks}
          <div className="mt-auto">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex w-full items-center justify-between border-b border-border bg-white px-6 py-4 md:hidden">
        <Logo />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-6">
            <div className="mb-6">
              <Logo />
            </div>
            {navLinks}
            <button
              onClick={handleSignOut}
              className="mt-6 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
