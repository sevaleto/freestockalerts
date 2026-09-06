"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { useCookieConsent } from "@/lib/cookies/CookieConsentContext";

export function Footer() {
  const { openBanner } = useCookieConsent();

  return (
    <footer className="border-t border-lp-border/70 bg-lp-bg py-12">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
        <Logo />
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-text-secondary" aria-label="Footer">
          <Link href="/about" className="hover:text-text-primary">About</Link>
          <Link href="/templates" className="hover:text-text-primary">Strategies</Link>
          <Link href="/advertise" className="hover:text-text-primary">Advertise</Link>
          <Link href="/privacy" className="hover:text-text-primary">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-text-primary">Terms of Use</Link>
          <Link href="/disclaimer" className="hover:text-text-primary">Disclaimer</Link>
          <button type="button" onClick={openBanner} className="text-text-secondary transition-colors hover:text-text-primary">
            Cookie Settings
          </button>
          <Link href="/do-not-sell" className="hover:text-text-primary">Do Not Sell or Share My Personal Information</Link>
        </nav>
      </div>
      <div className="mx-auto mt-6 w-full max-w-[1440px] space-y-1 px-5 text-xs text-text-muted sm:px-8 lg:px-12">
        <p>© 2026 FreeStockAlerts.AI, a Wealthpire, Inc. property. Educational information only. Not investment advice.</p>
      </div>
    </footer>
  );
}
