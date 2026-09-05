"use client";

import Link from "next/link";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";

/** Legal-only footer for ad landing pages. No navigation, no exits. */
export function LpFooter() {
  const { openBanner } = useCookieConsent();
  return (
    <footer className="border-t border-slate-100 bg-white py-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-5 text-xs sm:px-8 lg:px-12 text-text-muted md:flex-row md:items-center md:justify-between">
        <p>© 2026 FreeStockAlerts.AI · Wealthpire, Inc. Not investment advice.</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/privacy" className="hover:text-text-primary">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-text-primary">Terms of Use</Link>
          <Link href="/disclaimer" className="hover:text-text-primary">Disclaimer</Link>
          <button type="button" onClick={openBanner} className="hover:text-text-primary">
            Cookie Settings
          </button>
        </div>
      </div>
    </footer>
  );
}
